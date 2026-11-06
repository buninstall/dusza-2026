use super::line::LineSyntax;
use crate::span::Span;
use crate::syntax::ast::{ElseBranch, Program, Simple, Stmt, StmtKind};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct PlacedLine {
    pub depth: usize,
    pub number: u32,
    pub span: Span,
    pub syntax: LineSyntax,
}

enum Header {
    If(Simple),
    While(Simple),
    Else,
}

struct OpenBlock {
    header: Header,
    number: u32,
    span: Span,
    body: Vec<Stmt>,
}

pub(super) fn build(lines: Vec<PlacedLine>) -> Program {
    let mut root: Vec<Stmt> = Vec::new();
    let mut open: Vec<OpenBlock> = Vec::new();
    for line in lines {
        while open.len() > line.depth {
            close(&mut open, &mut root);
        }
        if open.len() < line.depth {
            break;
        }
        let header = match line.syntax {
            LineSyntax::Command(kind) => {
                innermost(&mut open, &mut root).push(Stmt {
                    line: line.number,
                    span: line.span,
                    kind,
                });
                continue;
            }
            LineSyntax::If(cond) => Header::If(cond),
            LineSyntax::While(cond) => Header::While(cond),
            LineSyntax::Else => Header::Else,
        };
        open.push(OpenBlock {
            header,
            number: line.number,
            span: line.span,
            body: Vec::new(),
        });
    }
    while !open.is_empty() {
        close(&mut open, &mut root);
    }
    Program { body: root }
}

fn innermost<'a>(open: &'a mut [OpenBlock], root: &'a mut Vec<Stmt>) -> &'a mut Vec<Stmt> {
    match open.last_mut() {
        Some(block) => &mut block.body,
        None => root,
    }
}

fn close(open: &mut Vec<OpenBlock>, root: &mut Vec<Stmt>) {
    let Some(block) = open.pop() else {
        return;
    };
    let parent = innermost(open, root);
    let kind = match block.header {
        Header::If(cond) => StmtKind::If {
            cond,
            then_body: block.body,
            else_branch: None,
        },
        Header::While(cond) => StmtKind::While {
            cond,
            body: block.body,
        },
        Header::Else => {
            attach_else(
                parent,
                ElseBranch {
                    line: block.number,
                    span: block.span,
                    body: block.body,
                },
            );
            return;
        }
    };
    parent.push(Stmt {
        line: block.number,
        span: block.span,
        kind,
    });
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
