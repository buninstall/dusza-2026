mod indent;
mod whitespace;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::diagnostics::Diagnostic;
use crate::source::normalize;
use crate::syntax::parse;

pub const DEFAULT_INDENT_WIDTH: u32 = 4;
pub const MIN_INDENT_WIDTH: u32 = 1;
pub const MAX_INDENT_WIDTH: u32 = 16;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", default)]
pub struct FormatOptions {
    pub indent_width: u32,
}

impl Default for FormatOptions {
    fn default() -> Self {
        Self {
            indent_width: DEFAULT_INDENT_WIDTH,
        }
    }
}

impl FormatOptions {
    fn effective_indent_width(self) -> usize {
        let width = self.indent_width.clamp(MIN_INDENT_WIDTH, MAX_INDENT_WIDTH);
        usize::try_from(width).unwrap_or(1)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FormatResult {
    pub text: String,
    pub changed: bool,
    pub diagnostics: Vec<Diagnostic>,
}

pub fn format(src: &str, options: &FormatOptions) -> FormatResult {
    let repaired = whitespace::repair(&normalize(src));
    if normalize(&repaired) != repaired {
        return unchanged(src);
    }
    let Some(program) = parse(&repaired).program else {
        return unchanged(src);
    };
    let text = indent::reindent(&repaired, &program, options.effective_indent_width());
    FormatResult {
        changed: text != src,
        text,
        diagnostics: Vec::new(),
    }
}

fn unchanged(src: &str) -> FormatResult {
    FormatResult {
        text: src.to_owned(),
        changed: false,
        diagnostics: parse(src).diagnostics,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::DiagCode;

    fn formatted(src: &str) -> String {
        format(src, &FormatOptions::default()).text
    }

    #[test]
    fn a_second_byte_order_mark_stays_an_error() {
        let result = format("\u{feff}\u{feff}", &FormatOptions::default());
        assert_eq!(result.text, "\u{feff}\u{feff}");
        assert_eq!(result.diagnostics[0].code, DiagCode::SynInvalidToken);
    }

    #[test]
    fn lone_carriage_returns_are_never_turned_into_line_breaks() {
        for src in [
            "\r",
            "print 1\r",
            "print 1\rprint 2",
            "print 1\r\r\n",
            " \r \n",
        ] {
            let result = format(src, &FormatOptions::default());
            assert_eq!(result.text, src);
            assert!(!result.changed);
            assert!(
                result
                    .diagnostics
                    .iter()
                    .any(|diagnostic| diagnostic.code == DiagCode::SynLoneCr),
                "{src:?}"
            );
        }
    }

    #[test]
    fn default_indent_is_four_spaces() {
        assert_eq!(FormatOptions::default().indent_width, 4);
    }

    #[test]
    fn options_deserialize_with_defaults() {
        let options: FormatOptions = serde_json::from_str("{}").unwrap();
        assert_eq!(options, FormatOptions::default());
    }

    #[test]
    fn empty_source_stays_unchanged() {
        let result = format("", &FormatOptions::default());
        assert_eq!(result.text, "");
        assert!(!result.changed);
        assert!(result.diagnostics.is_empty());
    }

    #[test]
    fn formatted_program_is_left_alone() {
        let src = "while true\n    if a\n        mine here\n    else\n        print 1\n";
        let result = format(src, &FormatOptions::default());
        assert_eq!(result.text, src);
        assert!(!result.changed);
    }

    #[test]
    fn blocks_are_reindented_by_depth() {
        assert_eq!(
            formatted("while true\n  if a\n   mine here\n  else\n      print 1\nprint 2"),
            "while true\n    if a\n        mine here\n    else\n        print 1\nprint 2\n"
        );
    }

    #[test]
    fn indent_width_is_configurable_and_clamped() {
        let src = "if a\n    print 1\n";
        let two = format(src, &FormatOptions { indent_width: 2 });
        assert_eq!(two.text, "if a\n  print 1\n");
        let zero = format(src, &FormatOptions { indent_width: 0 });
        assert_eq!(zero.text, "if a\n print 1\n");
        let huge = format(
            src,
            &FormatOptions {
                indent_width: u32::MAX,
            },
        );
        assert_eq!(huge.text, format!("if a\n{}print 1\n", " ".repeat(16)));
    }

    #[test]
    fn whitespace_faults_are_repaired() {
        assert_eq!(
            formatted("\u{feff}print  1   \r\n\r\n   \r\nwhile t\r\n\tmine here\r\n"),
            "print 1\nwhile t\n    mine here\n"
        );
    }

    #[test]
    fn missing_final_newline_is_added() {
        let result = format("print 1", &FormatOptions::default());
        assert_eq!(result.text, "print 1\n");
        assert!(result.changed);
    }

    #[test]
    fn programs_with_remaining_errors_are_returned_unchanged() {
        for (src, code) in [
            ("print  1\nStep forward 1\n", DiagCode::SynUnknownCommand),
            ("print\t1\n", DiagCode::SynTab),
            ("print 1\rprint 2", DiagCode::SynLoneCr),
            ("  print 1\n", DiagCode::SynToplevelIndent),
        ] {
            let result = format(src, &FormatOptions::default());
            assert_eq!(result.text, src);
            assert!(!result.changed);
            assert!(
                result
                    .diagnostics
                    .iter()
                    .any(|diagnostic| diagnostic.code == code),
                "{src:?}: {:?}",
                result.diagnostics
            );
        }
    }

    #[test]
    fn only_blank_lines_format_to_the_empty_program() {
        let result = format("\n\n   \n", &FormatOptions::default());
        assert_eq!(result.text, "");
        assert!(result.changed);
    }

    #[test]
    fn formatting_is_idempotent() {
        let once = formatted("if a\n  print  1 \n\nelse\n   print 2");
        assert_eq!(formatted(&once), once);
    }
}
