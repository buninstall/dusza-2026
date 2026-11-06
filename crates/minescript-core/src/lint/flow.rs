use super::names::{NameSet, Names};
use super::types::assignments;
use crate::diagnostics::{DiagCode, Diagnostic, messages};
use crate::syntax::ast::{ElseBranch, Program, Simple, Stmt, StmtKind};

type Assigned = NameSet;

#[derive(Debug, Clone, PartialEq, Eq)]
enum Flow {
    Live(Assigned),
    Dead,
}

impl Flow {
    fn meet(self, other: Self) -> Self {
        match (self, other) {
            (Self::Dead, flow) | (flow, Self::Dead) => flow,
            (Self::Live(mut left), Self::Live(right)) => {
                left.intersect(&right);
                Self::Live(left)
            }
        }
    }
}

enum After<'p> {
    Root,
    Result,
    Then {
        else_branch: Option<&'p ElseBranch>,
        assigned: Assigned,
    },
    Meet(Flow),
    Replace(Flow),
}

struct Frame<'p> {
    rest: &'p [Stmt],
    flow: Flow,
    after: After<'p>,
}

impl<'p> Frame<'p> {
    fn new(rest: &'p [Stmt], assigned: Assigned, after: After<'p>) -> Self {
        Self {
            rest,
            flow: Flow::Live(assigned),
            after,
        }
    }
}

enum Step<'p> {
    Done(Flow),
    Enter(Frame<'p>),
}

pub(super) fn check(program: &Program, names: &Names<'_>) -> Vec<Diagnostic> {
    let mut assigned_anywhere = names.set();
    for assignment in assignments(program) {
        if let Some(id) = names.id(&assignment.name.name) {
            assigned_anywhere.insert(id);
        }
    }
    let mut analysis = Analysis {
        names,
        assigned_anywhere,
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

struct Analysis<'n, 'p> {
    names: &'n Names<'p>,
    assigned_anywhere: Assigned,
    findings: Vec<Diagnostic>,
}

impl<'p> Analysis<'_, '_> {
    fn run(&mut self, body: &'p [Stmt]) {
        let mut frames = vec![Frame::new(body, self.names.set(), After::Root)];
        while let Some(mut frame) = frames.pop() {
            if let Some((stmt, rest)) = frame.rest.split_first() {
                frame.rest = rest;
                let flow = std::mem::replace(&mut frame.flow, Flow::Dead);
                match self.statement(stmt, flow) {
                    Step::Done(result) => {
                        frame.flow = result;
                        frames.push(frame);
                    }
                    Step::Enter(child) => {
                        frames.push(frame);
                        frames.push(child);
                    }
                }
                continue;
            }
            let finished = frame;
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

    fn statement(&mut self, stmt: &'p Stmt, flow: Flow) -> Step<'p> {
        let Flow::Live(mut assigned) = flow else {
            return Step::Done(Flow::Dead);
        };
        for operand in stmt.kind.operands() {
            self.read(operand, &mut assigned);
        }
        match &stmt.kind {
            StmtKind::Set { name, .. } => {
                if let Some(id) = self.names.id(&name.name) {
                    assigned.insert(id);
                }
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

    fn read(&mut self, operand: &Simple, assigned: &mut Assigned) {
        let Simple::Ident { name, span } = operand else {
            return;
        };
        let Some(id) = self.names.id(name) else {
            return;
        };
        if !assigned.insert(id) {
            return;
        }
        let message = if self.assigned_anywhere.contains(id) {
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
    assigned: Assigned,
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

fn loop_over<'p>(cond: &Simple, body: &'p [Stmt], assigned: Assigned) -> Step<'p> {
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
