#![allow(clippy::unwrap_used, clippy::panic)]

use minescript_bench::{deep, large_broken, large_valid, messy, recipes, runtime_cases, unicode};
use minescript_core::{FormatOptions, Outcome, RuntimeErrorCode, format, parse, run_with_map_text};

#[test]
fn recipes_run_cleanly() {
    for case in recipes() {
        let result = run_with_map_text(&case.source, &case.map).unwrap();
        assert!(result.is_ok(), "{}: {:?}", case.name, result.outcome);
    }
}

#[test]
fn stress_programs_run_into_the_step_limit() {
    for case in runtime_cases() {
        let result = run_with_map_text(&case.source, &case.map).unwrap();
        match result.outcome {
            Outcome::RuntimeError { code, .. } => {
                assert_eq!(
                    code,
                    RuntimeErrorCode::InstructionCountLimitExceeded,
                    "{}",
                    case.name
                );
            }
            other => panic!("{}: {other:?}", case.name),
        }
        assert_eq!(result.events.len(), 1000, "{}", case.name);
    }
}

#[test]
fn generated_sources_have_the_intended_shape() {
    for source in [large_valid(2_000), deep(200)] {
        assert!(
            parse(&source).program.is_some(),
            "{:?}",
            parse(&source).diagnostics.first()
        );
    }
    assert_eq!(parse(&unicode(100)).diagnostics.len(), 200);
    assert!(parse(&large_broken(300)).diagnostics.len() >= 100);
    let tidy = format(&messy(500), &FormatOptions::default());
    assert!(tidy.changed && tidy.diagnostics.is_empty());
}
