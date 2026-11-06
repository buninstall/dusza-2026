use super::Hover;
use super::docs::keyword_doc;
use super::outline::{code_lines, first_assignments};
use crate::diagnostics::messages;
use crate::lint::{type_name, variable_types};
use crate::source::{LineIndex, normalize};
use crate::span::Span;
use crate::syntax::keywords::Keyword;
use crate::syntax::lexeme::{Lexeme, classify};
use crate::syntax::parse;

pub fn hover(src: &str, offset: u32) -> Option<Hover> {
    let text = normalize(src);
    let index = LineIndex::new(&text);
    let (line, byte_col) = index.position_of_utf16(offset)?;
    let line_text = index.line_text(line)?;
    let (start, end) = word_around(line_text, byte_col)?;
    let word = line_text.get(start..end)?;
    let is_first_word = line_text.get(..start)?.trim_start_matches(' ').is_empty();
    let contents = match classify(word) {
        Lexeme::Keyword(keyword) => keyword_doc(keyword.as_str())?.to_owned(),
        Lexeme::Bool(value) => keyword_doc(bool_keyword(value).as_str())?.to_owned(),
        Lexeme::Ident if !is_first_word => variable_description(src, &text, word),
        _ => return None,
    };
    Some(Hover {
        contents,
        span: Span::in_line(&index, line, start, end),
    })
}

fn word_around(line_text: &str, byte_col: usize) -> Option<(usize, usize)> {
    let is_word_byte = |byte: &u8| byte.is_ascii_alphanumeric();
    let bytes = line_text.as_bytes();
    let start = bytes
        .get(..byte_col)?
        .iter()
        .rposition(|byte| !is_word_byte(byte))
        .map_or(0, |position| position + 1);
    let end = bytes
        .get(byte_col..)?
        .iter()
        .position(|byte| !is_word_byte(byte))
        .map_or(bytes.len(), |position| byte_col + position);
    (start < end).then_some((start, end))
}

fn bool_keyword(value: bool) -> Keyword {
    if value { Keyword::True } else { Keyword::False }
}

fn variable_description(src: &str, text: &str, name: &str) -> String {
    if let Some(program) = parse(src).program
        && let Some(info) = variable_types(&program).get(name)
    {
        return messages::variable_hover(
            name,
            info.value_type.map(type_name),
            Some(info.first_line),
        );
    }
    let lines = code_lines(text);
    let first_line = first_assignments(&lines)
        .into_iter()
        .find(|site| site.name == name)
        .map(|site| site.line);
    messages::variable_hover(name, None, first_line)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hover_explains_keywords() {
        let hover = hover("set a to isThere 2", 11).unwrap();
        assert!(hover.contents.contains("isThere"));
        assert_eq!((hover.span.from, hover.span.to), (9, 16));
        assert!(
            super::hover("print true", 8)
                .unwrap()
                .contents
                .contains("igaz")
        );
        assert!(
            super::hover("print false", 8)
                .unwrap()
                .contents
                .contains("hamis")
        );
    }

    #[test]
    fn hover_describes_variables_with_type_and_first_line() {
        let src = "set count to 0\nset arany to isThere 2\nprint arany";
        let hover = hover(src, 46).unwrap();
        assert_eq!(
            hover.contents,
            "„arany” – logikai változó. Első értékadás: 2. sor."
        );
        assert_eq!((hover.span.from, hover.span.to), (44, 49));
        let first = super::hover(src, 5).unwrap();
        assert!(first.contents.contains("egész"));
    }

    #[test]
    fn hover_in_broken_programs_still_finds_the_first_assignment() {
        let src = "set x to 1\nStep forward 1\nprint x";
        let hover = hover(src, 33).unwrap();
        assert_eq!(hover.contents, "„x” – változó. Első értékadás: 1. sor.");
    }

    #[test]
    fn hover_reports_never_assigned_variables() {
        let hover = hover("print y", 6).unwrap();
        assert!(hover.contents.contains("sehol nem ad"));
    }

    #[test]
    fn hover_ignores_numbers_spaces_and_unknown_commands() {
        assert!(hover("print 12", 7).is_none());
        assert!(hover("print  1", 6).is_none());
        assert!(hover("jump 1", 2).is_none());
        assert!(hover("print 1", 40).is_none());
    }
}
