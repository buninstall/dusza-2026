use super::*;
use crate::diagnostics::{DiagCode, Fix, Severity};
use crate::source::normalize;
use crate::syntax::ast::{BinOp, ElseBranch, Expr, Simple, Stmt, StmtKind};

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

fn codes(src: &str) -> Vec<(DiagCode, u32)> {
    parse(src)
        .diagnostics
        .iter()
        .map(|diagnostic| (diagnostic.code, diagnostic.span.line))
        .collect()
}

fn only(src: &str) -> Diagnostic {
    let result = parse(src);
    assert!(result.program.is_none(), "{src:?}");
    assert_eq!(
        result.diagnostics.len(),
        1,
        "{src:?}: {:?}",
        result.diagnostics
    );
    result.diagnostics.into_iter().next().unwrap()
}

fn program(src: &str) -> Program {
    let result = parse(src);
    assert!(result.diagnostics.is_empty(), "{:?}", result.diagnostics);
    result.program.unwrap()
}

fn byte_offset(text: &str, utf16: u32) -> usize {
    let mut units = 0;
    for (offset, ch) in text.char_indices() {
        if units >= utf16 {
            return offset;
        }
        units += u32::try_from(ch.len_utf16()).unwrap();
    }
    text.len()
}

fn apply(src: &str, fix: &Fix) -> String {
    let mut text = normalize(src);
    let mut edits = fix.edits.clone();
    edits.sort_by_key(|edit| std::cmp::Reverse(edit.from));
    for edit in edits {
        let from = byte_offset(&text, edit.from);
        let to = byte_offset(&text, edit.to);
        text.replace_range(from..to, &edit.insert);
    }
    text
}

fn fixed(src: &str) -> String {
    let diagnostic = only(src);
    let fix = diagnostic.fixes.first().expect("javítás kell");
    apply(src, fix)
}

fn simple_int(stmt: &Stmt) -> i64 {
    match &stmt.kind {
        StmtKind::Step {
            count: Simple::Int { value, .. },
        } => *value,
        other => panic!("{other:?}"),
    }
}

#[test]
fn empty_sources_are_empty_programs() {
    for src in ["", "\n", "\u{feff}", "\u{feff}\r\n"] {
        assert_eq!(program(src), Program::default(), "{src:?}");
    }
}

#[test]
fn spec_example_parses_into_nested_blocks() {
    let program = program(SPEC_PROGRAM);
    assert_eq!(program.body.len(), 5);
    let StmtKind::While { cond, body } = &program.body[3].kind else {
        panic!("while kell");
    };
    assert!(matches!(cond, Simple::Ident { name, .. } if name == "megy"));
    assert_eq!(body.len(), 4);
    let StmtKind::If {
        then_body,
        else_branch:
            Some(ElseBranch {
                line,
                body: else_body,
                ..
            }),
        ..
    } = &body[1].kind
    else {
        panic!("if-else kell");
    };
    assert_eq!(then_body.len(), 3);
    assert_eq!(*line, 10);
    assert_eq!(else_body.len(), 1);
    assert_eq!(else_body[0].line, 11);
    assert_eq!(program.body[4].line, 14);
}

#[test]
fn spec_example_ast_is_stable() {
    insta::assert_json_snapshot!("spec_example_ast", parse(SPEC_PROGRAM));
}

#[test]
fn statement_spans_cover_the_content_without_indentation() {
    let program = program("while true\n    step forward 12\n");
    let StmtKind::While { body, .. } = &program.body[0].kind else {
        panic!("while kell");
    };
    let step = &body[0];
    assert_eq!(step.line, 2);
    assert_eq!((step.span.col_start, step.span.col_end), (5, 20));
    assert_eq!((step.span.from, step.span.to), (15, 30));
    let StmtKind::Step { count } = &step.kind else {
        panic!("step kell");
    };
    assert_eq!((count.span().from, count.span().to), (28, 30));
    assert_eq!(simple_int(step), 12);
}

#[test]
fn spans_refer_to_the_normalized_text() {
    let program = program("\u{feff}print 1\r\nprint 7\r\n");
    let StmtKind::Print { value } = &program.body[1].kind else {
        panic!("print kell");
    };
    assert_eq!(program.body[1].span.from, 8);
    assert_eq!(value.span().from, 14);
}

