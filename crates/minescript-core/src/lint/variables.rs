use super::names::{NameMap, Names};
use super::types::{Assignment, Types, assignments, static_type, type_name};
use crate::diagnostics::{DiagCode, Diagnostic, messages};
use crate::span::Span;
use crate::syntax::ast::{LineNode, Program, Simple, StmtKind};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Role {
    Assigned,
    Read,
}

struct Occurrence<'p> {
    id: usize,
    name: &'p str,
    span: Span,
    role: Role,
}

pub(super) fn check(program: &Program, names: &Names<'_>) -> Vec<Diagnostic> {
    let occurrences = occurrences(program, names);
    let mut diagnostics = unused_variables(&occurrences, names);
    diagnostics.extend(case_collisions(&occurrences, names));
    diagnostics.extend(type_changes(program, names));
    diagnostics
}

fn occurrences<'p>(program: &'p Program, names: &Names<'_>) -> Vec<Occurrence<'p>> {
    let mut found = Vec::new();
    let mut push = |name: &'p str, span: Span, role: Role| {
        if let Some(id) = names.id(name) {
            found.push(Occurrence {
                id,
                name,
                span,
                role,
            });
        }
    };
    program.for_each_line(|node, _| {
        let LineNode::Statement(stmt) = node else {
            return;
        };
        if let StmtKind::Set { name, .. } = &stmt.kind {
            push(&name.name, name.span, Role::Assigned);
        }
        for operand in stmt.kind.operands() {
            if let Simple::Ident { name, span } = operand {
                push(name, *span, Role::Read);
            }
        }
    });
    found
}

fn unused_variables(occurrences: &[Occurrence<'_>], names: &Names<'_>) -> Vec<Diagnostic> {
    let mut read = names.set();
    for occurrence in occurrences {
        if occurrence.role == Role::Read {
            read.insert(occurrence.id);
        }
    }
    let mut reported = names.set();
    occurrences
        .iter()
        .filter(|occurrence| {
            occurrence.role == Role::Assigned
                && !read.contains(occurrence.id)
                && reported.insert(occurrence.id)
        })
        .map(|occurrence| {
            Diagnostic::new(DiagCode::LintUnusedVar, occurrence.span)
                .with_message(messages::unused_var(occurrence.name))
        })
        .collect()
}

fn case_collisions(occurrences: &[Occurrence<'_>], names: &Names<'_>) -> Vec<Diagnostic> {
    let mut groups: NameMap<String, usize> = NameMap::default();
    let group_of: Vec<usize> = names
        .spellings()
        .iter()
        .map(|spelling| {
            let next = groups.len();
            *groups.entry(spelling.to_ascii_lowercase()).or_insert(next)
        })
        .collect();
    if groups.len() == names.len() {
        return Vec::new();
    }
    let mut first_spelling: Vec<Option<usize>> = vec![None; groups.len()];
    let mut reported = names.set();
    let mut diagnostics = Vec::new();
    for occurrence in occurrences {
        let Some(slot) = group_of
            .get(occurrence.id)
            .and_then(|group| first_spelling.get_mut(*group))
        else {
            continue;
        };
        let first = *slot.get_or_insert(occurrence.id);
        if first != occurrence.id && reported.insert(occurrence.id) {
            let first_name = names.spellings().get(first).copied().unwrap_or_default();
            diagnostics.push(
                Diagnostic::new(DiagCode::LintCaseCollision, occurrence.span)
                    .with_message(messages::case_collision(occurrence.name, first_name)),
            );
        }
    }
    diagnostics
}

fn type_changes(program: &Program, names: &Names<'_>) -> Vec<Diagnostic> {
    let all = assignments(program);
    let mut types = Types::new(names, &all);
    let mut diagnostics = Vec::new();
    for assignment in &all {
        if let Some(diagnostic) = type_change(assignment, &mut types) {
            diagnostics.push(diagnostic);
        }
    }
    diagnostics
}

fn type_change(assignment: &Assignment<'_>, types: &mut Types<'_, '_>) -> Option<Diagnostic> {
    let name = assignment.name.name.as_str();
    let reference = types.first(name)?;
    if reference.stmt.line == assignment.stmt.line {
        return None;
    }
    let fixed = types.resolve(static_type(reference.value))?;
    let assigned = types.resolve(static_type(assignment.value))?;
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
}
