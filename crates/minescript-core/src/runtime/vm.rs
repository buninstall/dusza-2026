use super::machine::execute;
use super::robot::RobotState;
use super::trace::{Outcome, RunResult};
use crate::diagnostics::Diagnostic;
use crate::map::{Map, parse_map};
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
    let parsed = parse_map(map_text);
    match parsed.map {
        Some(map) => Ok(run(src, &map)),
        None => Err(parsed.diagnostics),
    }
}

#[cfg(test)]
mod tests;
