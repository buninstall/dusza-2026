#![allow(clippy::unwrap_used, clippy::panic, clippy::indexing_slicing)]

use std::fmt::Write as _;
use std::thread;

use minescript_core::diagnostics::has_errors;
use minescript_core::{
    FormatOptions, Outcome, analyze, complete, format, hover, parse, parse_map, run,
};

const DEPTH: usize = 3000;
const SMALL_STACK: usize = 256 * 1024;

fn nested(header: &str, depth: usize) -> String {
    let mut source = String::new();
    for level in 0..depth {
        writeln!(source, "{}{header}", " ".repeat(level)).unwrap();
    }
    writeln!(source, "{}print 1", " ".repeat(depth)).unwrap();
    source
}

fn nested_else(depth: usize) -> String {
    let mut source = String::new();
    for level in 0..depth {
        let indent = " ".repeat(level);
        writeln!(source, "{indent}if false\n{indent}else").unwrap();
    }
    writeln!(source, "{}print 1", " ".repeat(depth)).unwrap();
    source
}

fn on_small_stack(work: impl FnOnce() + Send + 'static) {
    thread::Builder::new()
        .stack_size(SMALL_STACK)
        .spawn(work)
        .unwrap()
        .join()
        .unwrap();
}

#[test]
fn deeply_nested_if_runs_on_a_small_stack() {
    on_small_stack(|| {
        let source = nested("if true", DEPTH);
        let map = parse_map("1 1\n>\n").map.unwrap();
        let result = run(&source, &map);
        assert_eq!(result.steps, 1000);
        assert!(matches!(
            result.outcome,
            Outcome::RuntimeError { line: 1001, .. }
        ));
    });
}

#[test]
fn deeply_nested_else_chain_is_analyzed_on_a_small_stack() {
    on_small_stack(|| {
        let source = nested_else(DEPTH);
        let analysis = analyze(&source);
        assert!(!has_errors(&analysis.diagnostics));
        assert_eq!(analysis.folds.len(), DEPTH);
        let program = parse(&source).program.unwrap();
        let mut deepest = 0;
        program.for_each_line(|_, depth| deepest = deepest.max(depth));
        assert_eq!(deepest, DEPTH);
    });
}

#[test]
fn deeply_nested_while_formats_and_completes_on_a_small_stack() {
    on_small_stack(|| {
        let source = nested("while false", DEPTH);
        let formatted = format(&source, &FormatOptions { indent_width: 1 });
        assert!(!formatted.changed);
        assert_eq!(formatted.text, source);
        let reindented = format(&source, &FormatOptions::default());
        assert!(reindented.changed);
        assert!(
            reindented
                .text
                .ends_with(&format!("{}print 1\n", " ".repeat(DEPTH * 4)))
        );
        let offset = u32::try_from(source.len()).unwrap();
        assert!(!complete(&source, offset).is_empty());
        assert!(hover(&source, 2).is_some());
    });
}

#[test]
fn a_deep_tree_is_dropped_without_recursion() {
    on_small_stack(|| {
        for header in ["if true", "while x"] {
            let parsed = parse(&nested(header, DEPTH));
            assert!(parsed.program.is_some());
            drop(parsed);
        }
    });
}
