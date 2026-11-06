use super::*;
use crate::diagnostics::{DiagCode, Fix, Severity};
use crate::syntax::parse;

const SPEC_PROGRAM: &str = "set count to 0
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

fn lints(src: &str) -> Vec<Diagnostic> {
    let program = parse(src)
        .program
        .expect("szintaktikailag helyes program kell");
    lint(&program, src)
}

fn codes(src: &str) -> Vec<(DiagCode, u32)> {
    lints(src)
        .iter()
        .map(|diagnostic| (diagnostic.code, diagnostic.span.line))
        .collect()
}

fn only(src: &str, code: DiagCode) -> Diagnostic {
    let mut found: Vec<Diagnostic> = lints(src)
        .into_iter()
        .filter(|diagnostic| diagnostic.code == code)
        .collect();
    assert_eq!(found.len(), 1, "{src:?}: {found:?}");
    found.remove(0)
}

fn apply(src: &str, fix: &Fix) -> String {
    let mut text = src.to_owned();
    let mut edits = fix.edits.clone();
    edits.sort_by_key(|edit| std::cmp::Reverse(edit.from));
    for edit in edits {
        let range = usize::try_from(edit.from).unwrap()..usize::try_from(edit.to).unwrap();
        text.replace_range(range, &edit.insert);
    }
    text
}

fn fixed(src: &str, code: DiagCode) -> String {
    apply(src, &only(src, code).fixes[0])
}

#[test]
fn the_spec_program_is_clean() {
    assert!(lints(SPEC_PROGRAM).is_empty(), "{:?}", lints(SPEC_PROGRAM));
}

#[test]
fn empty_program_has_no_warnings() {
    assert!(lint(&Program::default(), "").is_empty());
}

#[test]
fn unused_variables_are_reported_once_at_their_first_assignment() {
    let diagnostic = only("set a to 1\nset a to 2\n", DiagCode::LintUnusedVar);
    assert_eq!(diagnostic.span.line, 1);
    assert_eq!(diagnostic.severity, Severity::Warning);
    assert!(diagnostic.message.contains("„a”"));
    assert!(codes("set a to 1\nprint a\n").is_empty());
    assert!(codes("set i to 0\nset i to i + 1\n").is_empty());
}

#[test]
fn never_assigned_reads_are_reported() {
    let diagnostic = only("print x\n", DiagCode::LintMaybeUninit);
    assert!(diagnostic.message.contains("sehol nem ad értéket"));
    assert_eq!((diagnostic.span.col_start, diagnostic.span.col_end), (7, 8));
}

#[test]
fn reads_reachable_without_assignment_are_reported() {
    let diagnostic = only(
        "set c to true\nif c\n    set x to 1\nprint x\n",
        DiagCode::LintMaybeUninit,
    );
    assert_eq!(diagnostic.span.line, 4);
    assert!(diagnostic.message.starts_with("Lehet, hogy"));
    assert_eq!(
        codes("set c to true\nwhile c\n    set x to 1\n    set c to false\nprint x\n"),
        vec![(DiagCode::LintMaybeUninit, 5)]
    );
    assert_eq!(
        codes("set go to true\nwhile go\n    print x\n    set x to 1\n    set go to false\n"),
        vec![(DiagCode::LintMaybeUninit, 3)]
    );
}

#[test]
fn assignments_on_every_path_are_definite() {
    assert!(
        codes("set c to true\nif c\n    set x to 1\nelse\n    set x to 2\nprint x\n").is_empty()
    );
    assert!(codes("if true\n    set x to 1\nprint x\n").is_empty());
    assert!(codes("if false\n    print 1\nelse\n    set x to 1\nprint x\n").is_empty());
    assert!(codes("while false\n    print x\n").is_empty());
}

#[test]
fn code_after_an_endless_loop_is_unreachable() {
    assert!(codes("while true\n    set x to 1\n    print x\nprint y\nset y to 2\n").is_empty());
}

#[test]
fn a_successful_read_proves_the_variable_exists() {
    assert_eq!(
        codes("set b to a or a\nprint a\nprint b\n"),
        vec![(DiagCode::LintMaybeUninit, 1)]
    );
}

#[test]
fn integer_literal_conditions_are_reported() {
    let diagnostic = only("if 5\n    print 1\n", DiagCode::LintNonBoolLiteralCondition);
    assert!(diagnostic.message.contains('5'));
    assert_eq!(diagnostic.span.col_start, 4);
    assert_eq!(
        codes("while 3\n    print 1\n"),
        vec![(DiagCode::LintNonBoolLiteralCondition, 1)]
    );
}

#[test]
fn statically_known_type_changes_are_reported() {
    let diagnostic = only(
        "set x to 1\nset x to true\nprint x\n",
        DiagCode::LintTypeChange,
    );
    assert_eq!(diagnostic.span.line, 2);
    assert!(diagnostic.message.contains("logikai") && diagnostic.message.contains("1. sor"));
    assert_eq!(
        codes("set a to 1\nset b to a\nset b to false\nprint b\n"),
        vec![(DiagCode::LintTypeChange, 3)]
    );
    assert!(codes("set a to 1\nset a to a * 2\nprint a\n").is_empty());
}