#[test]
fn every_expression_form_reaches_the_ast() {
    let program = program(
        "set a to 5\nset b to isThere 2\nset c to not b\nset d to a * 3\nset e to a <> d\n",
    );
    let values: Vec<&Expr> = program
        .body
        .iter()
        .map(|stmt| match &stmt.kind {
            StmtKind::Set { value, .. } => value,
            other => panic!("{other:?}"),
        })
        .collect();
    assert!(matches!(values[0], Expr::Simple { .. }));
    assert!(matches!(values[1], Expr::IsThere { .. }));
    assert!(matches!(values[2], Expr::Not { .. }));
    assert!(matches!(values[3], Expr::Binary { op: BinOp::Mul, .. }));
    assert!(matches!(values[4], Expr::Binary { op: BinOp::Ne, .. }));
}

#[test]
fn empty_blocks_are_valid() {
    let program = program("set t to true\nwhile t\nif t\nelse\n");
    assert!(matches!(&program.body[1].kind, StmtKind::While { body, .. } if body.is_empty()));
    assert!(matches!(
        &program.body[2].kind,
        StmtKind::If { then_body, else_branch: Some(branch), .. }
            if then_body.is_empty() && branch.body.is_empty()
    ));
}

#[test]
fn lone_carriage_return_is_reported_once_and_replaceable() {
    let diagnostic = only("print 1\rprint 2");
    assert_eq!(diagnostic.code, DiagCode::SynLoneCr);
    assert_eq!(diagnostic.span.col_start, 8);
    assert_eq!(fixed("print 1\rprint 2"), "print 1\nprint 2");
}

#[test]
fn tab_is_reported_once_and_replaced_by_spaces() {
    let src = "while true\n\tprint\t1";
    let diagnostic = only(src);
    assert_eq!(diagnostic.code, DiagCode::SynTab);
    assert_eq!((diagnostic.span.line, diagnostic.span.col_start), (2, 1));
    assert_eq!(fixed(src), "while true\n    print 1");
}

#[test]
fn carriage_return_wins_over_tab_and_tab_over_emptiness() {
    assert_eq!(codes("\t\r"), vec![(DiagCode::SynLoneCr, 1)]);
    assert_eq!(codes("  \t  "), vec![(DiagCode::SynTab, 1)]);
    assert_eq!(codes("   "), vec![(DiagCode::SynEmptyLine, 1)]);
}

#[test]
fn empty_lines_are_deleted_by_their_fix() {
    assert_eq!(fixed("print 1\n\nprint 2\n"), "print 1\nprint 2\n");
    assert_eq!(fixed("print 1\n   "), "print 1");
    assert_eq!(fixed("print 1\n\n"), "print 1\n");
}

#[test]
fn scanner_faulty_lines_are_skipped_by_the_layout() {
    let src = "if t\n    print 1\n\t\nelse\n    print 2\n";
    assert_eq!(codes(src), vec![(DiagCode::SynTab, 3)]);
    assert_eq!(
        codes("\n  print 1\n"),
        vec![
            (DiagCode::SynEmptyLine, 1),
            (DiagCode::SynToplevelIndent, 2)
        ]
    );
}

#[test]
fn double_space_points_at_the_extra_spaces() {
    let diagnostic = only("print   1");
    assert_eq!(diagnostic.code, DiagCode::SynDoubleSpace);
    assert_eq!((diagnostic.span.col_start, diagnostic.span.col_end), (7, 9));
    assert!(diagnostic.message.contains('3'));
    assert_eq!(fixed("print   1"), "print 1");
}

#[test]
fn trailing_space_is_deleted_by_its_fix() {
    let diagnostic = only("mine here  ");
    assert_eq!(diagnostic.code, DiagCode::SynTrailingSpace);
    assert_eq!(diagnostic.span.col_start, 10);
    assert_eq!(fixed("mine here  "), "mine here");
    assert_eq!(
        codes("step forward "),
        vec![(DiagCode::SynTrailingSpace, 1)]
    );
}

#[test]
fn number_range_and_invalid_words() {
    let range = only("print 101");
    assert_eq!(range.code, DiagCode::SynNumberRange);
    assert!(range.message.contains("101"));
    assert_eq!(only("set a_b to 1").code, DiagCode::SynInvalidIdent);
    assert_eq!(only("set árany to 1").code, DiagCode::SynInvalidIdent);
    assert_eq!(only("print 1a").code, DiagCode::SynInvalidToken);
    assert_eq!(only("print (").code, DiagCode::SynInvalidToken);
    assert_eq!(only("set x 101").code, DiagCode::SynNumberRange);
}

