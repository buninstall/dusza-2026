mod flow;
mod sequences;
mod statements;
mod types;
mod variables;

use crate::diagnostics::Diagnostic;
use crate::source::{LineIndex, normalize};
use crate::syntax::ast::Program;

pub use types::{VariableInfo, type_name, variable_types};

const FULL_TURN: i64 = 4;

pub fn lint(program: &Program, source: &str) -> Vec<Diagnostic> {
    let text = normalize(source);
    let index = LineIndex::new(&text);
    let mut diagnostics = statements::check(program, &index);
    diagnostics.extend(sequences::check(program, &index));
    diagnostics.extend(variables::check(program));
    diagnostics.extend(flow::check(program));
    diagnostics.sort_by_key(|diagnostic| (diagnostic.span.line, diagnostic.span.col_start));
    diagnostics
}

#[cfg(test)]
mod tests;
