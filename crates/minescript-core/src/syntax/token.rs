use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::span::Span;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum TokenKind {
    Keyword,
    Bool,
    Number,
    Ident,
    Operator,
    Invalid,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Token {
    pub kind: TokenKind,
    pub text: String,
    pub span: Span,
}