#[test]
fn glued_operators_and_negative_literals_get_verified_fixes() {
    assert_eq!(fixed("set a to 1+2"), "set a to 1 + 2");
    assert_eq!(fixed("set a to x<=y"), "set a to x <= y");
    assert_eq!(fixed("set a to -5"), "set a to 0 - 5");
    assert_eq!(only("set a to a+b").code, DiagCode::SynInvalidIdent);
    assert_eq!(fixed("set a to a+b"), "set a to a + b");
    assert!(only("print -5").fixes.is_empty());
    assert!(only("print 1+2").fixes.is_empty());
    assert!(only("set a to -5 + 1").fixes.is_empty());
    let with_trailing_space = parse("set a to 1+2 ");
    assert_eq!(
        with_trailing_space.diagnostics[0].fixes[0].edits[0].insert,
        "1 + 2"
    );
}

#[test]
fn unknown_command_suggests_the_case_insensitive_match() {
    let diagnostic = only("Step forward 1");
    assert_eq!(diagnostic.code, DiagCode::SynUnknownCommand);
    assert!(diagnostic.message.contains("„Step”"));
    assert!(diagnostic.help.as_deref().unwrap().contains("„step”"));
    assert_eq!(fixed("Step forward 1"), "step forward 1");
    let unknown = only("jump 3");
    assert_eq!(unknown.code, DiagCode::SynUnknownCommand);
    assert!(unknown.fixes.is_empty());
    assert_eq!(
        unknown.help.as_deref(),
        crate::diagnostics::help(DiagCode::SynUnknownCommand)
    );
    assert!(only("forward 1").fixes.is_empty());
}

#[test]
fn missing_tokens_are_reported_at_the_line_end() {
    for src in [
        "step forward",
        "set x to",
        "set x to 1 +",
        "if",
        "mine",
        "while",
        "turn by",
    ] {
        let diagnostic = only(src);
        assert_eq!(diagnostic.code, DiagCode::SynMissingToken, "{src}");
        let end = u32::try_from(src.len()).unwrap() + 1;
        assert_eq!(diagnostic.span.col_start, end, "{src}");
        assert!(diagnostic.span.is_empty());
        assert!(
            diagnostic
                .help
                .as_deref()
                .unwrap()
                .starts_with("Az utasítás alakja")
        );
    }
}

#[test]
fn extra_tokens_are_deleted_by_their_fix() {
    for (src, expected) in [
        ("print 1 2", "print 1"),
        ("mine here now", "mine here"),
        ("else x", "else"),
        ("set x to 1 + 2 + 3", "set x to 1 + 2"),
    ] {
        let diagnostic = only(&format!("if true\n{src}"));
        assert_eq!(diagnostic.code, DiagCode::SynExtraToken, "{src}");
        assert_eq!(
            fixed(&format!("if true\n{src}")),
            format!("if true\n{expected}")
        );
    }
}

#[test]
fn unexpected_tokens_explain_the_expected_form() {
    for src in [
        "step back 1",
        "turn 1",
        "mine there",
        "set x 1",
        "print while",
        "set 5 to 1",
        "set true to 1",
        "set x to 1 2",
    ] {
        assert_eq!(only(src).code, DiagCode::SynUnexpectedToken, "{src}");
    }
    let wrong_case = only("step Forward 1");
    assert!(wrong_case.message.contains("a „forward” kulcsszó"));
    assert_eq!(fixed("step Forward 1"), "step forward 1");
    assert_eq!(fixed("set x to a OR b"), "set x to a or b");
}

#[test]
fn functions_in_conditions_suggest_an_assignment() {
    let diagnostic = only("if isThere 2\n    print 1");
    assert_eq!(diagnostic.code, DiagCode::SynUnexpectedToken);
    assert!(
        diagnostic
            .help
            .as_deref()
            .unwrap()
            .contains("set van to isThere 2")
    );
    let negation = only("while not x");
    assert!(negation.help.as_deref().unwrap().contains("not"));
}

#[test]
fn reserved_identifiers_are_fixed_only_where_the_keyword_fits() {
    let name = only("set If to 1");
    assert_eq!(name.code, DiagCode::SynReservedIdent);
    assert!(name.fixes.is_empty());
    assert!(name.message.contains("„If”"));
    assert_eq!(fixed("print TRUE"), "print true");
    assert_eq!(fixed("set x to isthere 2"), "set x to isThere 2");
    assert_eq!(fixed("set x to NOT y"), "set x to not y");
    assert!(only("print Step").fixes.is_empty());
}

