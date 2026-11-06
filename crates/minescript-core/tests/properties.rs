#![allow(clippy::unwrap_used, clippy::panic, clippy::indexing_slicing)]

use std::collections::BTreeSet;
use std::fmt::Write as _;

use minescript_core::diagnostics::has_errors;
use minescript_core::{
    Cell, Dir, FormatOptions, MAX_STEPS, Map, Pos, RunResult, analyze, complete, format, hover,
    parse, run,
};
use proptest::collection::vec;
use proptest::option;
use proptest::prelude::*;

const VARIABLES: [&str; 5] = ["a", "b", "Count", "x1", "go"];
const OPERATORS: [&str; 11] = ["+", "-", "*", "=", "<>", "<", "<=", ">", ">=", "and", "or"];
const FRAGMENTS: [&str; 40] = [
    "step",
    "forward",
    "turn",
    "by",
    "mine",
    "here",
    "print",
    "set",
    "to",
    "if",
    "else",
    "while",
    "isThere",
    "not",
    "and",
    "or",
    "true",
    "false",
    "Step",
    "TRUE",
    "x",
    "count",
    "0",
    "1",
    "2",
    "007",
    "100",
    "101",
    "-5",
    "1+2",
    "+",
    "<=",
    "a_b",
    "árany",
    "😀",
    "\u{feff}",
    "\0",
    "#",
    "(",
    "999999999999999999999",
];
const SEPARATORS: [&str; 8] = [" ", " ", "  ", "\n", "\n    ", "\t", "\r", "\r\n"];

fn arbitrary_source() -> impl Strategy<Value = String> {
    let piece = prop_oneof![
        4 => proptest::sample::select(FRAGMENTS.as_slice()).prop_map(str::to_owned),
        3 => proptest::sample::select(SEPARATORS.as_slice()).prop_map(str::to_owned),
        1 => any::<char>().prop_map(String::from),
    ];
    vec(piece, 0..80).prop_map(|pieces| pieces.concat())
}

fn arbitrary_map() -> impl Strategy<Value = Map> {
    (1usize..=5, 1usize..=5)
        .prop_flat_map(|(rows, cols)| {
            let cell = prop_oneof![
                3 => Just(Cell::Empty),
                2 => Just(Cell::Gold),
                1 => Just(Cell::Wall)
            ];
            (
                vec(vec(cell, cols), rows),
                0..rows,
                0..cols,
                proptest::sample::select(Dir::ALL.as_slice()),
            )
        })
        .prop_map(|(mut cells, row, col, dir)| {
            cells[row][col] = Cell::Empty;
            Map {
                rows: cells.len(),
                cols: cells[0].len(),
                cells,
                robot: Pos::new(row, col),
                dir,
            }
        })
}

#[derive(Debug, Clone)]
enum Node {
    Line(String),
    If {
        cond: String,
        width: usize,
        then_body: Vec<Node>,
        otherwise: Option<(usize, Vec<Node>)>,
    },
    While {
        cond: String,
        width: usize,
        body: Vec<Node>,
    },
}

fn variable() -> impl Strategy<Value = String> {
    proptest::sample::select(VARIABLES.as_slice()).prop_map(str::to_owned)
}

fn literal() -> impl Strategy<Value = String> {
    prop_oneof![
        3 => (0u8..=3).prop_map(|value| value.to_string()),
        1 => (0u8..=100).prop_map(|value| value.to_string()),
        1 => Just("007".to_owned()),
        2 => proptest::sample::select(["true", "false"].as_slice()).prop_map(str::to_owned),
    ]
}

fn operand() -> impl Strategy<Value = String> {
    prop_oneof![variable(), literal()]
}

fn expression() -> impl Strategy<Value = String> {
    prop_oneof![
        3 => operand(),
        2 => (0u8..=3).prop_map(|code| format!("isThere {code}")),
        1 => operand().prop_map(|value| format!("not {value}")),
        3 => (
            operand(),
            proptest::sample::select(OPERATORS.as_slice()),
            operand()
        )
            .prop_map(|(lhs, op, rhs)| format!("{lhs} {op} {rhs}")),
    ]
}

