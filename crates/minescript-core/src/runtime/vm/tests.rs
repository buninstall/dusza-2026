use super::*;
use crate::map::{Cell, Dir, Pos};
use crate::runtime::{Assignment, MAX_STEPS, RuntimeErrorCode, Value};

const SPEC_MAP: &str = "3 15\n....@..........\n.#############.\n.......@...>...\n";

const WALK_AND_MINE: &str = "set count to 0
set fal to isThere 1
set megy to not fal
while megy
    set arany to isThere 2
    if arany
        step forward 1
        mine here
        set count to count + 1
    else
        step forward 1
    set fal to isThere 1
    set megy to not fal
print count
";

fn map(text: &str) -> Map {
    parse_map(text).map.unwrap()
}

fn run_on(src: &str, map_text: &str) -> RunResult {
    run(src, &map(map_text))
}

fn error_of(result: &RunResult) -> (RuntimeErrorCode, u32) {
    match &result.outcome {
        Outcome::RuntimeError { code, line, .. } => (*code, *line),
        other => panic!("futásidejű hiba kell, kapott: {other:?}"),
    }
}

fn failure(src: &str, map_text: &str) -> (RuntimeErrorCode, u32) {
    error_of(&run_on(src, map_text))
}

const TINY: &str = "1 1\n>";

#[test]
fn empty_program_finishes_with_zero_steps() {
    let result = run("", &map(TINY));
    assert!(result.is_ok());
    assert_eq!(result.steps, 0);
    assert!(result.events.is_empty());
    assert_eq!(result.discovered, vec![Pos::new(0, 0)]);
}

#[test]
fn syntax_errors_prevent_running() {
    let result = run("set x to 1\nStep forward 1", &map(TINY));
    assert!(result.is_syntax_error());
    assert_eq!(result.steps, 0);
    assert!(result.events.is_empty());
    assert_eq!(result.discovered, vec![Pos::new(0, 0)]);
}

#[test]
fn invalid_map_text_returns_map_diagnostics() {
    let error = run_with_map_text("", "").unwrap_err();
    assert!(!error.is_empty());
    assert!(run_with_map_text("mine here", "1 2\n>@").is_ok());
}

#[test]
fn walk_and_mine_collects_the_corridor_gold() {
    let result = run_on(WALK_AND_MINE, "1 6\n>.@.@.\n");
    assert!(result.is_ok());
    assert_eq!(result.gold, 2);
    assert_eq!(result.console, vec!["2"]);
    assert_eq!(result.final_robot.pos, Pos::new(0, 5));
    let discovered: Vec<usize> = result.discovered.iter().map(|pos| pos.col).collect();
    assert_eq!(discovered, vec![0, 1, 2, 3, 4, 5]);
}

#[test]
fn walk_and_mine_trace_on_the_spec_map_is_stable() {
    insta::assert_json_snapshot!("walk_and_mine_trace", run_on(WALK_AND_MINE, SPEC_MAP));
}

#[test]
fn every_processed_line_has_exactly_one_event() {
    let result = run_on(WALK_AND_MINE, SPEC_MAP);
    assert_eq!(result.events.len(), usize::try_from(result.steps).unwrap());
    for (position, event) in result.events.iter().enumerate() {
        assert_eq!(usize::try_from(event.index).unwrap(), position);
        assert_eq!(event.steps, event.index + 1);
    }
    assert_eq!(result.events.last().unwrap().print.as_deref(), Some("0"));
}

#[test]
fn step_records_the_path_and_the_newly_discovered_cells() {
    let result = run_on("step forward 2\nturn by 2\nstep forward 1", "1 3\n>..");
    let first = &result.events[0];
    assert_eq!(first.path, vec![Pos::new(0, 1), Pos::new(0, 2)]);
    assert_eq!(first.discovered, first.path);
    assert_eq!(first.robot.pos, Pos::new(0, 2));
    let back = &result.events[2];
    assert_eq!(back.path, vec![Pos::new(0, 1)]);
    assert!(back.discovered.is_empty());
    assert_eq!(result.final_robot.dir, Dir::West);
}

