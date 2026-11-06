use super::FULL_TURN;
use crate::diagnostics::{DiagCode, Diagnostic, Fix, TextEdit, messages};
use crate::map::Cell;
use crate::source::LineIndex;
use crate::syntax::ast::{ElseBranch, Expr, Ident, LineNode, Program, Simple, Stmt, StmtKind};

pub(super) fn check(program: &Program, index: &LineIndex<'_>) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    program.for_each_line(|node, _| match node {
        LineNode::Statement(stmt) => diagnostics.extend(statement(stmt, index)),
        LineNode::Else(branch) => diagnostics.extend(empty_else(branch)),
    });
    diagnostics
}

fn statement(stmt: &Stmt, index: &LineIndex<'_>) -> Vec<Diagnostic> {
    let mut found: Vec<Diagnostic> = stmt.kind.operands().filter_map(leading_zero).collect();
    let rules = match &stmt.kind {
        StmtKind::If {
            cond, then_body, ..
        } => [
            non_bool_literal(cond),
            empty_block(stmt, then_body, messages::EMPTY_IF_BLOCK),
        ],
        StmtKind::While { cond, body } => [
            non_bool_literal(cond),
            empty_block(stmt, body, messages::EMPTY_WHILE_BLOCK),
        ],
        StmtKind::Set { name, value } => [
            isthere_range(value),
            self_assignment(stmt, name, value, index),
        ],
        StmtKind::Step { count } => [zero_step(stmt, count, index), None],
        StmtKind::Turn { quarters } => [turn(stmt, quarters, index), None],
        StmtKind::Mine | StmtKind::Print { .. } => [None, None],
    };
    found.extend(rules.into_iter().flatten());
    found
}

fn leading_zero(operand: &Simple) -> Option<Diagnostic> {
    let Simple::Int { value, span } = operand else {
        return None;
    };
    let written = usize::try_from(span.to.saturating_sub(span.from)).ok()?;
    (written > decimal_width(*value)).then(|| {
        let canonical = value.to_string();
        let original = format!("{value:0written$}");
        Diagnostic::new(DiagCode::LintLeadingZero, *span)
            .with_message(messages::leading_zero(&original, *value))
            .with_fix(Fix::single(
                messages::replace_with(&canonical),
                TextEdit::new(span.from, span.to, canonical.clone()),
            ))
    })
}

fn decimal_width(value: i64) -> usize {
    let digits = value
        .unsigned_abs()
        .checked_ilog10()
        .map_or(1, |log| log as usize + 1);
    digits + usize::from(value < 0)
}

fn non_bool_literal(cond: &Simple) -> Option<Diagnostic> {
    match cond {
        Simple::Int { value, span } => Some(
            Diagnostic::new(DiagCode::LintNonBoolLiteralCondition, *span)
                .with_message(messages::non_bool_literal_condition(*value)),
        ),
        Simple::Bool { .. } | Simple::Ident { .. } => None,
    }
}

fn empty_block(stmt: &Stmt, body: &[Stmt], message: &str) -> Option<Diagnostic> {
    body.is_empty()
        .then(|| Diagnostic::new(DiagCode::LintEmptyBlock, stmt.span).with_message(message))
}

fn empty_else(branch: &ElseBranch) -> Option<Diagnostic> {
    branch.body.is_empty().then(|| {
        Diagnostic::new(DiagCode::LintEmptyBlock, branch.span)
            .with_message(messages::EMPTY_ELSE_BLOCK)
    })
}

fn isthere_range(value: &Expr) -> Option<Diagnostic> {
    let Expr::IsThere { arg } = value else {
        return None;
    };
    let found = match arg {
        Simple::Int { value, .. } if Cell::from_probe_code(*value).is_none() => value.to_string(),
        Simple::Bool { value, .. } => value.to_string(),
        Simple::Int { .. } | Simple::Ident { .. } => return None,
    };
    Some(
        Diagnostic::new(DiagCode::LintIsthereRange, arg.span())
            .with_message(messages::isthere_range(&found)),
    )
}

fn self_assignment(
    stmt: &Stmt,
    name: &Ident,
    value: &Expr,
    index: &LineIndex<'_>,
) -> Option<Diagnostic> {
    match value {
        Expr::Simple {
            value: Simple::Ident { name: source, .. },
        } if *source == name.name => Some(noop(stmt, messages::noop_set(&name.name), index)),
        _ => None,
    }
}

fn zero_step(stmt: &Stmt, count: &Simple, index: &LineIndex<'_>) -> Option<Diagnostic> {
    matches!(count, Simple::Int { value: 0, .. })
        .then(|| noop(stmt, messages::NOOP_STEP.to_owned(), index))
}

fn turn(stmt: &Stmt, quarters: &Simple, index: &LineIndex<'_>) -> Option<Diagnostic> {
    let Simple::Int { value, span } = quarters else {
        return None;
    };
    let reduced = value % FULL_TURN;
    if reduced == 0 {
        return Some(noop(stmt, messages::noop_turn(*value), index));
    }
    (*value >= FULL_TURN).then(|| {
        Diagnostic::new(DiagCode::LintTurnMod4, *span)
            .with_message(messages::turn_mod4(*value, reduced))
            .with_fix(Fix::single(
                messages::replace_with(&format!("turn by {reduced}")),
                TextEdit::new(span.from, span.to, reduced.to_string()),
            ))
    })
}

fn noop(stmt: &Stmt, message: String, index: &LineIndex<'_>) -> Diagnostic {
    Diagnostic::new(DiagCode::LintNoop, stmt.span)
        .with_message(message)
        .with_fixes(Fix::removing_lines(index, stmt.line, stmt.line))
}

#[cfg(test)]
mod tests {
    use super::decimal_width;

    #[test]
    fn decimal_width_matches_the_printed_length() {
        for value in [0, 1, 9, 10, 99, 100, 101, -1, -10, i64::MAX, i64::MIN] {
            assert_eq!(decimal_width(value), value.to_string().len(), "{value}");
        }
    }
}
