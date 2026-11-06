use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::span::Span;

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Program {
    pub body: Vec<Stmt>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Stmt {
    pub line: u32,
    pub span: Span,
    pub kind: StmtKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum StmtKind {
    Step {
        count: Simple,
    },
    Turn {
        quarters: Simple,
    },
    Mine,
    Print {
        value: Simple,
    },
    Set {
        name: Ident,
        value: Expr,
    },
    If {
        cond: Simple,
        then_body: Vec<Stmt>,
        else_branch: Option<ElseBranch>,
    },
    While {
        cond: Simple,
        body: Vec<Stmt>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ElseBranch {
    pub line: u32,
    pub span: Span,
    pub body: Vec<Stmt>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Ident {
    pub name: String,
    pub span: Span,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Simple {
    Ident { name: String, span: Span },
    Int { value: i64, span: Span },
    Bool { value: bool, span: Span },
}

impl Simple {
    pub fn span(&self) -> Span {
        match self {
            Self::Ident { span, .. } | Self::Int { span, .. } | Self::Bool { span, .. } => *span,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Expr {
    Simple { value: Simple },
    IsThere { arg: Simple },
    Binary { op: BinOp, lhs: Simple, rhs: Simple },
    Not { operand: Simple },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum BinOp {
    Add,
    Sub,
    Mul,
    Eq,
    Ne,
    Lt,
    Le,
    Gt,
    Ge,
    And,
    Or,
}

impl BinOp {
    pub const ALL: [Self; 11] = [
        Self::Add,
        Self::Sub,
        Self::Mul,
        Self::Eq,
        Self::Ne,
        Self::Lt,
        Self::Le,
        Self::Gt,
        Self::Ge,
        Self::And,
        Self::Or,
    ];

    pub fn symbol(self) -> &'static str {
        match self {
            Self::Add => "+",
            Self::Sub => "-",
            Self::Mul => "*",
            Self::Eq => "=",
            Self::Ne => "<>",
            Self::Lt => "<",
            Self::Le => "<=",
            Self::Gt => ">",
            Self::Ge => ">=",
            Self::And => "and",
            Self::Or => "or",
        }
    }

    pub fn from_symbol(text: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|op| op.symbol() == text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn binop_symbols_round_trip() {
        for op in BinOp::ALL {
            assert_eq!(BinOp::from_symbol(op.symbol()), Some(op));
        }
        assert_eq!(BinOp::from_symbol("=="), None);
    }

    #[test]
    fn stmt_kind_serializes_with_kind_tag() {
        let stmt = StmtKind::Mine;
        let json = serde_json::to_value(&stmt).unwrap();
        assert_eq!(json, serde_json::json!({ "kind": "mine" }));
    }
}