#[test]
fn isthere_arguments_outside_the_codes_are_reported() {
    for src in [
        "set a to isThere 3\nprint a\n",
        "set a to isThere true\nprint a\n",
    ] {
        let diagnostic = only(src, DiagCode::LintIsthereRange);
        assert_eq!(diagnostic.span.col_start, 18);
    }
    for src in [
        "set a to isThere 0\nprint a\n",
        "set a to isThere 2\nprint a\n",
        "set w to 1\nset a to isThere w\nprint a\n",
    ] {
        assert!(codes(src).is_empty(), "{src}");
    }
}

#[test]
fn empty_blocks_are_reported_per_block() {
    assert_eq!(
        codes("set t to true\nwhile t\nif t\nelse\n"),
        vec![
            (DiagCode::LintEmptyBlock, 2),
            (DiagCode::LintEmptyBlock, 3),
            (DiagCode::LintEmptyBlock, 4)
        ]
    );
}

#[test]
fn names_differing_only_in_case_are_reported_once() {
    let diagnostic = only(
        "set arany to 1\nset Arany to 2\nprint arany\nprint Arany\nset Arany to 3\n",
        DiagCode::LintCaseCollision,
    );
    assert_eq!(diagnostic.span.line, 2);
    assert!(diagnostic.message.contains("„Arany”") && diagnostic.message.contains("„arany”"));
}

#[test]
fn leading_zeros_get_a_canonical_replacement() {
    let diagnostic = only("print 007\n", DiagCode::LintLeadingZero);
    assert_eq!(diagnostic.severity, Severity::Info);
    assert!(diagnostic.message.contains("„007”"));
    assert_eq!(fixed("print 007\n", DiagCode::LintLeadingZero), "print 7\n");
    assert_eq!(fixed("print 00\n", DiagCode::LintLeadingZero), "print 0\n");
    assert!(codes("print 0\nprint 10\n").is_empty());
}

#[test]
fn consecutive_literal_steps_are_merged() {
    let src = "step forward 2\nstep forward 3\nmine here\n";
    let diagnostic = only(src, DiagCode::LintMergeSteps);
    assert_eq!(diagnostic.severity, Severity::Hint);
    assert_eq!(diagnostic.span.line, 1);
    assert_eq!(
        fixed(src, DiagCode::LintMergeSteps),
        "step forward 5\nmine here\n"
    );
    let three = "while true\n    step forward 1\n    step forward 1\n    step forward 1\n";
    assert_eq!(
        fixed(three, DiagCode::LintMergeSteps),
        "while true\n    step forward 3\n"
    );
}

#[test]
fn merged_steps_stay_within_the_literal_range() {
    assert!(codes("step forward 60\nstep forward 50\n").is_empty());
    let src = "step forward 60\nstep forward 30\nstep forward 20\n";
    let diagnostic = only(src, DiagCode::LintMergeSteps);
    assert!(diagnostic.message.contains("step forward 90"));
    assert_eq!(
        fixed(src, DiagCode::LintMergeSteps),
        "step forward 90\nstep forward 20\n"
    );
}

#[test]
fn runs_are_broken_by_other_statements_and_noops() {
    assert!(
        !codes("step forward 1\nmine here\nstep forward 1\n")
            .iter()
            .any(|(code, _)| *code == DiagCode::LintMergeSteps)
    );
    assert_eq!(
        codes("step forward 1\nstep forward 0\nstep forward 1\n"),
        vec![(DiagCode::LintNoop, 2)]
    );
    assert!(codes("set n to 1\nstep forward n\nstep forward n\n").is_empty());
}

#[test]
fn consecutive_turns_are_merged_modulo_four() {
    let src = "turn by 1\nturn by 2\n";
    assert_eq!(fixed(src, DiagCode::LintMergeTurns), "turn by 3\n");
    let full_circle = "mine here\nturn by 1\nturn by 3\nmine here\n";
    let diagnostic = only(full_circle, DiagCode::LintMergeTurns);
    assert!(diagnostic.message.contains("teljes kört"));
    assert_eq!(
        fixed(full_circle, DiagCode::LintMergeTurns),
        "mine here\nmine here\n"
    );
}

#[test]
fn large_turns_are_reduced_modulo_four() {
    let diagnostic = only("turn by 5\n", DiagCode::LintTurnMod4);
    assert_eq!(diagnostic.severity, Severity::Info);
    assert_eq!(fixed("turn by 5\n", DiagCode::LintTurnMod4), "turn by 1\n");
    assert!(codes("turn by 3\n").is_empty());
}

#[test]
fn statements_without_effect_can_be_deleted() {
    for src in [
        "step forward 0\nmine here\n",
        "turn by 0\nmine here\n",
        "turn by 8\nmine here\n",
    ] {
        assert_eq!(fixed(src, DiagCode::LintNoop), "mine here\n", "{src}");
    }
    let self_assignment = "set x to 1\nset x to x\nprint x\n";
    let diagnostic = only(self_assignment, DiagCode::LintNoop);
    assert!(diagnostic.message.contains("set x to x"));
    assert_eq!(
        fixed(self_assignment, DiagCode::LintNoop),
        "set x to 1\nprint x\n"
    );
    assert_eq!(
        fixed("mine here\nturn by 4", DiagCode::LintNoop),
        "mine here"
    );
}

#[test]
fn diagnostics_are_sorted_by_position() {
    let positions: Vec<(u32, u32)> = lints("print x\nprint 007\nturn by 5\nset u to 1\n")
        .iter()
        .map(|diagnostic| (diagnostic.span.line, diagnostic.span.col_start))
        .collect();
    let mut sorted = positions.clone();
    sorted.sort_unstable();
    assert_eq!(positions, sorted);
    assert_eq!(positions.len(), 4);
}
