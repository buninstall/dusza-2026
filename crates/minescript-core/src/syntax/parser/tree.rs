use std::iter::Peekable;

use super::line::LineSyntax;
use crate::span::Span;
use crate::syntax::ast::{ElseBranch, Program, Stmt, StmtKind};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct PlacedLine {
    pub depth: usize,
    pub number: u32,
    pub span: Span,
    pub syntax: LineSyntax,
}

pub(super) fn build(lines: Vec<PlacedLine>) -> Program {
    let mut lines = lines.into_iter().peekable();
    Program {
        body: block(&mut lines, 0),
    }
}

fn block(lines: &mut Peekable<impl Iterator<Item = PlacedLine>>, depth: usize) -> Vec<Stmt> {
    let mut body: Vec<Stmt> = Vec::new();
    while let Some(PlacedLine {
        number,
        span,
        syntax,
        ..
    }) = lines.next_if(|line| line.depth == depth)
    {
        let kind = match syntax {
            LineSyntax::Command(kind) => kind,
            LineSyntax::If(cond) => StmtKind::If {
                cond,
                then_body: block(lines, depth + 1),
                else_branch: None,
            },
            LineSyntax::While(cond) => StmtKind::While {
                cond,
                body: block(lines, depth + 1),
            },
            LineSyntax::Else => {
                let branch = ElseBranch {
                    line: number,
                    span,
                    body: block(lines, depth + 1),
                };
                attach_else(&mut body, branch);
                continue;
            }
        };
        body.push(Stmt {
            line: number,
            span,
            kind,
        });
    }
    body
}

fn attach_else(body: &mut [Stmt], branch: ElseBranch) {
    if let Some(Stmt {
        kind: StmtKind::If { else_branch, .. },
        ..
    }) = body.last_mut()
    {
        *else_branch = Some(branch);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::syntax::ast::Simple;

    fn placed(depth: usize, number: u32, syntax: LineSyntax) -> PlacedLine {
        PlacedLine {
            depth,
            number,
            span: Span::default(),
            syntax,
        }
    }

    fn flag() -> Simple {
        Simple::Bool {
            value: true,
            span: Span::default(),
        }
    }

    #[test]
    fn nests_blocks_by_depth_and_attaches_else() {
        let program = build(vec![
            placed(0, 1, LineSyntax::While(flag())),
            placed(1, 2, LineSyntax::If(flag())),
            placed(2, 3, LineSyntax::Command(StmtKind::Mine)),
            placed(1, 4, LineSyntax::Else),
            placed(0, 5, LineSyntax::Command(StmtKind::Mine)),
        ]);
        assert_eq!(program.body.len(), 2);
        let StmtKind::While { body, .. } = &program.body[0].kind else {
            panic!("while kell");
        };
        let StmtKind::If {
            then_body,
            else_branch: Some(branch),
            ..
        } = &body[0].kind
        else {
            panic!("if-else kell");
        };
        assert_eq!(then_body[0].line, 3);
        assert_eq!(branch.line, 4);
        assert!(branch.body.is_empty());
        assert_eq!(program.body[1].line, 5);
    }

    #[test]
    fn else_without_if_is_dropped_defensively() {
        let program = build(vec![placed(0, 1, LineSyntax::Else)]);
        assert!(program.body.is_empty());
    }
}
