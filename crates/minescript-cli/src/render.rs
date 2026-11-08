use std::io::IsTerminal;
use std::ops::Range;
use std::path::Path;

use ariadne::{Color, Config, Label, Report, ReportKind, Source};
use minescript_core::source::{LineIndex, normalize};
use minescript_core::{Diagnostic, Severity};

pub struct Rendered {
    name: String,
    text: String,
}

impl Rendered {
    pub fn new(path: &Path, raw: &str) -> Self {
        Self {
            name: path.display().to_string(),
            text: normalize(raw),
        }
    }

    fn char_range(&self, diagnostic: &Diagnostic) -> Range<usize> {
        let index = LineIndex::new(&self.text);
        let char_offset = |utf16: u32| {
            index
                .position_of_utf16(utf16)
                .and_then(|(line, byte_col)| {
                    let start = index.line_start(line)?;
                    self.text.get(..start + byte_col)
                })
                .map_or(0, |prefix| prefix.chars().count())
        };
        let start = char_offset(diagnostic.span.from);
        let end = char_offset(diagnostic.span.to).max(start);
        start..end
    }

    fn line_range(&self, line: u32) -> Range<usize> {
        let index = LineIndex::new(&self.text);
        let chars_before =
            |byte: usize| self.text.get(..byte).map_or(0, |text| text.chars().count());
        let start = index.line_start(line).unwrap_or(0);
        let length = index.line_text(line).map_or(0, |text| text.chars().count());
        let first = chars_before(start);
        first..first + length
    }
}

const ESCAPE: char = '\u{1b}';

fn colored() -> bool {
    std::io::stderr().is_terminal() && std::env::var_os("NO_COLOR").is_none()
}

fn config() -> Config {
    Config::default().with_color(colored())
}

fn without_escapes(text: &str) -> String {
    let mut plain = String::with_capacity(text.len());
    let mut chars = text.chars();
    while let Some(ch) = chars.next() {
        if ch == ESCAPE {
            chars.by_ref().find(char::is_ascii_alphabetic);
        } else {
            plain.push(ch);
        }
    }
    plain
}

fn emit(rendered: &Rendered, report: &Report<'_, (&str, Range<usize>)>, fallback: &str) {
    let name = rendered.name.as_str();
    let mut buffer = Vec::new();
    if report
        .write((name, Source::from(rendered.text.as_str())), &mut buffer)
        .is_err()
    {
        eprintln!("{name}: {fallback}");
        return;
    }
    let text = String::from_utf8_lossy(&buffer);
    if colored() {
        eprint!("{text}");
    } else {
        eprint!("{}", without_escapes(&text));
    }
}

pub fn print_runtime_error(rendered: &Rendered, code: &str, line: u32, message: &str) {
    let name = rendered.name.as_str();
    let range = rendered.line_range(line);
    let report = Report::build(
        ReportKind::Custom("Futásidejű hiba", Color::Red),
        (name, range.clone()),
    )
    .with_config(config())
    .with_code(code)
    .with_message(message)
    .with_label(
        Label::new((name, range))
            .with_message(format!("itt állt meg a futás ({line}. sor)"))
            .with_color(Color::Red),
    )
    .finish();
    emit(rendered, &report, &format!("{line}. sor: {message}"));
}

fn code_name(diagnostic: &Diagnostic) -> String {
    serde_json::to_value(diagnostic.code)
        .ok()
        .and_then(|value| value.as_str().map(str::to_owned))
        .unwrap_or_default()
}

pub fn print_diagnostics(rendered: &Rendered, diagnostics: &[Diagnostic]) {
    for diagnostic in diagnostics {
        let (kind, color) = match diagnostic.severity {
            Severity::Error => (ReportKind::Custom("Hiba", Color::Red), Color::Red),
            Severity::Warning => (
                ReportKind::Custom("Figyelmeztetés", Color::Yellow),
                Color::Yellow,
            ),
            Severity::Info | Severity::Hint => {
                (ReportKind::Custom("Tipp", Color::Cyan), Color::Cyan)
            }
        };
        let range = rendered.char_range(diagnostic);
        let name = rendered.name.as_str();
        let line = diagnostic.span.line;
        let label = match &diagnostic.help {
            Some(help) => format!("{line}. sor. Javaslat: {help}"),
            None => format!("{line}. sor"),
        };
        let report = Report::build(kind, (name, range.clone()))
            .with_config(config())
            .with_code(code_name(diagnostic))
            .with_message(&diagnostic.message)
            .with_label(
                Label::new((name, range))
                    .with_message(label)
                    .with_color(color),
            )
            .finish();
        emit(
            rendered,
            &report,
            &format!("{line}. sor: {}", diagnostic.message),
        );
    }
}
