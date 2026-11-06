use super::{SemanticToken, SemanticTokenKind};
use crate::source::{LineIndex, Utf16Cursor};
use crate::syntax::lexeme::Lexeme;
use crate::syntax::scanner::{ScannedLine, Word, lenient_words};

pub(super) fn semantic_tokens(
    lines: &[ScannedLine<'_>],
    index: &LineIndex<'_>,
) -> Vec<SemanticToken> {
    let mut tokens = Vec::with_capacity(lines.len() * 4);
    for line in lines {
        match line {
            ScannedLine::Code(code) => {
                push_line(&mut tokens, index, code.number, code.text, &code.words);
            }
            ScannedLine::Faulty(faulty) => {
                push_line(
                    &mut tokens,
                    index,
                    faulty.number,
                    faulty.text,
                    &lenient_words(faulty.text),
                );
            }
        }
    }
    tokens
}

fn push_line(
    tokens: &mut Vec<SemanticToken>,
    index: &LineIndex<'_>,
    number: u32,
    text: &str,
    words: &[Word<'_>],
) {
    let line_start = index.utf16_offset(number, 0).unwrap_or(0);
    let mut cursor = Utf16Cursor::new(text);
    tokens.extend(words.iter().map(|word| SemanticToken {
        from: line_start.saturating_add(cursor.advance_to(word.start)),
        to: line_start.saturating_add(cursor.advance_to(word.end())),
        kind: kind_of(word.lexeme),
    }));
}

fn kind_of(lexeme: Lexeme) -> SemanticTokenKind {
    match lexeme {
        Lexeme::Keyword(_) => SemanticTokenKind::Keyword,
        Lexeme::Bool(_) => SemanticTokenKind::Bool,
        Lexeme::Number(_) => SemanticTokenKind::Number,
        Lexeme::Operator(_) => SemanticTokenKind::Operator,
        Lexeme::Ident => SemanticTokenKind::Variable,
        Lexeme::Reserved(_) | Lexeme::Malformed(_) => SemanticTokenKind::Invalid,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::syntax::scanner::scan;

    fn tokens_of(text: &str) -> Vec<(u32, u32, SemanticTokenKind)> {
        let lines: Vec<ScannedLine<'_>> = scan(text).collect();
        semantic_tokens(&lines, &LineIndex::new(text))
            .into_iter()
            .map(|token| (token.from, token.to, token.kind))
            .collect()
    }

    #[test]
    fn classifies_every_word() {
        use SemanticTokenKind::{Bool, Invalid, Keyword, Number, Operator, Variable};
        assert_eq!(
            tokens_of("set a to b + 1\nprint true\nprint If 101"),
            vec![
                (0, 3, Keyword),
                (4, 5, Variable),
                (6, 8, Keyword),
                (9, 10, Variable),
                (11, 12, Operator),
                (13, 14, Number),
                (15, 20, Keyword),
                (21, 25, Bool),
                (26, 31, Keyword),
                (32, 34, Invalid),
                (35, 38, Invalid),
            ]
        );
    }

    #[test]
    fn faulty_lines_are_still_highlighted() {
        assert_eq!(
            tokens_of("\tmine\there"),
            vec![
                (1, 5, SemanticTokenKind::Keyword),
                (6, 10, SemanticTokenKind::Keyword)
            ]
        );
    }

    #[test]
    fn offsets_count_utf16_units() {
        assert_eq!(
            tokens_of("print 😀 x"),
            vec![
                (0, 5, SemanticTokenKind::Keyword),
                (6, 8, SemanticTokenKind::Invalid),
                (9, 10, SemanticTokenKind::Variable)
            ]
        );
    }
}
