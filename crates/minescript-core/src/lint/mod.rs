mod flow;
mod names;
mod sequences;
mod statements;
mod types;
mod variables;

use self::names::Names;
use crate::diagnostics::Diagnostic;
use crate::source::{LineIndex, normalized};
use crate::syntax::ast::Program;

pub use types::{VariableInfo, type_name, variable_types};

const FULL_TURN: i64 = 4;

pub fn lint(program: &Program, source: &str) -> Vec<Diagnostic> {
    let text = normalized(source);
    lint_indexed(program, &LineIndex::new(&text))
}

pub(crate) fn lint_indexed(program: &Program, index: &LineIndex<'_>) -> Vec<Diagnostic> {
    let names = Names::of(program);
    let mut diagnostics = statements::check(program, index);
    diagnostics.extend(sequences::check(program, index));
    diagnostics.extend(variables::check(program, &names));
    diagnostics.extend(flow::check(program, &names));
    diagnostics.sort_by_key(|diagnostic| (diagnostic.span.line, diagnostic.span.col_start));
    diagnostics
}

#[cfg(test)]
mod tests;
