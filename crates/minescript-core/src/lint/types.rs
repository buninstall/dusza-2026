use std::collections::BTreeMap;

use super::names::Names;
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Resolution {
    Pending,
    InProgress,
    Done(Option<ValueType>),
}

pub(super) struct Types<'a, 'p> {
    names: &'a Names<'p>,
    first: Vec<Option<&'a Assignment<'p>>>,
    resolved: Vec<Resolution>,
}

impl<'a, 'p> Types<'a, 'p> {
    pub fn new(names: &'a Names<'p>, all: &'a [Assignment<'p>]) -> Self {
        let mut first = vec![None; names.len()];
        for assignment in all {
            if let Some(slot) = names
                .id(&assignment.name.name)
                .and_then(|id| first.get_mut(id))
            {
                slot.get_or_insert(assignment);
            }
        }
        Self {
            names,
            resolved: vec![Resolution::Pending; first.len()],
            first,
        }
    }

    pub fn first(&self, name: &str) -> Option<&'a Assignment<'p>> {
        self.first.get(self.names.id(name)?).copied().flatten()
    }

    pub fn first_assignments(&self) -> impl Iterator<Item = (&'p str, &'a Assignment<'p>)> + '_ {
        self.names
            .spellings()
            .iter()
            .zip(&self.first)
            .filter_map(|(name, first)| Some((*name, (*first)?)))
    }

    pub fn resolve(&mut self, start: StaticType<'_>) -> Option<ValueType> {
        match start {
            StaticType::Known(value_type) => Some(value_type),
            StaticType::Unknown => None,
            StaticType::SameAs(name) => self.variable(self.names.id(name)?),
        }
    }

    fn variable(&mut self, start: usize) -> Option<ValueType> {
        let mut chain = Vec::new();
        let mut current = start;
        let result = loop {
            match self.resolved.get(current).copied() {
                Some(Resolution::Done(result)) => break result,
                Some(Resolution::InProgress) | None => break None,
                Some(Resolution::Pending) => {}
            }
            if let Some(slot) = self.resolved.get_mut(current) {
                *slot = Resolution::InProgress;
            }
            chain.push(current);
            let next = self
                .first
                .get(current)
                .copied()
                .flatten()
                .map_or(StaticType::Unknown, |assignment| {
                    static_type(assignment.value)
                });
            match next {
                StaticType::Known(value_type) => break Some(value_type),
                StaticType::Unknown => break None,
                StaticType::SameAs(name) => match self.names.id(name) {
                    Some(id) => current = id,
                    None => break None,
                },
            }
        };
        for id in chain {
            if let Some(slot) = self.resolved.get_mut(id) {
                *slot = Resolution::Done(result);
            }
        }
        result
    }
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

pub fn type_name(value_type: ValueType) -> &'static str {
    match value_type {
        ValueType::Int => messages::TYPE_INT,
        ValueType::Bool => messages::TYPE_BOOL,
    }
}

pub fn variable_types(program: &Program) -> BTreeMap<&str, VariableInfo> {
    let names = Names::of(program);
    let all = assignments(program);
    let mut types = Types::new(&names, &all);
    let firsts: Vec<(&str, &Assignment<'_>)> = types.first_assignments().collect();
    firsts
        .into_iter()
        .map(|(name, assignment)| {
            let info = VariableInfo {
                first_line: assignment.stmt.line,
                value_type: types.resolve(static_type(assignment.value)),
            };
            (name, info)
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