#[test]
fn blocked_step_keeps_the_partial_path_and_the_last_valid_cell() {
    let result = run_on("step forward 5", "1 3\n>.#");
    assert_eq!(error_of(&result), (RuntimeErrorCode::EBedrockHit, 1));
    assert_eq!(result.steps, 1);
    assert_eq!(result.events[0].path, vec![Pos::new(0, 1)]);
    assert_eq!(result.final_robot.pos, Pos::new(0, 1));
    assert_eq!(result.discovered, vec![Pos::new(0, 0), Pos::new(0, 1)]);
}

#[test]
fn stepping_over_gold_leaves_it_in_place() {
    let result = run_on(
        "step forward 2\nturn by 2\nstep forward 1\nmine here",
        "1 3\n>@.",
    );
    assert!(result.is_ok());
    assert_eq!(result.gold, 1);
    assert_eq!(result.events[3].mined, Some(Pos::new(0, 1)));
    assert_eq!(result.events[3].gold, 1);
}

#[test]
fn mined_cells_hold_no_more_gold() {
    let src = "step forward 1\nmine here\nturn by 2\nstep forward 1\nturn by 2\nset gold to isThere 2\nset empty to isThere 0\nprint gold\nprint empty\nstep forward 1\nmine here";
    let result = run_on(src, "1 2\n>@");
    assert_eq!(result.console, vec!["false", "true"]);
    assert_eq!(error_of(&result), (RuntimeErrorCode::ENoGold, 11));
    assert_eq!(result.gold, 1);
}

#[test]
fn mining_without_gold_fails_on_its_line() {
    let result = run_on("mine here", TINY);
    assert_eq!(error_of(&result), (RuntimeErrorCode::ENoGold, 1));
    assert_eq!(result.events[0].mined, None);
}

#[test]
fn isthere_discovers_the_target_inside_the_map_only() {
    let inside = run_on("set w to isThere 1\nprint w", "1 2\n>#");
    assert_eq!(inside.console, vec!["true"]);
    assert_eq!(inside.events[0].discovered, vec![Pos::new(0, 1)]);
    assert_eq!(inside.discovered, vec![Pos::new(0, 0), Pos::new(0, 1)]);
    let outside = run_on(
        "set w to isThere 1\nset e to isThere 0\nset g to isThere 2",
        TINY,
    );
    assert!(
        outside
            .events
            .iter()
            .all(|event| event.discovered.is_empty())
    );
    let values: Vec<Value> = outside
        .events
        .iter()
        .map(|event| event.assigned.as_ref().unwrap().value)
        .collect();
    assert_eq!(
        values,
        vec![Value::Bool(true), Value::Bool(false), Value::Bool(false)]
    );
}

#[test]
fn isthere_does_not_rediscover_known_cells() {
    let result = run_on("set a to isThere 0\nset b to isThere 0", "1 2\n>.");
    assert_eq!(result.events[0].discovered, vec![Pos::new(0, 1)]);
    assert!(result.events[1].discovered.is_empty());
}

#[test]
fn isthere_with_a_bad_argument_discovers_nothing() {
    for (src, line) in [
        ("set a to isThere 3", 1),
        ("set a to isThere true", 1),
        ("set n to 0 - 1\nset a to isThere n", 2),
    ] {
        let result = run_on(src, "1 2\n>.");
        assert_eq!(
            error_of(&result),
            (RuntimeErrorCode::EBadArg, line),
            "{src}"
        );
        assert!(
            result
                .events
                .iter()
                .all(|event| event.discovered.is_empty())
        );
    }
}

#[test]
fn type_mismatch_after_isthere_still_discovers_the_target() {
    let result = run_on("set a to 1\nset a to isThere 0", "1 2\n>.");
    assert_eq!(error_of(&result), (RuntimeErrorCode::ETypeMismatch, 2));
    assert_eq!(result.events[1].discovered, vec![Pos::new(0, 1)]);
    assert_eq!(result.events[1].assigned, None);
}

