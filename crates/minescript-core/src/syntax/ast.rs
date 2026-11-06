use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::span::Span;
use crate::syntax::keywords::pack;

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

type OperandSlots<'p> = [Option<&'p Simple>; 2];

impl Simple {
    pub fn ident_name(&self) -> Option<&str> {
        match self {
            Self::Ident { name, .. } => Some(name),
            Self::Int { .. } | Self::Bool { .. } => None,
        }
    }
}

impl Expr {
    pub fn operands(&self) -> impl Iterator<Item = &Simple> {
        self.operand_slots().into_iter().flatten()
    }

    fn operand_slots(&self) -> OperandSlots<'_> {
        match self {
            Self::Simple { value } => [Some(value), None],
            Self::IsThere { arg } => [Some(arg), None],
            Self::Not { operand } => [Some(operand), None],
            Self::Binary { lhs, rhs, .. } => [Some(lhs), Some(rhs)],
        }
    }
}

impl StmtKind {
    pub fn operands(&self) -> impl Iterator<Item = &Simple> {
        let slots: OperandSlots<'_> = match self {
            Self::Step { count } => [Some(count), None],
            Self::Turn { quarters } => [Some(quarters), None],
            Self::Print { value } => [Some(value), None],
            Self::Set { value, .. } => value.operand_slots(),
            Self::If { cond, .. } | Self::While { cond, .. } => [Some(cond), None],
            Self::Mine => [None, None],
        };
        slots.into_iter().flatten()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LineNode<'p> {
    Statement(&'p Stmt),
    Else(&'p ElseBranch),
}

impl LineNode<'_> {
    pub fn line(&self) -> u32 {
        match self {
            Self::Statement(stmt) => stmt.line,
            Self::Else(branch) => branch.line,
        }
    }
}

impl StmtKind {
    fn into_child_blocks(self) -> [Vec<Stmt>; 2] {
        match self {
            Self::If {
                then_body,
                else_branch,
                ..
            } => [
                then_body,
                else_branch.map(|branch| branch.body).unwrap_or_default(),
            ],
            Self::While { body, .. } => [body, Vec::new()],
            Self::Step { .. }
            | Self::Turn { .. }
            | Self::Mine
            | Self::Print { .. }
            | Self::Set { .. } => [Vec::new(), Vec::new()],
        }
    }
}

enum Visit<'p> {
    Statement(&'p Stmt, usize),
    Else(&'p ElseBranch, usize),
}

fn push_block<'p>(pending: &mut Vec<Visit<'p>>, body: &'p [Stmt], depth: usize) {
    pending.extend(body.iter().rev().map(|stmt| Visit::Statement(stmt, depth)));
}

impl Program {
    pub fn for_each_line<'p>(&'p self, mut visit: impl FnMut(LineNode<'p>, usize)) {
        let mut pending = Vec::new();
        push_block(&mut pending, &self.body, 0);
        while let Some(next) = pending.pop() {
            match next {
                Visit::Statement(stmt, depth) => {
                    visit(LineNode::Statement(stmt), depth);
                    match &stmt.kind {
                        StmtKind::If {
                            then_body,
                            else_branch,
                            ..
                        } => {
                            if let Some(branch) = else_branch {
                                pending.push(Visit::Else(branch, depth));
                            }
                            push_block(&mut pending, then_body, depth + 1);
                        }
                        StmtKind::While { body, .. } => push_block(&mut pending, body, depth + 1),
                        StmtKind::Step { .. }
                        | StmtKind::Turn { .. }
                        | StmtKind::Mine
                        | StmtKind::Print { .. }
                        | StmtKind::Set { .. } => {}
                    }
                }
                Visit::Else(branch, depth) => {
                    visit(LineNode::Else(branch), depth);
                    push_block(&mut pending, &branch.body, depth + 1);
                }
            }
        }
    }
}

impl Drop for Program {
    fn drop(&mut self) {
        let mut pending = std::mem::take(&mut self.body);
        while let Some(stmt) = pending.pop() {
            for block in stmt.kind.into_child_blocks() {
                pending.extend(block);
            }
        }
    }
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

const fn symbol(text: &[u8]) -> u64 {
    match pack(text) {
        Some(packed) => packed,
        None => 0,
    }
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
        const ADD: u64 = symbol(b"+");
        const SUB: u64 = symbol(b"-");
        const MUL: u64 = symbol(b"*");
        const EQ: u64 = symbol(b"=");
        const NE: u64 = symbol(b"<>");
        const LT: u64 = symbol(b"<");
        const LE: u64 = symbol(b"<=");
        const GT: u64 = symbol(b">");
        const GE: u64 = symbol(b">=");
        const AND: u64 = symbol(b"and");
        const OR: u64 = symbol(b"or");
        Some(match pack(text.as_bytes())? {
            ADD => Self::Add,
            SUB => Self::Sub,
            MUL => Self::Mul,
            EQ => Self::Eq,
            NE => Self::Ne,
            LT => Self::Lt,
            LE => Self::Le,
            GT => Self::Gt,
            GE => Self::Ge,
            AND => Self::And,
            OR => Self::Or,
            _ => return None,
        })
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

    fn int(value: i64) -> Simple {
        Simple::Int {
            value,
            span: Span::default(),
        }
    }

    fn name(text: &str) -> Simple {
        Simple::Ident {
            name: text.to_owned(),
            span: Span::default(),
        }
    }

    fn stmt(line: u32, kind: StmtKind) -> Stmt {
        Stmt {
            line,
            span: Span::default(),
            kind,
        }
    }

    #[test]
    fn operands_follow_evaluation_order() {
        let binary = StmtKind::Set {
            name: Ident {
                name: "a".to_owned(),
                span: Span::default(),
            },
            value: Expr::Binary {
                op: BinOp::Add,
                lhs: name("b"),
                rhs: int(1),
            },
        };
        let names: Vec<Option<&str>> = binary.operands().map(Simple::ident_name).collect();
        assert_eq!(names, vec![Some("b"), None]);
        assert_eq!(StmtKind::Mine.operands().count(), 0);
        assert_eq!(StmtKind::Turn { quarters: int(1) }.operands().count(), 1);
        assert_eq!(Expr::Not { operand: name("x") }.operands().count(), 1);
    }

    #[test]
    fn lines_are_visited_in_source_order_with_depth() {
        let program = Program {
            body: vec![
                stmt(
                    1,
                    StmtKind::If {
                        cond: name("a"),
                        then_body: vec![stmt(2, StmtKind::Mine)],
                        else_branch: Some(ElseBranch {
                            line: 3,
                            span: Span::default(),
                            body: vec![stmt(
                                4,
                                StmtKind::While {
                                    cond: name("b"),
                                    body: vec![stmt(5, StmtKind::Print { value: int(1) })],
                                },
                            )],
                        }),
                    },
                ),
                stmt(6, StmtKind::Step { count: int(1) }),
            ],
        };
        let mut visited = Vec::new();
        program.for_each_line(|node, depth| visited.push((node.line(), depth)));
        assert_eq!(
            visited,
            vec![(1, 0), (2, 1), (3, 0), (4, 1), (5, 2), (6, 0)]
        );
    }

    #[test]
    fn stmt_kind_serializes_with_kind_tag() {
        let stmt = StmtKind::Mine;
        let json = serde_json::to_value(&stmt).unwrap();
        assert_eq!(json, serde_json::json!({ "kind": "mine" }));
    }
}
