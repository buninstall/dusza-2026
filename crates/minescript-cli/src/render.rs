use std::ops::Range;
use std::path::Path;

use ariadne::{Color, Label, Report, ReportKind, Source};
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
            Severity::Error => (ReportKind::Error, Color::Red),
            Severity::Warning => (ReportKind::Warning, Color::Yellow),
            Severity::Info | Severity::Hint => (ReportKind::Advice, Color::Cyan),
        };
        let range = rendered.char_range(diagnostic);
        let name = rendered.name.as_str();
        let mut report = Report::build(kind, (name, range.clone()))
            .with_code(code_name(diagnostic))
            .with_message(&diagnostic.message)
            .with_label(
                Label::new((name, range))
                    .with_message(format!("{}. sor", diagnostic.span.line))
                    .with_color(color),
            );
        if let Some(help) = &diagnostic.help {
            report = report.with_help(help);
        }
        if report
            .finish()
            .eprint((name, Source::from(rendered.text.as_str())))
            .is_err()
        {
            eprintln!(
                "{}:{}: {}",
                rendered.name, diagnostic.span.line, diagnostic.message
            );
        }
    }
}
