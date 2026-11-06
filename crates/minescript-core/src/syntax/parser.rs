use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::diagnostics::{DiagCode, Diagnostic};
use crate::source::{LineIndex, normalize};
use crate::span::Span;
use crate::syntax::ast::Program;
use crate::syntax::scanner::raw_lines;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ParseResult {
    pub program: Option<Program>,
    pub diagnostics: Vec<Diagnostic>,
}

pub fn parse(src: &str) -> ParseResult {
    let text = normalize(src);
    if raw_lines(&text).is_empty() {
        return ParseResult {
            program: Some(Program::default()),
            diagnostics: Vec::new(),
        };
    }
    let index = LineIndex::new(&text);
    ParseResult {
        program: None,
        diagnostics: vec![Diagnostic::new(
            DiagCode::SynNotImplemented,
            Span::whole_line(&index, 1),
        )],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_source_is_an_empty_program() {
        let result = parse("");
        assert_eq!(result.program, Some(Program::default()));
        assert!(result.diagnostics.is_empty());
    }

    #[test]
    fn bom_and_single_newline_are_an_empty_program() {
        let result = parse("\u{feff}\n");
        assert_eq!(result.program, Some(Program::default()));
    }
}
