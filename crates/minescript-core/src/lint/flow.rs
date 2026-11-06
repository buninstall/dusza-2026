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

enum After<'p> {
    Root,
    Result,
    Then {
        else_branch: Option<&'p ElseBranch>,
        assigned: Assigned<'p>,
    },
    Meet(Flow<'p>),
    Replace(Flow<'p>),
}

struct Frame<'p> {
    rest: &'p [Stmt],
    flow: Flow<'p>,
    after: After<'p>,
}

impl<'p> Frame<'p> {
    fn new(rest: &'p [Stmt], assigned: Assigned<'p>, after: After<'p>) -> Self {
        Self {
            rest,
            flow: Flow::Live(assigned),
            after,
        }
    }
}

enum Step<'p> {
    Done(Flow<'p>),
    Enter(Frame<'p>),
}

pub(super) fn check(program: &Program) -> Vec<Diagnostic> {
    let mut analysis = Analysis {
        assigned_anywhere: assignments(program)
            .iter()
            .map(|assignment| assignment.name.name.as_str())
            .collect(),
        findings: Vec::new(),
    };
    analysis.run(&program.body);
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
    fn run(&mut self, body: &'p [Stmt]) {
        let mut frames = vec![Frame::new(body, Assigned::new(), After::Root)];
        while let Some(frame) = frames.last_mut() {
            if let Some((stmt, rest)) = frame.rest.split_first() {
                frame.rest = rest;
                let flow = std::mem::replace(&mut frame.flow, Flow::Dead);
                match self.statement(stmt, flow) {
                    Step::Done(result) => frame.flow = result,
                    Step::Enter(child) => frames.push(child),
                }
                continue;
            }
            let Some(finished) = frames.pop() else {
                return;
            };
            let result = match finished.after {
                After::Root => return,
                After::Result => finished.flow,
                After::Then {
                    else_branch: Some(branch),
                    assigned,
                } => {
                    frames.push(Frame::new(
                        &branch.body,
                        assigned,
                        After::Meet(finished.flow),
                    ));
                    continue;
                }
                After::Then {
                    else_branch: None,
                    assigned,
                } => finished.flow.meet(Flow::Live(assigned)),
                After::Meet(taken) => taken.meet(finished.flow),
                After::Replace(flow) => flow,
            };
            if let Some(parent) = frames.last_mut() {
                parent.flow = result;
            }
        }
    }

    fn statement(&mut self, stmt: &'p Stmt, flow: Flow<'p>) -> Step<'p> {
        let Flow::Live(mut assigned) = flow else {
            return Step::Done(Flow::Dead);
        };
        for operand in stmt.kind.operands() {
            self.read(operand, &mut assigned);
        }
        match &stmt.kind {
            StmtKind::Set { name, .. } => {
                assigned.insert(name.name.as_str());
                Step::Done(Flow::Live(assigned))
            }
            StmtKind::If {
                cond,
                then_body,
                else_branch,
            } => branch(cond, then_body, else_branch.as_ref(), assigned),
            StmtKind::While { cond, body } => loop_over(cond, body, assigned),
            StmtKind::Step { .. }
            | StmtKind::Turn { .. }
            | StmtKind::Mine
            | StmtKind::Print { .. } => Step::Done(Flow::Live(assigned)),
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

fn branch<'p>(
    cond: &Simple,
    then_body: &'p [Stmt],
    else_branch: Option<&'p ElseBranch>,
    assigned: Assigned<'p>,
) -> Step<'p> {
    match (constant_condition(cond), else_branch) {
        (Some(true), _) => Step::Enter(Frame::new(then_body, assigned, After::Result)),
        (Some(false), Some(branch)) => {
            Step::Enter(Frame::new(&branch.body, assigned, After::Result))
        }
        (Some(false), None) => Step::Done(Flow::Live(assigned)),
        (None, _) => Step::Enter(Frame::new(
            then_body,
            assigned.clone(),
            After::Then {
                else_branch,
                assigned,
            },
        )),
    }
}

fn loop_over<'p>(cond: &Simple, body: &'p [Stmt], assigned: Assigned<'p>) -> Step<'p> {
    match constant_condition(cond) {
        Some(false) => Step::Done(Flow::Live(assigned)),
        Some(true) => Step::Enter(Frame::new(body, assigned, After::Replace(Flow::Dead))),
        None => Step::Enter(Frame::new(
            body,
            assigned.clone(),
            After::Replace(Flow::Live(assigned)),
        )),
    }
}
