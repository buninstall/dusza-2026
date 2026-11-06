#![allow(clippy::unwrap_used, clippy::panic)]

use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

use minescript_core::diagnostics::has_errors;
use minescript_core::{Diagnostic, Outcome, RunResult, Severity, map_info, parse, parse_map};
use serde::Deserialize;
use serde::de::DeserializeOwned;

#[derive(Deserialize)]
struct ExpectedDiagnostic {
    code: String,
    line: Option<u32>,
}

#[derive(Deserialize)]
struct ExpectedOutcome {
    kind: String,
    code: Option<String>,
    line: Option<u32>,
}

#[derive(Deserialize)]
struct ExpectedRobot {
    row: usize,
    col: usize,
    dir: Option<String>,
}

#[derive(Deserialize)]
struct RuntimeCase {
    description: String,
    outcome: ExpectedOutcome,
    gold: u32,
    steps: u32,
    console: Vec<String>,
    robot: Option<ExpectedRobot>,
}

#[derive(Deserialize)]
struct SyntaxCase {
    description: String,
    valid: bool,
    #[serde(default)]
    diagnostics: Vec<ExpectedDiagnostic>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MapCase {
    description: String,
    valid: bool,
    gold_total: Option<u32>,
    reachable_gold: Option<u32>,
    warnings: Option<Vec<String>>,
    #[serde(default)]
    diagnostics: Vec<ExpectedDiagnostic>,
}

struct Mismatches {
    case: String,
    description: String,
    lines: Vec<String>,
}

impl Mismatches {
    fn new(case: &Path, description: &str) -> Self {
        Self {
            case: case
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_default(),
            description: description.to_owned(),
            lines: Vec::new(),
        }
    }

    fn compare<T: PartialEq + std::fmt::Debug>(&mut self, field: &str, expected: &T, actual: &T) {
        if expected != actual {
            self.lines
                .push(format!("{field}: elvárt {expected:?}, kapott {actual:?}"));
        }
    }
}

fn conformance_dir(kind: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../conformance")
        .join(kind)
}

fn cases(kind: &str) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = fs::read_dir(conformance_dir(kind))
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.is_dir())
        .collect();
    dirs.sort();
    assert!(!dirs.is_empty(), "nincs eset: {kind}");
    dirs
}

fn read_text(case: &Path, file: &str) -> String {
    let bytes = fs::read(case.join(file)).unwrap();
    String::from_utf8(bytes).unwrap()
}

fn read_expected<T: DeserializeOwned>(case: &Path) -> T {
    serde_json::from_str(&read_text(case, "expected.json")).unwrap()
}

