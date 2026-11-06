use std::collections::BTreeSet;

use super::types::assignments;
use crate::diagnostics::{DiagCode, Diagnostic, messages};
use crate::syntax::ast::{ElseBranch, Program, Simple, Stmt, StmtKind};

type Assigned<'p> = BTreeSet<&'p str>;

#[derive(Debug, Clone, PartialEq, Eq)]
enum Flow<'p> {
    Live(Assigned<'p>),
    Dead,
}

impl Flow<'_> {
    fn meet(self, other: Self) -> Self {
        match (self, other) {
            (Self::Dead, flow) | (flow, Self::Dead) => flow,
            (Self::Live(left), Self::Live(right)) => {
                Self::Live(left.intersection(&right).copied().collect())
            }
        }
    }
}

pub(super) fn check(program: &Program) -> Vec<Diagnostic> {
    let mut analysis = Analysis {
        assigned_anywhere: assignments(program)
            .iter()
            .map(|assignment| assignment.name.name.as_str())
            .collect(),
        findings: Vec::new(),
    };
    analysis.block(&program.body, Flow::Live(Assigned::new()));
    analysis.findings
}

fn constant_condition(cond: &Simple) -> Option<bool> {
    match cond {
        Simple::Bool { value, .. } => Some(*value),
        Simple::Int { .. } | Simple::Ident { .. } => None,
    }
}

struct Analysis<'p> {
    assigned_anywhere: Assigned<'p>,
    findings: Vec<Diagnostic>,
}

impl<'p> Analysis<'p> {
    fn block(&mut self, body: &'p [Stmt], flow: Flow<'p>) -> Flow<'p> {
        body.iter()
            .fold(flow, |flow, stmt| self.statement(stmt, flow))
    }

    fn statement(&mut self, stmt: &'p Stmt, flow: Flow<'p>) -> Flow<'p> {
        let Flow::Live(mut assigned) = flow else {
            return Flow::Dead;
        };
        for operand in stmt.kind.operands() {
            self.read(operand, &mut assigned);
        }
        match &stmt.kind {
            StmtKind::Set { name, .. } => {
                assigned.insert(name.name.as_str());
                Flow::Live(assigned)
            }
            StmtKind::If {
                cond,
                then_body,
                else_branch,
            } => self.branch(cond, then_body, else_branch.as_ref(), assigned),
            StmtKind::While { cond, body } => self.loop_over(cond, body, assigned),
            StmtKind::Step { .. }
            | StmtKind::Turn { .. }
            | StmtKind::Mine
            | StmtKind::Print { .. } => Flow::Live(assigned),
        }
    }

    fn branch(
        &mut self,
        cond: &Simple,
        then_body: &'p [Stmt],
        else_branch: Option<&'p ElseBranch>,
        assigned: Assigned<'p>,
    ) -> Flow<'p> {
        match constant_condition(cond) {
            Some(true) => self.block(then_body, Flow::Live(assigned)),
            Some(false) => self.otherwise(else_branch, assigned),
            None => {
                let taken = self.block(then_body, Flow::Live(assigned.clone()));
                taken.meet(self.otherwise(else_branch, assigned))
            }
        }
    }

    fn otherwise(
        &mut self,
        else_branch: Option<&'p ElseBranch>,
        assigned: Assigned<'p>,
    ) -> Flow<'p> {
        match else_branch {
            Some(branch) => self.block(&branch.body, Flow::Live(assigned)),
            None => Flow::Live(assigned),
        }
    }

    fn loop_over(&mut self, cond: &Simple, body: &'p [Stmt], assigned: Assigned<'p>) -> Flow<'p> {
        match constant_condition(cond) {
            Some(false) => Flow::Live(assigned),
            Some(true) => {
                self.block(body, Flow::Live(assigned));
                Flow::Dead
            }
            None => {
                self.block(body, Flow::Live(assigned.clone()));
                Flow::Live(assigned)
            }
        }
    }

    fn read(&mut self, operand: &'p Simple, assigned: &mut Assigned<'p>) {
        let Simple::Ident { name, span } = operand else {
            return;
        };
        if !assigned.insert(name.as_str()) {
            return;
        }
        let message = if self.assigned_anywhere.contains(name.as_str()) {
            messages::maybe_uninit(name)
        } else {
            messages::never_assigned(name)
        };
        self.findings
            .push(Diagnostic::new(DiagCode::LintMaybeUninit, *span).with_message(message));
    }
}
