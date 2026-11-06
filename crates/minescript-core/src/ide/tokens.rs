use super::{SemanticToken, SemanticTokenKind};
use crate::source::{LineIndex, Utf16Cursor};
use crate::syntax::lexeme::Lexeme;
use crate::syntax::scanner::{ScannedLine, Word, lenient_words, scan};

pub(super) fn semantic_tokens(text: &str, index: &LineIndex<'_>) -> Vec<SemanticToken> {
    let mut tokens = Vec::new();
    for line in scan(text) {
        let (number, text, words) = match line {
            ScannedLine::Code(code) => (code.number, code.text, code.words),
            ScannedLine::Faulty(faulty) => (faulty.number, faulty.text, lenient_words(faulty.text)),
        };
        push_line(&mut tokens, index, number, text, &words);
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

    fn tokens_of(text: &str) -> Vec<(u32, u32, SemanticTokenKind)> {
        semantic_tokens(text, &LineIndex::new(text))
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