fn code_name<T: serde::Serialize>(code: &T) -> String {
    serde_json::to_value(code)
        .unwrap()
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

fn compare_errors(report: &mut Mismatches, expected: &[ExpectedDiagnostic], actual: &[Diagnostic]) {
    let mut errors: Vec<&Diagnostic> = actual
        .iter()
        .filter(|diagnostic| diagnostic.severity == Severity::Error)
        .collect();
    errors.sort_by_key(|diagnostic| diagnostic.span.line);
    let actual_codes: Vec<(String, u32)> = errors
        .iter()
        .map(|diagnostic| (code_name(&diagnostic.code), diagnostic.span.line))
        .collect();
    let expected_codes: Vec<(String, Option<u32>)> = expected
        .iter()
        .map(|diagnostic| (diagnostic.code.clone(), diagnostic.line))
        .collect();
    let matches = expected_codes.len() == actual_codes.len()
        && expected_codes.iter().zip(&actual_codes).all(
            |((code, line), (actual_code, actual_line))| {
                code == actual_code && line.is_none_or(|line| line == *actual_line)
            },
        );
    if !matches {
        report.lines.push(format!(
            "diagnosztikák: elvárt {expected_codes:?}, kapott {actual_codes:?}"
        ));
    }
}

fn check_runtime(case: &Path) -> Mismatches {
    let expected: RuntimeCase = read_expected(case);
    let mut report = Mismatches::new(case, &expected.description);
    let program = read_text(case, "program.ms");
    let Some(map) = parse_map(&read_text(case, "map.txt")).map else {
        report.lines.push("a térkép érvénytelen".to_owned());
        return report;
    };
    let result: RunResult = minescript_core::run(&program, &map);
    let (kind, code, line) = match &result.outcome {
        Outcome::Ok => ("ok".to_owned(), None, None),
        Outcome::RuntimeError { code, line, .. } => (
            "runtimeError".to_owned(),
            Some(code_name(code)),
            Some(*line),
        ),
        Outcome::SyntaxError { .. } => ("syntaxError".to_owned(), None, None),
    };
    report.compare("outcome.kind", &expected.outcome.kind, &kind);
    report.compare("outcome.code", &expected.outcome.code, &code);
    report.compare("outcome.line", &expected.outcome.line, &line);
    report.compare("gold", &expected.gold, &result.gold);
    report.compare("steps", &expected.steps, &result.steps);
    report.compare("console", &expected.console, &result.console);
    if let Some(robot) = &expected.robot {
        report.compare(
            "robot",
            &(robot.row, robot.col),
            &(result.final_robot.pos.row, result.final_robot.pos.col),
        );
        if let Some(dir) = &robot.dir {
            report.compare("robot.dir", dir, &code_name(&result.final_robot.dir));
        }
    }
    report
}

fn check_syntax(case: &Path) -> Mismatches {
    let expected: SyntaxCase = read_expected(case);
    let mut report = Mismatches::new(case, &expected.description);
    let parsed = parse(&read_text(case, "program.ms"));
    report.compare("valid", &expected.valid, &!has_errors(&parsed.diagnostics));
    compare_errors(&mut report, &expected.diagnostics, &parsed.diagnostics);
    report
}

fn check_map(case: &Path) -> Mismatches {
    let expected: MapCase = read_expected(case);
    let mut report = Mismatches::new(case, &expected.description);
    let parsed = parse_map(&read_text(case, "map.txt"));
    report.compare("valid", &expected.valid, &parsed.map.is_some());
    if let Some(map) = &parsed.map {
        let info = map_info(map);
        if let Some(gold_total) = expected.gold_total {
            report.compare("goldTotal", &gold_total, &info.gold_total);
        }
        if let Some(reachable) = expected.reachable_gold {
            report.compare("reachableGold", &reachable, &info.reachable_gold);
        }
    }
    if let Some(warnings) = &expected.warnings {
        let mut actual: Vec<String> = parsed
            .diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.severity == Severity::Warning)
            .map(|diagnostic| code_name(&diagnostic.code))
            .collect();
        actual.dedup();
        report.compare("warnings", warnings, &actual);
    }
    compare_errors(&mut report, &expected.diagnostics, &parsed.diagnostics);
    report
}

fn assert_all(kind: &str, check: fn(&Path) -> Mismatches) {
    let all = cases(kind);
    let failures: Vec<Mismatches> = all
        .iter()
        .map(|case| check(case))
        .filter(|report| !report.lines.is_empty())
        .collect();
    if failures.is_empty() {
        return;
    }
    let mut message = format!("{kind}: {} / {} eset hibás\n", failures.len(), all.len());
    for failure in &failures {
        let _ = writeln!(message, "\n✗ {} — {}", failure.case, failure.description);
        for line in &failure.lines {
            let _ = writeln!(message, "    {line}");
        }
    }
    panic!("{message}");
}

#[test]
fn maps_conformance() {
    assert_all("maps", check_map);
}

#[test]
#[ignore = "a parser elkészültéig kikapcsolva"]
fn syntax_conformance() {
    assert_all("syntax", check_syntax);
}

#[test]
#[ignore = "a VM elkészültéig kikapcsolva"]
fn runtime_conformance() {
    assert_all("runtime", check_runtime);
}
