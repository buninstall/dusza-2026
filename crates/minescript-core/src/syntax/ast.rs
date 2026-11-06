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

impl Program {
    pub fn for_each_line<'p>(&'p self, mut visit: impl FnMut(LineNode<'p>, usize)) {
        visit_block(&self.body, 0, &mut visit);
    }
}

fn visit_block<'p>(body: &'p [Stmt], depth: usize, visit: &mut impl FnMut(LineNode<'p>, usize)) {
    for stmt in body {
        visit(LineNode::Statement(stmt), depth);
        match &stmt.kind {
            StmtKind::If {
                then_body,
                else_branch,
                ..
            } => {
                visit_block(then_body, depth + 1, visit);
                if let Some(branch) = else_branch {
                    visit(LineNode::Else(branch), depth);
                    visit_block(&branch.body, depth + 1, visit);
                }
            }
            StmtKind::While { body, .. } => visit_block(body, depth + 1, visit),
            StmtKind::Step { .. }
            | StmtKind::Turn { .. }
            | StmtKind::Mine
            | StmtKind::Print { .. }
            | StmtKind::Set { .. } => {}
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
