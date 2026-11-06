use std::collections::{BTreeMap, BTreeSet};

use crate::diagnostics::messages;
use crate::runtime::ValueType;
use crate::syntax::ast::{BinOp, Expr, Ident, LineNode, Program, Simple, Stmt, StmtKind};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VariableInfo {
    pub first_line: u32,
    pub value_type: Option<ValueType>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum StaticType<'p> {
    Known(ValueType),
    SameAs(&'p str),
    Unknown,
}

pub(super) struct Assignment<'p> {
    pub stmt: &'p Stmt,
    pub name: &'p Ident,
    pub value: &'p Expr,
}

pub(super) type FirstAssignments<'a, 'p> = BTreeMap<&'p str, &'a Assignment<'p>>;

pub(super) fn assignments(program: &Program) -> Vec<Assignment<'_>> {
    let mut found = Vec::new();
    program.for_each_line(|node, _| {
        if let LineNode::Statement(
            stmt @ Stmt {
                kind: StmtKind::Set { name, value },
                ..
            },
        ) = node
        {
            found.push(Assignment { stmt, name, value });
        }
    });
    found
}

pub(super) fn first_assignments<'a, 'p>(all: &'a [Assignment<'p>]) -> FirstAssignments<'a, 'p> {
    let mut first = BTreeMap::new();
    for assignment in all {
        first
            .entry(assignment.name.name.as_str())
            .or_insert(assignment);
    }
    first
}

pub(super) fn static_type(expr: &Expr) -> StaticType<'_> {
    match expr {
        Expr::Simple { value } => simple_type(value),
        Expr::IsThere { .. } | Expr::Not { .. } => StaticType::Known(ValueType::Bool),
        Expr::Binary { op, .. } => StaticType::Known(result_type(*op)),
    }
}

fn simple_type(simple: &Simple) -> StaticType<'_> {
    match simple {
        Simple::Int { .. } => StaticType::Known(ValueType::Int),
        Simple::Bool { .. } => StaticType::Known(ValueType::Bool),
        Simple::Ident { name, .. } => StaticType::SameAs(name),
    }
}

fn result_type(op: BinOp) -> ValueType {
    match op {
        BinOp::Add | BinOp::Sub | BinOp::Mul => ValueType::Int,
        BinOp::Eq
        | BinOp::Ne
        | BinOp::Lt
        | BinOp::Le
        | BinOp::Gt
        | BinOp::Ge
        | BinOp::And
        | BinOp::Or => ValueType::Bool,
    }
}

pub(super) fn resolve(
    start: StaticType<'_>,
    first: &FirstAssignments<'_, '_>,
) -> Option<ValueType> {
    let mut current = start;
    let mut followed = BTreeSet::new();
    loop {
        match current {
            StaticType::Known(value_type) => return Some(value_type),
            StaticType::Unknown => return None,
            StaticType::SameAs(name) => {
                if !followed.insert(name) {
                    return None;
                }
                current = first.get(name).map_or(StaticType::Unknown, |assignment| {
                    static_type(assignment.value)
                });
            }
        }
    }
}

pub fn type_name(value_type: ValueType) -> &'static str {
    match value_type {
        ValueType::Int => messages::TYPE_INT,
        ValueType::Bool => messages::TYPE_BOOL,
    }
}

pub fn variable_types(program: &Program) -> BTreeMap<&str, VariableInfo> {
    let all = assignments(program);
    let first = first_assignments(&all);
    first
        .iter()
        .map(|(name, assignment)| {
            let info = VariableInfo {
                first_line: assignment.stmt.line,
                value_type: resolve(static_type(assignment.value), &first),
            };
            (*name, info)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::syntax::parse;

    fn types_of(src: &str) -> BTreeMap<String, VariableInfo> {
        let program = parse(src).program.unwrap();
        variable_types(&program)
            .into_iter()
            .map(|(name, info)| (name.to_owned(), info))
            .collect()
    }

    #[test]
    fn literal_and_operator_types_are_known() {
        let types = types_of(
            "set a to 1\nset b to true\nset c to isThere 0\nset d to not b\nset e to a * 2\nset f to a < 2",
        );
        let kinds: Vec<Option<ValueType>> = ["a", "b", "c", "d", "e", "f"]
            .iter()
            .map(|name| types[*name].value_type)
            .collect();
        assert_eq!(
            kinds,
            vec![
                Some(ValueType::Int),
                Some(ValueType::Bool),
                Some(ValueType::Bool),
                Some(ValueType::Bool),
                Some(ValueType::Int),
                Some(ValueType::Bool)
            ]
        );
    }

    #[test]
    fn aliases_follow_first_assignments() {
        let types = types_of("set a to b\nset b to c\nset c to 5\nset a to true");
        assert_eq!(types["a"].value_type, Some(ValueType::Int));
        assert_eq!(types["a"].first_line, 1);
        assert_eq!(types["b"].first_line, 2);
    }

    #[test]
    fn cycles_and_unknown_names_stay_unknown() {
        let types = types_of("set a to b\nset b to a\nset c to d");
        assert_eq!(types["a"].value_type, None);
        assert_eq!(types["b"].value_type, None);
        assert_eq!(types["c"].value_type, None);
    }

    #[test]
    fn type_names_are_hungarian() {
        assert_eq!(type_name(ValueType::Int), "egész");
        assert_eq!(type_name(ValueType::Bool), "logikai");
    }
}
