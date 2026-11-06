mod docs;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::diagnostics::Diagnostic;
use crate::lint::lint;
use crate::source::{LineIndex, normalize};
use crate::span::Span;
use crate::syntax::keywords::is_keyword;
use crate::syntax::parse;

pub use docs::{COMMAND_DOCS, CommandDoc, keyword_doc};

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
    let parsed = parse(src);
    let mut diagnostics = parsed.diagnostics;
    if let Some(program) = &parsed.program {
        diagnostics.extend(lint(program, src));
    }
    Analysis {
        diagnostics,
        tokens: Vec::new(),
        folds: Vec::new(),
        symbols: Vec::new(),
    }
}

pub fn complete(src: &str, offset: u32) -> Vec<CompletionItem> {
    let text = normalize(src);
    let index = LineIndex::new(&text);
    let Some((line, byte_col)) = index.position_of_utf16(offset) else {
        return Vec::new();
    };
    let line_text = index.line_text(line).unwrap_or("");
    let before_cursor = line_text.get(..byte_col).unwrap_or("");
    if before_cursor.trim_start_matches(' ').contains(' ') {
        return Vec::new();
    }
    COMMAND_DOCS
        .iter()
        .map(|doc| CompletionItem {
            label: doc.label.to_owned(),
            kind: if doc.snippet.contains("${") {
                CompletionKind::Snippet
            } else {
                CompletionKind::Keyword
            },
            detail: doc.detail.to_owned(),
            documentation: doc.documentation.to_owned(),
            insert_text: doc.snippet.to_owned(),
        })
        .collect()
}

pub fn hover(src: &str, offset: u32) -> Option<Hover> {
    let text = normalize(src);
    let index = LineIndex::new(&text);
    let (line, byte_col) = index.position_of_utf16(offset)?;
    let line_text = index.line_text(line)?;
    let is_word_byte = |byte: &u8| byte.is_ascii_alphanumeric();
    let bytes = line_text.as_bytes();
    let start = bytes
        .get(..byte_col)?
        .iter()
        .rposition(|byte| !is_word_byte(byte))
        .map_or(0, |position| position + 1);
    let end = bytes
        .get(byte_col..)?
        .iter()
        .position(|byte| !is_word_byte(byte))
        .map_or(bytes.len(), |position| byte_col + position);
    let word = line_text.get(start..end)?;
    if word.is_empty() || !is_keyword(word) {
        return None;
    }
    Some(Hover {
        contents: keyword_doc(word)?.to_owned(),
        span: Span::in_line(&index, line, start, end),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn completes_all_commands_at_line_start() {
        let items = complete("", 0);
        assert_eq!(items.len(), 8);
        assert!(
            items
                .iter()
                .any(|item| item.insert_text.starts_with("while "))
        );
    }

    #[test]
    fn completes_commands_in_indented_first_token() {
        let src = "while t\n    pr";
        let items = complete(src, 14);
        assert_eq!(items.len(), 8);
    }

    #[test]
    fn no_command_completion_after_first_token() {
        assert!(complete("set a", 5).is_empty());
    }

    #[test]
    fn hover_explains_keywords() {
        let hover = hover("set a to isThere 2", 11).unwrap();
        assert!(hover.contents.contains("isThere"));
        assert_eq!((hover.span.from, hover.span.to), (9, 16));
    }

    #[test]
    fn hover_ignores_identifiers() {
        assert!(hover("set arany to 1", 6).is_none());
    }

    #[test]
    fn analyze_reports_parse_diagnostics() {
        assert!(analyze("").diagnostics.is_empty());
        assert!(!analyze("Step forward 1").diagnostics.is_empty());
    }
}
