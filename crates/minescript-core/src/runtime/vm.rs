use super::robot::RobotState;
use super::trace::{Outcome, RunResult};
use crate::diagnostics::{Diagnostic, has_errors};
use crate::map::{Map, parse_map};
use crate::syntax::ast::Program;
use crate::syntax::parse;

pub fn run(src: &str, map: &Map) -> RunResult {
    let start = RobotState::start_of(map);
    let parsed = parse(src);
    match parsed.program {
        Some(program) if !has_errors(&parsed.diagnostics) => execute(&program, start),
        _ => RunResult::not_started(
            start,
            Outcome::SyntaxError {
                diagnostics: parsed.diagnostics,
            },
        ),
    }
}

pub fn run_with_map_text(src: &str, map_text: &str) -> Result<RunResult, Vec<Diagnostic>> {
    let parsed = parse_map(map_text);
    match parsed.map {
        Some(map) => Ok(run(src, &map)),
        None => Err(parsed.diagnostics),
    }
}

fn execute(program: &Program, start: RobotState) -> RunResult {
    let _ = program;
    RunResult::not_started(start, Outcome::Ok)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tiny_map() -> Map {
        parse_map("1 1\n>").map.unwrap()
    }

    #[test]
    fn empty_program_finishes_with_zero_steps() {
        let result = run("", &tiny_map());
        assert!(result.is_ok());
        assert_eq!(result.steps, 0);
        assert!(result.events.is_empty());
    }

    #[test]
    fn syntax_errors_prevent_running() {
        let result = run("Step forward 1", &tiny_map());
        assert!(result.is_syntax_error());
        assert_eq!(result.steps, 0);
    }

    #[test]
    fn invalid_map_text_returns_map_diagnostics() {
        let error = run_with_map_text("", "").unwrap_err();
        assert!(!error.is_empty());
    }
}
