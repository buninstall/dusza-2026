mod completion;
mod docs;
mod hover;
mod outline;
mod tokens;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::diagnostics::Diagnostic;
use crate::lint::lint;
use crate::source::{LineIndex, normalize};
use crate::span::Span;
use crate::syntax::parse;

pub use completion::complete;
pub use docs::{COMMAND_DOCS, CommandDoc, keyword_doc};
pub use hover::hover;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum SemanticTokenKind {
    Keyword,
    Number,
    Bool,
    Operator,
    Variable,
    Invalid,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SemanticToken {
    pub from: u32,
    pub to: u32,
    pub kind: SemanticTokenKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FoldRange {
    pub from: u32,
    pub to: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "SymbolInfo")]
pub struct Symbol {
    pub name: String,
    pub span: Span,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Analysis {
    pub diagnostics: Vec<Diagnostic>,
    pub tokens: Vec<SemanticToken>,
    pub folds: Vec<FoldRange>,
    pub symbols: Vec<Symbol>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum CompletionKind {
    Keyword,
    Snippet,
    Variable,
    Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CompletionItem {
    pub label: String,
    pub kind: CompletionKind,
    pub detail: String,
    pub documentation: String,
    pub insert_text: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Hover {
    pub contents: String,
    pub span: Span,
}

pub fn analyze(src: &str) -> Analysis {
    let text = normalize(src);
    let index = LineIndex::new(&text);
    let parsed = parse(src);
    let diagnostics = match &parsed.program {
        Some(program) => lint(program, src),
        None => parsed.diagnostics,
    };
    let lines = outline::code_lines(&text);
    Analysis {
        diagnostics,
        tokens: tokens::semantic_tokens(&text, &index),
        folds: outline::folds(&lines, &index),
        symbols: outline::symbols(&lines, &index),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::{DiagCode, Severity};

    #[test]
    fn analyze_reports_parse_errors_instead_of_lints() {
        assert!(analyze("").diagnostics.is_empty());
        let broken = analyze("set u to 1\nStep forward 1");
        assert_eq!(broken.diagnostics.len(), 1);
        assert_eq!(broken.diagnostics[0].code, DiagCode::SynUnknownCommand);
    }

    #[test]
    fn analyze_reports_lints_for_valid_programs() {
        let analysis = analyze("set u to 1\n");
        assert_eq!(analysis.diagnostics.len(), 1);
        assert_eq!(analysis.diagnostics[0].code, DiagCode::LintUnusedVar);
        assert_eq!(analysis.diagnostics[0].severity, Severity::Warning);
    }

    #[test]
    fn analyze_returns_tokens_folds_and_symbols_even_for_broken_programs() {
        let analysis = analyze("set a to 1\nwhile a\n    print  a\n");
        assert_eq!(analysis.tokens.len(), 8);
        assert_eq!(analysis.folds, vec![FoldRange { from: 18, to: 31 }]);
        assert_eq!(analysis.symbols.len(), 1);
        assert_eq!(analysis.symbols[0].name, "a");
        assert_eq!(analysis.diagnostics[0].code, DiagCode::SynDoubleSpace);
    }

    #[test]
    fn analysis_of_the_spec_program_is_stable() {
        let src = "set count to 0\nset fal to isThere 1\nset megy to not fal\nwhile megy\n    set arany to isThere 2\n    if arany\n        step forward 1\n        mine here\n        set count to count + 1\n    else\n        step forward 1\n    set fal to isThere 1\n    set megy to not fal\nprint count\n";
        insta::assert_json_snapshot!("spec_program_analysis", analyze(src));
    }
}
