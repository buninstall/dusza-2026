use super::machine::execute;
use super::robot::RobotState;
use super::trace::{Outcome, RunResult};
use crate::diagnostics::Diagnostic;
use crate::map::{Map, map_only};
use crate::syntax::ast::Program;
use crate::syntax::parse;

pub fn run(src: &str, map: &Map) -> RunResult {
    let parsed = parse(src);
    match parsed.program {
        Some(program) => run_program(&program, map),
        None => RunResult::not_started(
            RobotState::start_of(map),
            Outcome::SyntaxError {
                diagnostics: parsed.diagnostics,
            },
        ),
    }
}

pub fn run_program(program: &Program, map: &Map) -> RunResult {
    execute(program, map)
}

pub fn run_with_map_text(src: &str, map_text: &str) -> Result<RunResult, Vec<Diagnostic>> {
    map_only(map_text).map(|map| run(src, &map))
}

#[cfg(test)]
mod tests;