#[test]
fn every_line_is_checked_and_diagnostics_are_sorted() {
    assert_eq!(
        codes("print  1\nStep forward 1\nprint 101\n"),
        vec![
            (DiagCode::SynDoubleSpace, 1),
            (DiagCode::SynUnknownCommand, 2),
            (DiagCode::SynNumberRange, 3)
        ]
    );
}

#[test]
fn a_line_can_have_one_indentation_and_one_token_fault() {
    let result = parse("print 1\n    print  2  ");
    let found: Vec<(DiagCode, u32)> = result
        .diagnostics
        .iter()
        .map(|diagnostic| (diagnostic.code, diagnostic.span.col_start))
        .collect();
    assert_eq!(
        found,
        vec![
            (DiagCode::SynUnexpectedIndent, 1),
            (DiagCode::SynDoubleSpace, 11)
        ]
    );
}

#[test]
fn toplevel_indent_fix_removes_the_spaces() {
    let diagnostic = only("  print 1");
    assert_eq!(diagnostic.code, DiagCode::SynToplevelIndent);
    assert_eq!((diagnostic.span.col_start, diagnostic.span.col_end), (1, 3));
    assert_eq!(fixed("  print 1"), "print 1");
}

#[test]
fn unexpected_indent_fix_aligns_to_the_block() {
    assert_eq!(fixed("print 1\n    print 2"), "print 1\nprint 2");
}

#[test]
fn inconsistent_indent_fix_aligns_to_the_block() {
    let src = "while true\n    print 1\n      print 2";
    let diagnostic = only(src);
    assert_eq!(diagnostic.code, DiagCode::SynInconsistentIndent);
    assert!(diagnostic.message.contains('4') && diagnostic.message.contains('6'));
    assert_eq!(fixed(src), "while true\n    print 1\n    print 2");
}

#[test]
fn dedent_mismatch_lists_the_open_levels() {
    let src = "while true\n    print 1\n  print 2";
    let diagnostic = only(src);
    assert_eq!(diagnostic.code, DiagCode::SynDedentMismatch);
    assert!(diagnostic.message.contains("0, 4"));
    assert_eq!(fixed(src), "while true\n    print 1\nprint 2");
}

#[test]
fn else_without_if_points_at_the_else() {
    let diagnostic = only("print 1\nelse\n    print 2");
    assert_eq!(diagnostic.code, DiagCode::SynElseWithoutIf);
    assert_eq!((diagnostic.span.line, diagnostic.span.col_start), (2, 1));
    assert_eq!(
        codes("if a\n    print 1\nelse\nelse\n"),
        vec![(DiagCode::SynElseWithoutIf, 4)]
    );
}

#[test]
fn erroneous_headers_still_open_blocks() {
    assert_eq!(
        codes("if isThere 2\n    print 1\nelse x\n    print 2\n"),
        vec![
            (DiagCode::SynUnexpectedToken, 1),
            (DiagCode::SynExtraToken, 3)
        ]
    );
    assert_eq!(
        codes("while\n    print 1"),
        vec![(DiagCode::SynMissingToken, 1)]
    );
}

#[test]
fn wrong_case_headers_do_not_open_blocks() {
    assert_eq!(
        codes("If a\n    print 1"),
        vec![
            (DiagCode::SynUnknownCommand, 1),
            (DiagCode::SynUnexpectedIndent, 2)
        ]
    );
}

#[test]
fn any_error_withholds_the_program() {
    let result = parse("print 1\nprint 101");
    assert!(result.program.is_none());
    assert!(
        result
            .diagnostics
            .iter()
            .all(|d| d.severity == Severity::Error)
    );
}

#[test]
fn diagnostics_of_a_broken_program_are_stable() {
    let src = "set If to 1\n  step forward\nwhile  x\nelse\n\tprint 1\nset a to 1+2 \nprint -5\n";
    insta::assert_json_snapshot!("broken_program_diagnostics", parse(src).diagnostics);
}

fn positions(src: &str) -> Vec<(DiagCode, u32, u32)> {
    parse(src)
        .diagnostics
        .iter()
        .map(|diagnostic| {
            (
                diagnostic.code,
                diagnostic.span.line,
                diagnostic.span.col_start,
            )
        })
        .collect()
}

