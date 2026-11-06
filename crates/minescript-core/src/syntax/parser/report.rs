use super::context::LineContext;
use super::faults::TokenFault;
use super::layout::IndentFault;
use super::line::{Expectation, GrammarFault, is_grammatical};
use super::repair::respaced;
use crate::diagnostics::messages;
use crate::diagnostics::{DiagCode, Diagnostic, Fix, TextEdit};
use crate::source::LineIndex;
use crate::syntax::keywords::{Command, Keyword};
use crate::syntax::lexeme::{Lexeme, Malformation};
use crate::syntax::scanner::{
    CARRIAGE_RETURN, CodeLine, FaultyLine, LineFault, SPACE, SpacingFault, SpacingKind, TAB,
    TAB_AS_INDENT, Word,
};

const LINE_BREAK: &str = "\n";
const SINGLE_SPACE: &str = " ";

pub(super) fn line_fault(line: &FaultyLine<'_>, index: &LineIndex<'_>) -> Diagnostic {
    let context = LineContext::new(index, line.number, line.text);
    let marker = context.span(line.column, line.column + 1);
    match line.fault {
        LineFault::LoneCarriageReturn => {
            Diagnostic::new(DiagCode::SynLoneCr, marker).with_fix(Fix::new(
                messages::FIX_REPLACE_CARRIAGE_RETURN,
                carriage_return_replacements(&context),
            ))
        }
        LineFault::Tab => Diagnostic::new(DiagCode::SynTab, marker).with_fix(Fix::new(
            messages::FIX_REPLACE_TABS,
            tab_replacements(&context),
        )),
        LineFault::Empty => {
            Diagnostic::new(DiagCode::SynEmptyLine, context.span(0, line.text.len()))
                .with_fixes(Fix::removing_lines(index, line.number, line.number))
        }
    }
}

fn carriage_return_replacements(context: &LineContext<'_>) -> Vec<TextEdit> {
    context.replacements(
        context
            .text
            .match_indices(CARRIAGE_RETURN)
            .map(|(offset, _)| (offset, offset + 1, LINE_BREAK)),
    )
}

fn tab_replacements(context: &LineContext<'_>) -> Vec<TextEdit> {
    let text = context.text;
    let indentation_end = text.len() - text.trim_start_matches([SPACE, TAB]).len();
    context.replacements(text.match_indices(TAB).map(|(offset, _)| {
        let replacement = if offset < indentation_end {
            TAB_AS_INDENT
        } else {
            SINGLE_SPACE
        };
        (offset, offset + 1, replacement)
    }))
}

pub(super) fn token_fault(fault: TokenFault<'_>, context: &LineContext<'_>) -> Diagnostic {
    match fault {
        TokenFault::Spacing(spacing) => spacing_fault(spacing, context),
        TokenFault::Malformed(word, malformation) => malformed_word(word, malformation, context),
        TokenFault::Grammar(grammar) => grammar_fault(grammar, context),
    }
}

fn spacing_fault(fault: SpacingFault, context: &LineContext<'_>) -> Diagnostic {
    let span = context.span(fault.start, fault.end);
    let deletion = context.edit(fault.start, fault.end, "");
    match fault.kind {
        SpacingKind::Double => Diagnostic::new(DiagCode::SynDoubleSpace, span)
            .with_message(messages::double_space(fault.end - fault.start + 1))
            .with_fix(Fix::single(messages::FIX_DELETE_SPACES, deletion)),
        SpacingKind::Trailing => Diagnostic::new(DiagCode::SynTrailingSpace, span)
            .with_fix(Fix::single(messages::FIX_DELETE_TRAILING, deletion)),
    }
}

fn malformed_word(
    word: Word<'_>,
    malformation: Malformation,
    context: &LineContext<'_>,
) -> Diagnostic {
    let diagnostic = Diagnostic::new(malformation.code(), context.word_span(&word));
    match malformation {
        Malformation::NumberRange => diagnostic.with_message(messages::number_range(word.text)),
        Malformation::InvalidIdent => diagnostic
            .with_message(messages::invalid_ident(word.text))
            .with_fixes(respacing_fix(word, context)),
        Malformation::InvalidToken => diagnostic
            .with_message(messages::invalid_token(word.text))
            .with_fixes(respacing_fix(word, context)),
    }
}

fn respacing_fix(word: Word<'_>, context: &LineContext<'_>) -> Option<Fix> {
    let replacement = respaced(word.text)?;
    let before = context.text.get(..word.start)?;
    let after = context.text.get(word.end()..)?;
    is_grammatical(&format!("{before}{replacement}{after}"))
        .then(|| replacement_fix(word, &replacement, context))
}

fn replacement_fix(word: Word<'_>, replacement: &str, context: &LineContext<'_>) -> Fix {
    Fix::single(
        messages::replace_with(replacement),
        context.edit(word.start, word.end(), replacement),
    )
}

fn case_fix(word: Word<'_>, expected: Expectation, context: &LineContext<'_>) -> Option<Fix> {
    match word.lexeme {
        Lexeme::Reserved(keyword) if expected.accepts(keyword) => {
            Some(replacement_fix(word, keyword.as_str(), context))
        }
        _ => None,
    }
}