#[test]
fn assignments_are_recorded_with_their_values() {
    let result = run_on("set a to 2 * 21\nset b to a = 42", TINY);
    assert_eq!(
        result.events[0].assigned,
        Some(Assignment {
            name: "a".to_owned(),
            value: Value::Int(42)
        })
    );
    assert_eq!(
        result.events[1]
            .assigned
            .as_ref()
            .map(|assignment| assignment.value),
        Some(Value::Bool(true))
    );
}

#[test]
fn variables_keep_their_first_type_and_names_are_case_sensitive() {
    assert_eq!(
        failure("set x to 1\nset x to true", TINY),
        (RuntimeErrorCode::ETypeMismatch, 2)
    );
    let result = run_on("set x to 1\nset X to true\nprint x\nprint X", TINY);
    assert_eq!(result.console, vec!["1", "true"]);
}

#[test]
fn print_writes_integers_and_booleans() {
    let result = run_on("set a to 0 - 5\nprint a\nprint true", TINY);
    assert_eq!(result.console, vec!["-5", "true"]);
    assert_eq!(result.events[1].print.as_deref(), Some("-5"));
    assert_eq!(result.events[0].print, None);
}

#[test]
fn uninitialized_reads_fail_everywhere() {
    for src in [
        "print x",
        "step forward x",
        "turn by x",
        "if x",
        "while x",
        "set a to x",
        "set a to not x",
        "set a to isThere x",
        "set a to x + 1",
        "set a to 1 + x",
    ] {
        assert_eq!(
            failure(src, TINY),
            (RuntimeErrorCode::EUninitialized, 1),
            "{src}"
        );
    }
}

#[test]
fn operand_types_are_checked_left_to_right() {
    assert_eq!(
        failure("set a to 5 and c", TINY),
        (RuntimeErrorCode::EBadOperand, 1)
    );
    assert_eq!(
        failure("set a to true or c", TINY),
        (RuntimeErrorCode::EUninitialized, 1)
    );
    assert_eq!(
        failure("set a to 1 = true", TINY),
        (RuntimeErrorCode::EBadOperand, 1)
    );
    assert_eq!(
        failure("set a to true = c", TINY),
        (RuntimeErrorCode::EUninitialized, 1)
    );
    assert_eq!(
        failure("set a to not 1", TINY),
        (RuntimeErrorCode::EBadOperand, 1)
    );
    assert_eq!(
        failure("set a to 1 < false", TINY),
        (RuntimeErrorCode::EBadOperand, 1)
    );
}

#[test]
fn integer_overflow_beyond_the_safe_range() {
    let src = "set x to 100\nset x to x * x\nset x to x * x\nset x to x * x";
    let result = run_on(src, TINY);
    assert_eq!(error_of(&result), (RuntimeErrorCode::EIntOverflow, 4));
    assert_eq!(result.steps, 4);
    assert_eq!(result.events[3].assigned, None);
}

#[test]
fn conditions_must_be_booleans() {
    assert_eq!(
        failure("if 5\n    print 1", TINY),
        (RuntimeErrorCode::ENonBoolCondition, 1)
    );
    assert_eq!(
        failure("set n to 1\nwhile n", TINY),
        (RuntimeErrorCode::ENonBoolCondition, 2)
    );
}

#[test]
fn robot_arguments_must_be_non_negative_integers() {
    for src in [
        "turn by true",
        "step forward false",
        "set n to 0 - 1\nturn by n",
        "set n to 0 - 1\nstep forward n",
    ] {
        let (code, _) = failure(src, TINY);
        assert_eq!(code, RuntimeErrorCode::EBadArg, "{src}");
    }
}

#[test]
fn turn_counts_quarters_to_the_left_modulo_four() {
    let turned = |quarters: u32| run_on(&format!("turn by {quarters}"), TINY).final_robot.dir;
    assert_eq!(turned(0), Dir::East);
    assert_eq!(turned(1), Dir::North);
    assert_eq!(turned(2), Dir::West);
    assert_eq!(turned(3), Dir::South);
    assert_eq!(turned(5), Dir::North);
    assert_eq!(turned(100), Dir::East);
}