#[test]
fn class_errors_win_over_grammar_errors_on_the_same_token() {
    assert_eq!(positions("# x"), vec![(DiagCode::SynInvalidToken, 1, 1)]);
    assert_eq!(
        positions("step 101"),
        vec![(DiagCode::SynNumberRange, 1, 6)]
    );
}

#[test]
fn trailing_spaces_beat_missing_tokens_and_are_reported_once() {
    assert_eq!(
        positions("print "),
        vec![(DiagCode::SynTrailingSpace, 1, 6)]
    );
    assert_eq!(
        positions("print 1   "),
        vec![(DiagCode::SynTrailingSpace, 1, 8)]
    );
}

#[test]
fn reserved_identifiers_only_in_name_positions() {
    assert_eq!(
        positions("set and to 1"),
        vec![(DiagCode::SynUnexpectedToken, 1, 5)]
    );
    assert_eq!(
        positions("set true to 1"),
        vec![(DiagCode::SynUnexpectedToken, 1, 5)]
    );
    assert_eq!(
        positions("set And to 1"),
        vec![(DiagCode::SynReservedIdent, 1, 5)]
    );
    assert_eq!(
        positions("print Not"),
        vec![(DiagCode::SynReservedIdent, 1, 7)]
    );
    assert_eq!(
        positions("step Forward 1"),
        vec![(DiagCode::SynUnexpectedToken, 1, 6)]
    );
    assert_eq!(positions("If x"), vec![(DiagCode::SynUnknownCommand, 1, 1)]);
}

#[test]
fn only_exact_header_keywords_open_blocks() {
    assert_eq!(
        positions("WHILE true\n    print 1"),
        vec![
            (DiagCode::SynUnknownCommand, 1, 1),
            (DiagCode::SynUnexpectedIndent, 2, 1)
        ]
    );
}

#[test]
fn else_without_if_is_the_single_indentation_error_of_its_line() {
    assert_eq!(
        positions("else x"),
        vec![
            (DiagCode::SynElseWithoutIf, 1, 1),
            (DiagCode::SynExtraToken, 1, 6)
        ]
    );
    assert_eq!(
        positions("print 1\n  else"),
        vec![(DiagCode::SynUnexpectedIndent, 2, 1)]
    );
    assert_eq!(
        positions("if a\n    print 1\n    else"),
        vec![(DiagCode::SynElseWithoutIf, 3, 5)]
    );
}

#[test]
fn columns_follow_the_documented_anchors() {
    assert_eq!(positions("print 1\r"), vec![(DiagCode::SynLoneCr, 1, 8)]);
    assert_eq!(positions("print\t1"), vec![(DiagCode::SynTab, 1, 6)]);
    assert_eq!(
        positions("print 1  + 2"),
        vec![(DiagCode::SynDoubleSpace, 1, 9)]
    );
    assert_eq!(
        positions("print 1\n   \nprint 2"),
        vec![(DiagCode::SynEmptyLine, 2, 1)]
    );
    assert_eq!(
        positions("ő 1\nprint  1"),
        vec![
            (DiagCode::SynInvalidIdent, 1, 1),
            (DiagCode::SynDoubleSpace, 2, 7)
        ]
    );
    assert_eq!(positions("ő😀\tx"), vec![(DiagCode::SynTab, 1, 4)]);
}

#[test]
fn unicode_alphabetic_or_underscore_starts_an_invalid_identifier() {
    assert_eq!(positions("print ŉx")[0].0, DiagCode::SynInvalidIdent);
    assert_eq!(positions("print _")[0].0, DiagCode::SynInvalidIdent);
    assert_eq!(positions("print ٣")[0].0, DiagCode::SynInvalidToken);
}

#[test]
fn line_splitting_follows_d2_exactly() {
    assert_eq!(
        positions("print 1\r\r\nprint 2"),
        vec![(DiagCode::SynLoneCr, 1, 8)]
    );
    assert_eq!(
        positions("\n\n"),
        vec![
            (DiagCode::SynEmptyLine, 1, 1),
            (DiagCode::SynEmptyLine, 2, 1)
        ]
    );
    assert_eq!(
        positions("print 1\n\n"),
        vec![(DiagCode::SynEmptyLine, 2, 1)]
    );
    assert_eq!(program("\u{feff}"), Program::default());
    assert_eq!(
        positions("print \0"),
        vec![(DiagCode::SynInvalidToken, 1, 7)]
    );
    assert_eq!(positions("\0"), vec![(DiagCode::SynInvalidToken, 1, 1)]);
}

