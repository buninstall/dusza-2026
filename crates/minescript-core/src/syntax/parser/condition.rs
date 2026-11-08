use super::context::LineContext;
use super::line::is_grammatical;
use crate::diagnostics::{DiagCode, Diagnostic, Fix, TextEdit, messages};
use crate::syntax::ast::BinOp;
use crate::syntax::keywords::{Command, Keyword};
use crate::syntax::lexeme::is_identifier;
use crate::syntax::scanner::{
    CARRIAGE_RETURN, SPACE, ScannedLine, TAB, Word, leading_spaces, scan_line,
};

const IF_NAME: &str = "feltetel";
const WHILE_NAME: &str = "tovabb";
const PLACEHOLDER: &str = "n < 3";

pub(super) fn is_header_operation(command: Command, word: Word<'_>) -> bool {
    matches!(command, Command::If | Command::While) && word.lexeme.binary_operator().is_some()
}

pub(super) fn header_operation(
    command: Command,
    word: Word<'_>,
    context: &LineContext<'_>,
) -> Diagnostic {
    let name = fresh_name(command, context.index.text());
    let operation = operation(context);
    let example = operation.as_ref().map_or(PLACEHOLDER, |found| &found.text);
    Diagnostic::new(DiagCode::SynExtraToken, context.word_span(&word))
        .with_message(messages::header_operation(command, word.text))
        .with_help(messages::header_operation_help(command, &name, example))
        .with_fixes(operation.and_then(|found| rewrite(command, &found, &name, context)))
}

struct Operation {
    text: String,
    start: usize,
}

fn operation(context: &LineContext<'_>) -> Option<Operation> {
    let ScannedLine::Code(line) = scan_line(context.number, context.text) else {
        return None;
    };
    let [_, lhs, op, rhs] = line.words.as_slice() else {
        return None;
    };
    let yields_bool = op
        .lexeme
        .binary_operator()
        .is_some_and(|op| !matches!(op, BinOp::Add | BinOp::Sub | BinOp::Mul));
    let simple = lhs.lexeme.is_simple_value() && rhs.lexeme.is_simple_value();
    (yields_bool && simple).then(|| Operation {
        text: format!("{} {} {}", lhs.text, op.text, rhs.text),
        start: lhs.start,
    })
}

fn rewrite(
    command: Command,
    found: &Operation,
    name: &str,
    context: &LineContext<'_>,
) -> Option<Fix> {
    let assignment = format!("set {name} to {}", found.text);
    if !is_grammatical(&assignment) {
        return None;
    }
    let indent = SPACE.to_string().repeat(leading_spaces(context.text));
    let mut edits = vec![
        context.edit(0, 0, format!("{indent}{assignment}\n")),
        context.edit(found.start, context.text.len(), name),
    ];
    if command == Command::While {
        let (last, body_indent) = loop_body_end(context)?;
        let end = context.index.line_end_utf16(last)?;
        let body_indent = SPACE.to_string().repeat(body_indent);
        edits.push(TextEdit::new(
            end,
            end,
            format!("\n{body_indent}{assignment}"),
        ));
    }
    Some(Fix::new(messages::fix_header_operation(command), edits))
}

fn loop_body_end(context: &LineContext<'_>) -> Option<(u32, usize)> {
    let header_indent = leading_spaces(context.text);
    let mut body_indent = None;
    let mut last = None;
    for number in context.number.saturating_add(1)..=context.index.line_count() {
        let text = context.index.line_text(number)?;
        if text.contains([TAB, CARRIAGE_RETURN]) || text.trim_matches(SPACE).is_empty() {
            return None;
        }
        let indent = leading_spaces(text);
        if indent <= header_indent {
            break;
        }
        if indent < *body_indent.get_or_insert(indent) {
            return None;
        }
        last = Some(number);
    }
    Some((last?, body_indent?))
}

fn fresh_name(command: Command, text: &str) -> String {
    let base = if command == Command::While {
        WHILE_NAME
    } else {
        IF_NAME
    };
    let taken = |candidate: &str| {
        Keyword::ignoring_case(candidate).is_some()
            || text
                .split(|ch: char| !ch.is_ascii_alphanumeric())
                .any(|word| word == candidate && is_identifier(word))
    };
    let bound = u32::try_from(text.len())
        .unwrap_or(u32::MAX)
        .saturating_add(2);
    std::iter::once(base.to_owned())
        .chain((2..=bound).map(|suffix| format!("{base}{suffix}")))
        .find(|candidate| !taken(candidate))
        .unwrap_or_else(|| base.to_owned())
}