fn command() -> impl Strategy<Value = String> {
    prop_oneof![
        3 => (0u8..=3).prop_map(|count| format!("step forward {count}")),
        1 => operand().prop_map(|count| format!("step forward {count}")),
        2 => operand().prop_map(|quarters| format!("turn by {quarters}")),
        2 => Just("mine here".to_owned()),
        2 => operand().prop_map(|value| format!("print {value}")),
        5 => (variable(), expression()).prop_map(|(name, value)| format!("set {name} to {value}")),
    ]
}

fn program_nodes() -> impl Strategy<Value = Vec<Node>> {
    let node = command()
        .prop_map(Node::Line)
        .prop_recursive(4, 40, 5, |inner| {
            prop_oneof![
                4 => command().prop_map(Node::Line),
                1 => (
                    operand(),
                    1usize..=4,
                    vec(inner.clone(), 0..5),
                    option::of((1usize..=4, vec(inner.clone(), 0..5)))
                )
                    .prop_map(|(cond, width, then_body, otherwise)| Node::If {
                        cond,
                        width,
                        then_body,
                        otherwise
                    }),
                1 => (operand(), 1usize..=4, vec(inner, 0..5))
                    .prop_map(|(cond, width, body)| Node::While { cond, width, body }),
            ]
        });
    vec(node, 0..10)
}

fn valid_source() -> impl Strategy<Value = String> {
    (program_nodes(), any::<bool>()).prop_map(|(nodes, preamble)| {
        let mut text = String::new();
        if preamble {
            text.push_str("set a to 1\nset b to true\nset go to true\n");
        }
        render(&nodes, 0, &mut text);
        text
    })
}

fn render(nodes: &[Node], indent: usize, out: &mut String) {
    let pad = " ".repeat(indent);
    for node in nodes {
        match node {
            Node::Line(text) => {
                let _ = writeln!(out, "{pad}{text}");
            }
            Node::If {
                cond,
                width,
                then_body,
                otherwise,
            } => {
                let _ = writeln!(out, "{pad}if {cond}");
                render(then_body, indent + width, out);
                if let Some((else_width, else_body)) = otherwise {
                    let _ = writeln!(out, "{pad}else");
                    render(else_body, indent + else_width, out);
                }
            }
            Node::While { cond, width, body } => {
                let _ = writeln!(out, "{pad}while {cond}");
                render(body, indent + width, out);
            }
        }
    }
}

fn utf16_len(text: &str) -> u32 {
    u32::try_from(text.encode_utf16().count()).unwrap()
}

fn assert_trace_contract(result: &RunResult, map: &Map) -> Result<(), TestCaseError> {
    prop_assert!(result.steps <= MAX_STEPS);
    prop_assert_eq!(result.events.len(), usize::try_from(result.steps).unwrap());
    for (position, event) in result.events.iter().enumerate() {
        prop_assert_eq!(usize::try_from(event.index).unwrap(), position);
        prop_assert_eq!(event.steps, event.index + 1);
    }
    let unique: BTreeSet<Pos> = result.discovered.iter().copied().collect();
    prop_assert_eq!(unique.len(), result.discovered.len());
    prop_assert_eq!(result.discovered.first().copied(), Some(map.robot));
    let newly: Vec<Pos> = result
        .events
        .iter()
        .flat_map(|event| event.discovered.iter().copied())
        .collect();
    prop_assert_eq!(&result.discovered[1..], newly.as_slice());
    let printed: Vec<String> = result
        .events
        .iter()
        .filter_map(|event| event.print.clone())
        .collect();
    prop_assert_eq!(&printed, &result.console);
    if let Some(last) = result.events.last() {
        prop_assert_eq!(last.gold, result.gold);
        prop_assert_eq!(last.robot, result.final_robot);
    }
    Ok(())
}

const DEFAULT_CASES: u32 = 512;

fn property_config() -> ProptestConfig {
    let cases = std::env::var("PROPTEST_CASES")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(DEFAULT_CASES);
    ProptestConfig {
        cases,
        failure_persistence: None,
        ..ProptestConfig::default()
    }
}

