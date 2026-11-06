#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::fs;
use std::path::PathBuf;
use std::process::{Command, Output};

fn minescript(args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_minescript"))
        .args(args)
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .output()
        .expect("a minescript bináris elindul")
}

fn stdout(output: &Output) -> String {
    String::from_utf8_lossy(&output.stdout).into_owned()
}

fn stderr(output: &Output) -> String {
    String::from_utf8_lossy(&output.stderr).into_owned()
}

fn json(output: &Output) -> serde_json::Value {
    serde_json::from_slice(&output.stdout).expect("JSON-kimenet")
}

fn scratch_copy(fixture: &str) -> PathBuf {
    let target =
        std::env::temp_dir().join(format!("minescript-cli-{}-{fixture}", std::process::id()));
    let source = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures")
        .join(fixture);
    fs::copy(source, &target).unwrap();
    target
}

#[test]
fn map_check_accepts_spec_example() {
    let output = minescript(&["map-check", "tests/fixtures/spec-map.txt"]);
    assert_eq!(output.status.code(), Some(0));
    let stdout = stdout(&output);
    assert!(stdout.contains("3×15"), "{stdout}");
    assert!(stdout.contains("arany: 2 (elérhető: 2)"), "{stdout}");
}

#[test]
fn map_check_rejects_two_robots() {
    let output = minescript(&["map-check", "tests/fixtures/two-robots.txt"]);
    assert_eq!(output.status.code(), Some(1));
    assert!(stderr(&output).contains("MAP_MULTIPLE_ROBOTS"));
}

#[test]
fn missing_file_is_a_usage_error() {
    let output = minescript(&["map-check", "tests/fixtures/does-not-exist.txt"]);
    assert_eq!(output.status.code(), Some(2));
    assert!(stderr(&output).contains("a fájl nem létezik"));
}

#[test]
fn unreadable_inputs_are_reported_in_hungarian() {
    let directory = minescript(&["check", "tests/fixtures"]);
    assert_eq!(directory.status.code(), Some(2));
    assert!(stderr(&directory).contains("ez egy mappa, nem fájl"));
    let invalid =
        std::env::temp_dir().join(format!("minescript-cli-{}-bad.ms", std::process::id()));
    fs::write(&invalid, b"print 1\xff\n").unwrap();
    let output = minescript(&["check", invalid.to_str().unwrap()]);
    fs::remove_file(&invalid).unwrap();
    assert_eq!(output.status.code(), Some(2));
    assert!(stderr(&output).contains("a fájl nem érvényes UTF-8 szöveg"));
}

#[test]
fn check_accepts_the_spec_program() {
    let output = minescript(&["check", "tests/fixtures/walk-and-mine.ms"]);
    assert_eq!(output.status.code(), Some(0));
    assert!(stdout(&output).contains("Szintaktikailag helyes program."));
}

#[test]
fn check_reports_every_broken_line() {
    let output = minescript(&["check", "tests/fixtures/broken.ms"]);
    assert_eq!(output.status.code(), Some(1));
    let stderr = stderr(&output);
    assert!(stderr.contains("SYN_UNKNOWN_COMMAND"), "{stderr}");
    assert!(stderr.contains("SYN_INVALID_TOKEN"), "{stderr}");
}

#[test]
fn fmt_prints_the_formatted_program() {
    let output = minescript(&["fmt", "tests/fixtures/unformatted.ms"]);
    assert_eq!(output.status.code(), Some(0));
    assert_eq!(stdout(&output), "while true\n    print 1\nprint 2\n");
}

#[test]
fn fmt_check_tells_formatted_and_unformatted_files_apart() {
    let unformatted = minescript(&["fmt", "--check", "tests/fixtures/unformatted.ms"]);
    assert_eq!(unformatted.status.code(), Some(1));
    assert!(stdout(&unformatted).contains("nincs formázva"));
    let formatted = minescript(&["fmt", "--check", "tests/fixtures/walk-and-mine.ms"]);
    assert_eq!(formatted.status.code(), Some(0));
}

#[test]
fn fmt_write_rewrites_the_file() {
    let path = scratch_copy("unformatted.ms");
    let output = minescript(&["fmt", "--write", path.to_str().unwrap()]);
    assert_eq!(output.status.code(), Some(0));
    assert_eq!(
        fs::read_to_string(&path).unwrap(),
        "while true\n    print 1\nprint 2\n"
    );
    fs::remove_file(path).unwrap();
}

#[test]
fn fmt_refuses_programs_with_syntax_errors() {
    let output = minescript(&["fmt", "tests/fixtures/broken.ms"]);
    assert_eq!(output.status.code(), Some(1));
    assert!(stderr(&output).contains("SYN_UNKNOWN_COMMAND"));
}