fn grammar_fault(fault: GrammarFault<'_>, context: &LineContext<'_>) -> Diagnostic {
    match fault {
        GrammarFault::UnknownCommand(word) => unknown_command(word, context),
        GrammarFault::Missing { expected, command } => missing_token(expected, command, context),
        GrammarFault::Extra { word, command } => {
            Diagnostic::new(DiagCode::SynExtraToken, context.word_span(&word))
                .with_message(messages::extra_token(word.text))
                .with_help(messages::command_form(command))
                .with_fix(Fix::single(
                    messages::FIX_DELETE_EXTRA_TOKENS,
                    context.edit(word.start.saturating_sub(1), context.text.len(), ""),
                ))
        }
        GrammarFault::Unexpected {
            word,
            expected,
            command,
        } => Diagnostic::new(DiagCode::SynUnexpectedToken, context.word_span(&word))
            .with_message(messages::unexpected_token(word.text, &describe(expected)))
            .with_help(unexpected_help(word, expected, command))
            .with_fixes(case_fix(word, expected, context)),
        GrammarFault::Reserved {
            word,
            keyword,
            expected,
        } => {
            let diagnostic = Diagnostic::new(DiagCode::SynReservedIdent, context.word_span(&word))
                .with_message(messages::reserved_ident(word.text, keyword.as_str()));
            match case_fix(word, expected, context) {
                Some(fix) => diagnostic
                    .with_help(messages::did_you_mean(keyword.as_str()))
                    .with_fix(fix),
                None => diagnostic,
            }
        }
    }
}

fn unknown_command(word: Word<'_>, context: &LineContext<'_>) -> Diagnostic {
    let diagnostic = Diagnostic::new(DiagCode::SynUnknownCommand, context.word_span(&word))
        .with_message(messages::unknown_command(word.text));
    match (word.lexeme, case_fix(word, Expectation::Command, context)) {
        (Lexeme::Reserved(keyword), Some(fix)) => diagnostic
            .with_help(messages::did_you_mean(keyword.as_str()))
            .with_fix(fix),
        _ => diagnostic,
    }
}

fn missing_token(
    expected: Expectation,
    command: Option<Command>,
    context: &LineContext<'_>,
) -> Diagnostic {
    let end = context.text.len();
    let diagnostic = Diagnostic::new(DiagCode::SynMissingToken, context.span(end, end))
        .with_message(messages::missing_token(&describe(expected)));
    match command {
        Some(command) => diagnostic.with_help(messages::command_form(command)),
        None => diagnostic,
    }
}

fn unexpected_help(word: Word<'_>, expected: Expectation, command: Command) -> String {
    match (word.lexeme, expected) {
        (Lexeme::Keyword(keyword @ (Keyword::IsThere | Keyword::Not)), Expectation::Value) => {
            messages::needs_assignment(keyword)
        }
        _ => None,
    }
    .unwrap_or_else(|| messages::command_form(command))
}

fn describe(expected: Expectation) -> String {
    match expected {
        Expectation::Command => messages::EXPECTED_COMMAND.to_owned(),
        Expectation::Keyword(keyword) => messages::expected_keyword(keyword.as_str()),
        Expectation::Value => messages::EXPECTED_VALUE.to_owned(),
        Expectation::Target => messages::EXPECTED_TARGET.to_owned(),
        Expectation::Operator => messages::EXPECTED_OPERATOR.to_owned(),
        Expectation::Expression => messages::EXPECTED_EXPRESSION.to_owned(),
    }
}

pub(super) fn indent_fault(
    fault: IndentFault,
    line: &CodeLine<'_>,
    context: &LineContext<'_>,
) -> Diagnostic {
    let indent = line.indent;
    let indentation = context.span(0, indent);
    match fault {
        IndentFault::Toplevel => Diagnostic::new(DiagCode::SynToplevelIndent, indentation)
            .with_message(messages::toplevel_indent(indent))
            .with_fix(reindent(indent, 0, context)),
        IndentFault::Unexpected { block_indent } => {
            Diagnostic::new(DiagCode::SynUnexpectedIndent, indentation)
                .with_message(messages::unexpected_indent(indent))
                .with_fix(reindent(indent, block_indent, context))
        }
        IndentFault::Inconsistent { block_indent } => {
            Diagnostic::new(DiagCode::SynInconsistentIndent, indentation)
                .with_message(messages::inconsistent_indent(block_indent, indent))
                .with_fix(reindent(indent, block_indent, context))
        }
        IndentFault::DedentMismatch {
            nearest,
            open_levels,
        } => Diagnostic::new(DiagCode::SynDedentMismatch, indentation)
            .with_message(messages::dedent_mismatch(indent, &open_levels))
            .with_fix(reindent(indent, nearest, context)),
        IndentFault::ElseWithoutIf => {
            let span = line
                .words
                .first()
                .map_or(indentation, |word| context.word_span(word));
            Diagnostic::new(DiagCode::SynElseWithoutIf, span)
        }
    }
}

fn reindent(current: usize, target: usize, context: &LineContext<'_>) -> Fix {
    let title = if target == 0 {
        messages::FIX_REMOVE_INDENT.to_owned()
    } else {
        messages::reindent_to(target)
    };
    Fix::single(title, context.edit(0, current, SINGLE_SPACE.repeat(target)))
}