proptest! {
    #![proptest_config(property_config())]

    #[test]
    fn language_services_never_panic(source in arbitrary_source(), offset in 0u32..400) {
        let parsed = parse(&source);
        prop_assert_eq!(parsed.program.is_some(), parsed.diagnostics.is_empty());
        let positions: Vec<(u32, u32)> = parsed
            .diagnostics
            .iter()
            .map(|diagnostic| (diagnostic.span.line, diagnostic.span.col_start))
            .collect();
        let mut sorted = positions.clone();
        sorted.sort_unstable();
        prop_assert_eq!(positions, sorted);
        let normalized_length = utf16_len(&minescript_core::source::normalize(&source));
        for diagnostic in &parsed.diagnostics {
            prop_assert!(diagnostic.span.from <= diagnostic.span.to);
            prop_assert!(diagnostic.span.to <= normalized_length);
        }
        let analysis = analyze(&source);
        for token in &analysis.tokens {
            prop_assert!(token.from < token.to && token.to <= normalized_length);
        }
        let _ = complete(&source, offset);
        let _ = hover(&source, offset);
        let formatted = format(&source, &FormatOptions::default());
        if formatted.diagnostics.is_empty() {
            prop_assert!(!has_errors(&parse(&formatted.text).diagnostics));
            prop_assert_eq!(&format(&formatted.text, &FormatOptions::default()).text, &formatted.text);
        } else {
            prop_assert_eq!(&formatted.text, &source);
        }
    }

    #[test]
    fn running_anything_terminates_within_the_limit(source in arbitrary_source(), map in arbitrary_map()) {
        let result = run(&source, &map);
        assert_trace_contract(&result, &map)?;
    }

    #[test]
    fn generated_programs_are_valid(source in valid_source()) {
        let parsed = parse(&source);
        prop_assert!(parsed.diagnostics.is_empty(), "{}\n{:?}", source, parsed.diagnostics);
        prop_assert!(!has_errors(&analyze(&source).diagnostics));
    }

    #[test]
    fn formatting_is_idempotent_and_preserves_runs(source in valid_source(), map in arbitrary_map(), width in 1u32..=8) {
        let options = FormatOptions { indent_width: width };
        let once = format(&source, &options);
        prop_assert!(once.diagnostics.is_empty());
        let twice = format(&once.text, &options);
        prop_assert_eq!(&twice.text, &once.text);
        prop_assert!(!twice.changed);
        prop_assert_eq!(run(&once.text, &map), run(&source, &map));
    }

    #[test]
    fn generated_programs_honour_the_trace_contract(source in valid_source(), map in arbitrary_map()) {
        let result = run(&source, &map);
        prop_assert!(!result.is_syntax_error());
        assert_trace_contract(&result, &map)?;
    }

    #[test]
    fn arbitrary_unicode_never_panics(source in "\\PC*", offset in 0u32..200) {
        let _ = analyze(&source);
        let _ = format(&source, &FormatOptions::default());
        let _ = complete(&source, offset);
        let _ = hover(&source, offset);
    }
}

#[test]
fn very_long_lines_are_handled_in_linear_time() {
    let wide = format!("print {}", "x ".repeat(100_000));
    assert!(!parse(&wide).diagnostics.is_empty());
    assert_eq!(analyze(&wide).tokens.len(), 100_001);
    let tabs = format!("print 1{}", "\t".repeat(100_000));
    assert_eq!(parse(&tabs).diagnostics[0].fixes[0].edits.len(), 100_000);
    let unicode = format!("print {}", "ő ".repeat(50_000));
    assert_eq!(analyze(&unicode).tokens.len(), 50_001);
}

#[test]
fn deep_nesting_is_parsed_and_run() {
    let depth = 300;
    let mut source = String::new();
    for level in 0..depth {
        let _ = writeln!(source, "{}if true", " ".repeat(level));
    }
    let _ = writeln!(source, "{}print 1", " ".repeat(depth));
    let map = Map {
        rows: 1,
        cols: 1,
        cells: vec![vec![Cell::Empty]],
        robot: Pos::new(0, 0),
        dir: Dir::East,
    };
    let result = run(&source, &map);
    assert!(result.is_ok());
    assert_eq!(result.console, vec!["1"]);
    assert_eq!(result.steps, u32::try_from(depth).unwrap() + 1);
    assert!(
        !format(&source, &FormatOptions::default())
            .diagnostics
            .iter()
            .any(minescript_core::Diagnostic::is_error)
    );
}
