use super::FULL_TURN;
use crate::diagnostics::{DiagCode, Diagnostic, Fix, TextEdit, messages};
use crate::source::LineIndex;
use crate::span::Span;
use crate::syntax::ast::{Program, Simple, Stmt, StmtKind};
use crate::syntax::lexeme::MAX_LITERAL;

const SHORTEST_RUN: usize = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Motion {
    Step,
    Turn,
}

#[derive(Debug, Clone, Copy)]
struct Movement<'p> {
    motion: Motion,
    amount: i64,
    literal: Span,
    stmt: &'p Stmt,
}

struct Run<'p> {
    motion: Motion,
    total: i64,
    first: Movement<'p>,
    last: &'p Stmt,
    count: usize,
}

impl<'p> Run<'p> {
    fn start(movement: Movement<'p>) -> Self {
        Self {
            motion: movement.motion,
            total: movement.amount,
            first: movement,
            last: movement.stmt,
            count: 1,
        }
    }

    fn absorbs(&self, movement: &Movement<'_>) -> bool {
        movement.motion == self.motion
            && (self.motion == Motion::Turn || self.total + movement.amount <= MAX_LITERAL)
    }

    fn extend(&mut self, movement: &Movement<'p>) {
        self.total = self.total.saturating_add(movement.amount);
        self.last = movement.stmt;
        self.count += 1;
    }
}

pub(super) fn check(program: &Program, index: &LineIndex<'_>) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    let mut pending: Vec<&[Stmt]> = vec![&program.body];
    while let Some(block) = pending.pop() {
        diagnostics.extend(runs(block).iter().filter_map(|run| merge_hint(run, index)));
        pending.extend(block.iter().flat_map(child_blocks));
    }
    diagnostics
}

fn child_blocks(stmt: &Stmt) -> Vec<&[Stmt]> {
    match &stmt.kind {
        StmtKind::If {
            then_body,
            else_branch,
            ..
        } => {
            let mut blocks = vec![then_body.as_slice()];
            blocks.extend(else_branch.iter().map(|branch| branch.body.as_slice()));
            blocks
        }
        StmtKind::While { body, .. } => vec![body.as_slice()],
        StmtKind::Step { .. }
        | StmtKind::Turn { .. }
        | StmtKind::Mine
        | StmtKind::Print { .. }
        | StmtKind::Set { .. } => Vec::new(),
    }
}

fn movement(stmt: &Stmt) -> Option<Movement<'_>> {
    let (motion, operand) = match &stmt.kind {
        StmtKind::Step { count } => (Motion::Step, count),
        StmtKind::Turn { quarters } => (Motion::Turn, quarters),
        _ => return None,
    };
    let Simple::Int { value, span } = operand else {
        return None;
    };
    let has_effect = match motion {
        Motion::Step => *value > 0,
        Motion::Turn => value % FULL_TURN != 0,
    };
    has_effect.then_some(Movement {
        motion,
        amount: *value,
        literal: *span,
        stmt,
    })
}

fn runs(block: &[Stmt]) -> Vec<Run<'_>> {
    let mut finished = Vec::new();
    let mut current: Option<Run<'_>> = None;
    for stmt in block {
        let next = movement(stmt);
        if let Some(run) = current.as_mut()
            && let Some(movement) = &next
            && run.absorbs(movement)
        {
            run.extend(movement);
            continue;
        }
        finished.extend(current.take());
        current = next.map(Run::start);
    }
    finished.extend(current);
    finished.retain(|run| run.count >= SHORTEST_RUN);
    finished
}

fn merge_hint(run: &Run<'_>, index: &LineIndex<'_>) -> Option<Diagnostic> {
    let (code, keywords, merged, message) = match run.motion {
        Motion::Step => (
            DiagCode::LintMergeSteps,
            "step forward",
            run.total,
            messages::merge_steps(run.count, run.total),
        ),
        Motion::Turn => {
            let merged = run.total % FULL_TURN;
            (
                DiagCode::LintMergeTurns,
                "turn by",
                merged,
                messages::merge_turns(run.count, merged),
            )
        }
    };
    let fix = if merged == 0 {
        Fix::removing_lines(index, run.first.stmt.line, run.last.line)?
    } else {
        Fix::new(
            messages::merged_into(&format!("{keywords} {merged}")),
            vec![
                TextEdit::new(
                    run.first.literal.from,
                    run.first.literal.to,
                    merged.to_string(),
                ),
                TextEdit::delete(run.first.stmt.span.to, run.last.span.to),
            ],
        )
    };
    Some(
        Diagnostic::new(code, run.first.stmt.span)
            .with_message(message)
            .with_fix(fix),
    )
}
