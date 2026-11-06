use std::process::Command;

fn minescript(args: &[&str]) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_minescript"))
        .args(args)
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .output()
        .expect("a minescript bináris elindul")
}

#[test]
fn map_check_accepts_spec_example() {
    let output = minescript(&["map-check", "tests/fixtures/spec-map.txt"]);
    assert_eq!(output.status.code(), Some(0));
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("3×15"), "{stdout}");
    assert!(stdout.contains("arany: 2 (elérhető: 2)"), "{stdout}");
}

#[test]
fn map_check_rejects_two_robots() {
    let output = minescript(&["map-check", "tests/fixtures/two-robots.txt"]);
    assert_eq!(output.status.code(), Some(1));
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("MAP_MULTIPLE_ROBOTS"), "{stderr}");
}

#[test]
fn missing_file_is_a_usage_error() {
    let output = minescript(&["map-check", "tests/fixtures/does-not-exist.txt"]);
    assert_eq!(output.status.code(), Some(2));
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
    let json: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(json["outcome"]["kind"], "ok");
    assert_eq!(json["steps"], 0);
}
