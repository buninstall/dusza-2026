use std::collections::{BTreeMap, BTreeSet};

use super::types::{assignments, first_assignments, resolve, static_type, type_name};
use crate::diagnostics::{DiagCode, Diagnostic, messages};
use crate::span::Span;
use crate::syntax::ast::{LineNode, Program, Simple, StmtKind};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Role {
    Assigned,
    Read,
}

struct Occurrence<'p> {
    name: &'p str,
    span: Span,
    role: Role,
}

pub(super) fn check(program: &Program) -> Vec<Diagnostic> {
    let occurrences = occurrences(program);
    let mut diagnostics = unused_variables(&occurrences);
    diagnostics.extend(case_collisions(&occurrences));
    diagnostics.extend(type_changes(program));
    diagnostics
}

fn occurrences(program: &Program) -> Vec<Occurrence<'_>> {
    let mut found = Vec::new();
    program.for_each_line(|node, _| {
        let LineNode::Statement(stmt) = node else {
            return;
        };
        if let StmtKind::Set { name, .. } = &stmt.kind {
            found.push(Occurrence {
                name: &name.name,
                span: name.span,
                role: Role::Assigned,
            });
        }
        for operand in stmt.kind.operands() {
            if let Simple::Ident { name, span } = operand {
                found.push(Occurrence {
                    name,
                    span: *span,
                    role: Role::Read,
                });
            }
        }
    });
    found
}

fn unused_variables(occurrences: &[Occurrence<'_>]) -> Vec<Diagnostic> {
    let read: BTreeSet<&str> = occurrences
        .iter()
        .filter(|occurrence| occurrence.role == Role::Read)
        .map(|occurrence| occurrence.name)
        .collect();
    let mut reported = BTreeSet::new();
    occurrences
        .iter()
        .filter(|occurrence| {
            occurrence.role == Role::Assigned
                && !read.contains(occurrence.name)
                && reported.insert(occurrence.name)
        })
        .map(|occurrence| {
            Diagnostic::new(DiagCode::LintUnusedVar, occurrence.span)
                .with_message(messages::unused_var(occurrence.name))
        })
        .collect()
}

fn case_collisions(occurrences: &[Occurrence<'_>]) -> Vec<Diagnostic> {
    let mut first_spelling: BTreeMap<String, &str> = BTreeMap::new();
    let mut reported = BTreeSet::new();
    let mut diagnostics = Vec::new();
    for occurrence in occurrences {
        let first = *first_spelling
            .entry(occurrence.name.to_ascii_lowercase())
            .or_insert(occurrence.name);
        if first != occurrence.name && reported.insert(occurrence.name) {
            diagnostics.push(
                Diagnostic::new(DiagCode::LintCaseCollision, occurrence.span)
                    .with_message(messages::case_collision(occurrence.name, first)),
            );
        }
    }
    diagnostics
}

fn type_changes(program: &Program) -> Vec<Diagnostic> {
    let all = assignments(program);
    let first = first_assignments(&all);
    all.iter()
        .filter_map(|assignment| {
            let name = assignment.name.name.as_str();
            let reference = first.get(name)?;
            if reference.stmt.line == assignment.stmt.line {
                return None;
            }
            let fixed = resolve(static_type(reference.value), &first)?;
            let assigned = resolve(static_type(assignment.value), &first)?;
            (fixed != assigned).then(|| {
                Diagnostic::new(DiagCode::LintTypeChange, assignment.stmt.span).with_message(
                    messages::type_change(
                        name,
                        type_name(assigned),
                        type_name(fixed),
                        reference.stmt.line,
                    ),
                )
            })
        })
        .collect()
}
