#![allow(clippy::unwrap_used, clippy::panic)]

use minescript_core::{
    FormatOptions, Outcome, RunResult, RuntimeErrorCode, format, parse, parse_map, run,
};

const CORRIDOR: &str = "1 8\n>..@..@.\n";
const FIRST_TURN: &str = "4 6\n>...@#\n####.#\n####.#\n####@#\n";
const SNAKE: &str = "5 11\n>.........@\n##########.\n@..........\n.##########\n.........@.\n";

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

fn run_on(source: &str, map_text: &str) -> RunResult {
    run(source, &parse_map(map_text).map.unwrap())
}

#[test]
fn server_seed_programs_parse_and_are_formatted() {
    for source in [
        "step forward 3\nmine here\nstep forward 3\nmine here\n",
        WALK_AND_MINE,
        "step forward 7\n",
        "step forward 4\nmine here\nturn by 3\nstep forward 3\nmine here\n",
        "step forward 5\n",
        "step forward 10\nmine here\nprint true\n",
    ] {
        let parsed = parse(source);
        assert!(
            parsed.diagnostics.is_empty(),
            "{source}: {:?}",
            parsed.diagnostics
        );
        assert!(
            !format(source, &FormatOptions::default()).changed,
            "{source}"
        );
    }
}

#[test]
fn server_seed_programs_reach_their_intended_results() {
    let targeted = run_on(
        "step forward 3\nmine here\nstep forward 3\nmine here\n",
        CORRIDOR,
    );
    assert_eq!((targeted.gold, targeted.steps), (2, 4));
    let walker = run_on(WALK_AND_MINE, CORRIDOR);
    assert!(walker.is_ok());
    assert_eq!(walker.gold, 2);
    assert_eq!(walker.console, vec!["2"]);
    let turn = run_on(
        "step forward 4\nmine here\nturn by 3\nstep forward 3\nmine here\n",
        FIRST_TURN,
    );
    assert!(turn.is_ok());
    assert_eq!(turn.gold, 2);
    let too_far = run_on("step forward 5\n", FIRST_TURN);
    assert!(matches!(
        too_far.outcome,
        Outcome::RuntimeError {
            code: RuntimeErrorCode::EBedrockHit,
            line: 1,
            ..
        }
    ));
    let snake = run_on("step forward 10\nmine here\nprint true\n", SNAKE);
    assert_eq!(
        (snake.gold, snake.console.clone()),
        (1, vec!["true".to_owned()])
    );
}