#[test]
fn comparison_in_if_header_is_rewritten_with_set() {
    let src = "set a to 1\nset b to 2\nif a < b\n    print a\nelse\n    print b\n";
    let diagnostic = parse(src).diagnostics.into_iter().next().unwrap();
    assert_eq!(diagnostic.code, DiagCode::SynExtraToken);
    assert_eq!((diagnostic.span.line, diagnostic.span.col_start), (3, 6));
    assert!(
        diagnostic.message.contains("csak egyetlen érték"),
        "{}",
        diagnostic.message
    );
    assert!(
        diagnostic
            .help
            .as_deref()
            .unwrap()
            .contains("set feltetel to a < b")
    );
    assert_eq!(diagnostic.fixes.len(), 1);
    assert_eq!(
        fixed(src),
        "set a to 1\nset b to 2\nset feltetel to a < b\nif feltetel\n    print a\nelse\n    print b\n"
    );
}

#[test]
fn comparison_in_while_header_is_recomputed_at_the_end_of_the_body() {
    let src = "set n to 0\nwhile n < 3\n    set n to n + 1\n    if n = 2\n      print n\nprint 9\n";
    let diagnostics = parse(src).diagnostics;
    let first = diagnostics.first().unwrap();
    assert!(first.help.as_deref().unwrap().contains("while tovabb"));
    let rewritten = apply(src, first.fixes.first().unwrap());
    assert_eq!(
        rewritten,
        "set n to 0\nset tovabb to n < 3\nwhile tovabb\n    set n to n + 1\n    if n = 2\n      print n\n    set tovabb to n < 3\nprint 9\n"
    );
}

#[test]
fn rewritten_while_header_runs_like_the_intended_loop() {
    let nested = "set n to 0\nif true\n  while n < 3\n    set n to n + 1\n    print n\nprint 9\n";
    assert_eq!(
        fixed(nested),
        "set n to 0\nif true\n  set tovabb to n < 3\n  while tovabb\n    set n to n + 1\n    print n\n    set tovabb to n < 3\nprint 9\n"
    );
    let repaired = fixed(nested);
    let map = crate::map::parse_map("1 1\n>\n").map.unwrap();
    let result = crate::runtime::run(&repaired, &map);
    assert!(result.is_ok(), "{:?}", result.outcome);
    assert_eq!(result.console, ["1", "2", "3", "9"]);
}

#[test]
fn header_operation_never_offers_the_meaning_changing_deletion() {
    for src in [
        "set n to 1\nwhile n + 1\n    print n\n",
        "set n to 1\nif n < 3 4\n    print n\n",
        "set n to 1\nwhile n < 3\n",
        "set n to 1\nwhile n < 3\n\tprint n\n",
        "set n to 1\nwhile n < 3\n    print n\n  print n\n",
        "set n to 1\nif n < isThere\n    print n\n",
    ] {
        let diagnostic = parse(src)
            .diagnostics
            .into_iter()
            .find(|diagnostic| diagnostic.span.line == 2)
            .unwrap();
        assert_eq!(diagnostic.code, DiagCode::SynExtraToken, "{src:?}");
        assert!(
            diagnostic.fixes.is_empty(),
            "{src:?}: {:?}",
            diagnostic.fixes
        );
        assert!(
            diagnostic.message.contains("csak egyetlen érték"),
            "{src:?}"
        );
    }
}

#[test]
fn header_operation_picks_a_name_that_is_not_taken() {
    let src = "set tovabb to 1\nset tovabb2 to 2\nset Tovabb3 to 3\nwhile tovabb < tovabb2\n    print tovabb\n";
    let rewritten = fixed(src);
    assert!(
        rewritten.contains("set tovabb3 to tovabb < tovabb2\nwhile tovabb3\n"),
        "{rewritten}"
    );
    assert!(
        rewritten.ends_with("    print tovabb\n    set tovabb3 to tovabb < tovabb2\n"),
        "{rewritten}"
    );
}

#[test]
fn other_extra_tokens_still_offer_deletion() {
    let diagnostic = only("print 1 2\n");
    assert_eq!(diagnostic.fixes.len(), 1);
    let diagnostic = only("if true false\n");
    assert_eq!(diagnostic.code, DiagCode::SynExtraToken);
    assert_eq!(diagnostic.fixes.len(), 1);
}
