use crate::names::NameMap;
use crate::syntax::ast::{BinOp, ElseBranch, Expr, Program, Simple, Stmt, StmtKind};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Operand {
    Int(i64),
    Bool(bool),
    Var(usize),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Calc {
    Simple(Operand),
    IsThere(Operand),
    Not(Operand),
    Binary(BinOp, Operand, Operand),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Op {
    Step(Operand),
    Turn(Operand),
    Mine,
    Print(Operand),
    Set(usize, Calc),
    Branch { cond: Operand, otherwise: usize },
    Else,
    Loop { cond: Operand, exit: usize },
    Jump(usize),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct Instr {
    pub line: u32,
    pub op: Op,
}

pub(super) struct Code<'p> {
    pub instrs: Vec<Instr>,
    pub names: Vec<&'p str>,
}

#[derive(Clone, Copy)]
enum Close<'p> {
    Nothing,
    Then {
        branch: usize,
        else_branch: Option<&'p ElseBranch>,
    },
    Else {
        jump: usize,
    },
    While {
        head: usize,
    },
}

struct Frame<'p> {
    body: &'p [Stmt],
    next: usize,
    close: Close<'p>,
}

struct Compiler<'p> {
    instrs: Vec<Instr>,
    slots: NameMap<&'p str, usize>,
    names: Vec<&'p str>,
}

pub(super) fn compile(program: &Program) -> Code<'_> {
    let mut compiler = Compiler {
        instrs: Vec::new(),
        slots: NameMap::default(),
        names: Vec::new(),
    };
    let mut frames = vec![Frame {
        body: &program.body,
        next: 0,
        close: Close::Nothing,
    }];
    while let Some(frame) = frames.last_mut() {
        if let Some(stmt) = frame.body.get(frame.next) {
            frame.next += 1;
            if let Some(child) = compiler.statement(stmt) {
                frames.push(child);
            }
        } else if let Some(finished) = frames.pop()
            && let Some(child) = compiler.close(finished.close)
        {
            frames.push(child);
        }
    }
    Code {
        instrs: compiler.instrs,
        names: compiler.names,
    }
}

impl<'p> Compiler<'p> {
    fn emit(&mut self, line: u32, op: Op) -> usize {
        self.instrs.push(Instr { line, op });
        self.instrs.len() - 1
    }

    fn slot(&mut self, name: &'p str) -> usize {
        let next = self.names.len();
        let slot = *self.slots.entry(name).or_insert(next);
        if slot == next {
            self.names.push(name);
        }
        slot
    }

    fn operand(&mut self, simple: &'p Simple) -> Operand {
        match simple {
            Simple::Int { value, .. } => Operand::Int(*value),
            Simple::Bool { value, .. } => Operand::Bool(*value),
            Simple::Ident { name, .. } => Operand::Var(self.slot(name)),
        }
    }

    fn calc(&mut self, expr: &'p Expr) -> Calc {
        match expr {
            Expr::Simple { value } => Calc::Simple(self.operand(value)),
            Expr::IsThere { arg } => Calc::IsThere(self.operand(arg)),
            Expr::Not { operand } => Calc::Not(self.operand(operand)),
            Expr::Binary { op, lhs, rhs } => {
                let left = self.operand(lhs);
                Calc::Binary(*op, left, self.operand(rhs))
            }
        }
    }

    fn statement(&mut self, stmt: &'p Stmt) -> Option<Frame<'p>> {
        let line = stmt.line;
        let op = match &stmt.kind {
            StmtKind::Step { count } => Op::Step(self.operand(count)),
            StmtKind::Turn { quarters } => Op::Turn(self.operand(quarters)),
            StmtKind::Mine => Op::Mine,
            StmtKind::Print { value } => Op::Print(self.operand(value)),
            StmtKind::Set { name, value } => {
                let slot = self.slot(&name.name);
                Op::Set(slot, self.calc(value))
            }
            StmtKind::If {
                cond,
                then_body,
                else_branch,
            } => {
                let cond = self.operand(cond);
                let branch = self.emit(line, Op::Branch { cond, otherwise: 0 });
                return Some(Frame {
                    body: then_body,
                    next: 0,
                    close: Close::Then {
                        branch,
                        else_branch: else_branch.as_ref(),
                    },
                });
            }
            StmtKind::While { cond, body } => {
                let cond = self.operand(cond);
                let head = self.emit(line, Op::Loop { cond, exit: 0 });
                return Some(Frame {
                    body,
                    next: 0,
                    close: Close::While { head },
                });
            }
        };
        self.emit(line, op);
        None
    }

    fn close(&mut self, close: Close<'p>) -> Option<Frame<'p>> {
        match close {
            Close::Nothing => None,
            Close::Then {
                branch,
                else_branch: None,
            } => {
                self.patch(branch);
                None
            }
            Close::Then {
                branch,
                else_branch: Some(else_branch),
            } => {
                let jump = self.emit(else_branch.line, Op::Jump(0));
                self.patch(branch);
                self.emit(else_branch.line, Op::Else);
                Some(Frame {
                    body: &else_branch.body,
                    next: 0,
                    close: Close::Else { jump },
                })
            }
            Close::Else { jump } => {
                self.patch(jump);
                None
            }
            Close::While { head } => {
                let line = self.instrs.get(head).map_or(0, |instr| instr.line);
                self.emit(line, Op::Jump(head));
                self.patch(head);
                None
            }
        }
    }

    fn patch(&mut self, at: usize) {
        let here = self.instrs.len();
        if let Some(instr) = self.instrs.get_mut(at) {
            match &mut instr.op {
                Op::Branch {
                    otherwise: target, ..
                }
                | Op::Loop { exit: target, .. }
                | Op::Jump(target) => *target = here,
                Op::Step(_) | Op::Turn(_) | Op::Mine | Op::Print(_) | Op::Set(..) | Op::Else => {}
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::syntax::parse;

    fn ops(src: &str) -> Vec<Op> {
        let program = parse(src).program.unwrap();
        compile(&program)
            .instrs
            .into_iter()
            .map(|instr| instr.op)
            .collect()
    }

    #[test]
    fn blocks_become_jumps() {
        assert_eq!(
            ops("while x\n    if y\n        mine here\n    else\n        print 1\nprint 2\n"),
            vec![
                Op::Loop {
                    cond: Operand::Var(0),
                    exit: 7
                },
                Op::Branch {
                    cond: Operand::Var(1),
                    otherwise: 4
                },
                Op::Mine,
                Op::Jump(6),
                Op::Else,
                Op::Print(Operand::Int(1)),
                Op::Jump(0),
                Op::Print(Operand::Int(2)),
            ]
        );
    }

    #[test]
    fn variables_share_slots() {
        let program = parse("set a to b + a\nprint a\n").program.unwrap();
        let code = compile(&program);
        assert_eq!(code.names, ["a", "b"]);
        assert_eq!(
            code.instrs.first().map(|instr| instr.op),
            Some(Op::Set(
                0,
                Calc::Binary(BinOp::Add, Operand::Var(1), Operand::Var(0))
            ))
        );
    }
}