#[test]
fn lint_reports_warnings_with_their_codes() {
    let output = minescript(&["lint", "tests/fixtures/warnings.ms"]);
    assert_eq!(output.status.code(), Some(1));
    let stderr = stderr(&output);
    for code in ["LINT_UNUSED_VAR", "LINT_MERGE_STEPS", "LINT_TURN_MOD4"] {
        assert!(stderr.contains(code), "{code}: {stderr}");
    }
    let clean = minescript(&["lint", "tests/fixtures/walk-and-mine.ms"]);
    assert_eq!(clean.status.code(), Some(0));
}

#[test]
fn run_walks_and_mines_the_spec_map() {
    let output = minescript(&[
        "run",
        "--map",
        "tests/fixtures/spec-map.txt",
        "tests/fixtures/walk-and-mine.ms",
    ]);
    assert_eq!(output.status.code(), Some(0));
    let stdout = stdout(&output);
    assert!(stdout.starts_with("0\n"), "{stdout}");
    assert!(
        stdout.contains("Arany: 0, feldolgozott sorok: 26, robot: 3. sor, 15. oszlop"),
        "{stdout}"
    );
}

#[test]
fn run_collects_gold_in_a_corridor() {
    let output = minescript(&[
        "run",
        "--map",
        "tests/fixtures/corridor.txt",
        "tests/fixtures/walk-and-mine.ms",
        "--json",
    ]);
    assert_eq!(output.status.code(), Some(0));
    let result = json(&output);
    assert_eq!(result["outcome"]["kind"], "ok");
    assert_eq!(result["gold"], 2);
    assert_eq!(result["console"], serde_json::json!(["2"]));
    assert_eq!(result["events"][0]["assigned"]["name"], "count");
}

#[test]
fn run_trace_lists_every_processed_line() {
    let output = minescript(&[
        "run",
        "--map",
        "tests/fixtures/spec-map.txt",
        "tests/fixtures/walk-and-mine.ms",
        "--trace",
    ]);
    let stdout = stdout(&output);
    let traced = stdout.lines().filter(|line| line.starts_with('#')).count();
    assert_eq!(traced, 26);
    assert!(
        stdout.contains("#   1  1. sor  (3, 12)  arany: 0"),
        "{stdout}"
    );
}

#[test]
fn run_prints_json_result() {
    let output = minescript(&[
        "run",
        "--map",
        "tests/fixtures/spec-map.txt",
        "tests/fixtures/empty.ms",
        "--json",
    ]);
    assert_eq!(output.status.code(), Some(0));
    let result = json(&output);
    assert_eq!(result["outcome"]["kind"], "ok");
    assert_eq!(result["steps"], 0);
}

#[test]
fn run_reports_runtime_errors() {
    let output = minescript(&[
        "run",
        "--map",
        "tests/fixtures/spec-map.txt",
        "tests/fixtures/into-wall.ms",
    ]);
    assert_eq!(output.status.code(), Some(1));
    assert!(stderr(&output).contains("E_BEDROCK_HIT a(z) 1. sorban"));
    let as_json = minescript(&[
        "run",
        "--map",
        "tests/fixtures/spec-map.txt",
        "tests/fixtures/into-wall.ms",
        "--json",
    ]);
    assert_eq!(as_json.status.code(), Some(1));
    assert_eq!(json(&as_json)["outcome"]["code"], "E_BEDROCK_HIT");
}

#[test]
fn run_refuses_syntax_errors_and_bad_maps() {
    let syntax = minescript(&[
        "run",
        "--map",
        "tests/fixtures/spec-map.txt",
        "tests/fixtures/broken.ms",
    ]);
    assert_eq!(syntax.status.code(), Some(1));
    assert!(stderr(&syntax).contains("SYN_UNKNOWN_COMMAND"));
    let syntax_json = minescript(&[
        "run",
        "--map",
        "tests/fixtures/spec-map.txt",
        "tests/fixtures/broken.ms",
        "--json",
    ]);
    assert_eq!(json(&syntax_json)["outcome"]["kind"], "syntaxError");
    let bad_map = minescript(&[
        "run",
        "--map",
        "tests/fixtures/two-robots.txt",
        "tests/fixtures/empty.ms",
    ]);
    assert_eq!(bad_map.status.code(), Some(1));
    assert!(stderr(&bad_map).contains("MAP_MULTIPLE_ROBOTS"));
}

#[test]
fn ast_dumps_the_parse_result() {
    let output = minescript(&["ast", "tests/fixtures/walk-and-mine.ms"]);
    assert_eq!(output.status.code(), Some(0));
    let parsed = json(&output);
    assert_eq!(parsed["program"]["body"][3]["kind"]["kind"], "while");
    assert_eq!(parsed["diagnostics"], serde_json::json!([]));
    let broken = minescript(&["ast", "tests/fixtures/broken.ms"]);
    assert_eq!(broken.status.code(), Some(1));
    assert_eq!(json(&broken)["program"], serde_json::Value::Null);
}