#[test]
fn zero_step_and_zero_turn_change_nothing() {
    let result = run_on("step forward 0\nturn by 0", TINY);
    assert!(result.is_ok());
    assert_eq!(result.steps, 2);
    assert!(result.events[0].path.is_empty());
    assert_eq!(result.final_robot, RobotState::start_of(&map(TINY)));
}

#[test]
fn else_line_counts_only_when_its_branch_runs() {
    let taken = run_on("set a to false\nif a\n    print 1\nelse\n    print 2", TINY);
    let lines: Vec<u32> = taken.events.iter().map(|event| event.line).collect();
    assert_eq!(lines, vec![1, 2, 4, 5]);
    assert_eq!(taken.console, vec!["2"]);
    let skipped = run_on("set a to true\nif a\n    print 1\nelse\n    print 2", TINY);
    let lines: Vec<u32> = skipped.events.iter().map(|event| event.line).collect();
    assert_eq!(lines, vec![1, 2, 3]);
    let without_else = run_on("if false\n    print 1\nprint 2", TINY);
    assert_eq!(without_else.steps, 2);
}

#[test]
fn while_line_counts_every_evaluation_including_the_last() {
    let src =
        "set i to 0\nset go to true\nwhile go\n    set i to i + 1\n    set go to i < 3\nprint i";
    let result = run_on(src, TINY);
    assert_eq!(result.steps, 13);
    assert_eq!(result.console, vec!["3"]);
    let while_events = result.events.iter().filter(|event| event.line == 3).count();
    assert_eq!(while_events, 4);
}

#[test]
fn nested_blocks_resume_their_parents() {
    let src = "set i to 0
set go to true
while go
    if true
        set i to i + 1
    print i
    set go to i < 2
print 9";
    let result = run_on(src, TINY);
    assert!(result.is_ok(), "{:?}", result.outcome);
    assert_eq!(result.console, vec!["1", "2", "9"]);
}

#[test]
fn instruction_limit_stops_before_the_next_line() {
    let result = run_on("set t to true\nwhile t", TINY);
    assert_eq!(
        error_of(&result),
        (RuntimeErrorCode::InstructionCountLimitExceeded, 2)
    );
    assert_eq!(result.steps, MAX_STEPS);
    assert_eq!(result.events.len(), 1000);
}

#[test]
fn instruction_limit_applies_to_else_lines_too() {
    let mut src = String::from("set f to false\n");
    for _ in 0..998 {
        src.push_str("set f to false\n");
    }
    src.push_str("if f\n    print 1\nelse\n    print 2\n");
    let result = run_on(&src, TINY);
    assert_eq!(
        error_of(&result),
        (RuntimeErrorCode::InstructionCountLimitExceeded, 1002)
    );
    assert_eq!(result.steps, MAX_STEPS);
    assert_eq!(result.events.last().unwrap().line, 1000);
}

#[test]
fn a_program_of_exactly_one_thousand_lines_finishes() {
    let src = "print 1\n".repeat(1000);
    let result = run_on(&src, TINY);
    assert!(result.is_ok());
    assert_eq!(result.steps, 1000);
}

#[test]
fn runtime_error_message_is_the_code_message() {
    let result = run_on("mine here", TINY);
    let Outcome::RuntimeError { code, message, .. } = &result.outcome else {
        panic!("hiba kell");
    };
    assert_eq!(message, code.message());
}

#[test]
fn inconsistent_maps_do_not_panic() {
    let broken = Map {
        rows: 2,
        cols: 2,
        cells: vec![vec![Cell::Gold]],
        robot: Pos::new(5, 5),
        dir: Dir::North,
    };
    let result = run("set a to isThere 2\nmine here\nstep forward 3", &broken);
    assert_eq!(error_of(&result), (RuntimeErrorCode::ENoGold, 2));
    assert_eq!(result.discovered[0], Pos::new(5, 5));
}
