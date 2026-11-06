use crate::diagnostics::DiagCode;
use crate::syntax::ast::BinOp;
use crate::syntax::keywords::Keyword;

pub const MAX_LITERAL: i64 = 100;
const DECIMAL_BASE: i64 = 10;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Lexeme {
    Keyword(Keyword),
    Bool(bool),
    Number(i64),
    Operator(BinOp),
    Ident,
    Reserved(Keyword),
    Malformed(Malformation),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Malformation {
    NumberRange,
    InvalidIdent,
    InvalidToken,
}

impl Malformation {
    pub fn code(self) -> DiagCode {
        match self {
            Self::NumberRange => DiagCode::SynNumberRange,
            Self::InvalidIdent => DiagCode::SynInvalidIdent,
            Self::InvalidToken => DiagCode::SynInvalidToken,
        }
    }
}

impl Lexeme {
    pub fn binary_operator(self) -> Option<BinOp> {
        match self {
            Self::Operator(op) => Some(op),
            Self::Keyword(Keyword::And) => Some(BinOp::And),
            Self::Keyword(Keyword::Or) => Some(BinOp::Or),
            _ => None,
        }
    }

    pub fn malformation(self) -> Option<Malformation> {
        match self {
            Self::Malformed(malformation) => Some(malformation),
            _ => None,
        }
    }

    pub fn is_simple_value(self) -> bool {
        matches!(self, Self::Number(_) | Self::Bool(_) | Self::Ident)
    }
}

pub fn classify(word: &str) -> Lexeme {
    if let Some(keyword) = Keyword::exact(word) {
        return keyword
            .bool_value()
            .map_or(Lexeme::Keyword(keyword), Lexeme::Bool);
    }
    if let Some(op) = BinOp::from_symbol(word) {
        return Lexeme::Operator(op);
    }
    if is_digits(word) {
        return number_literal(word);
    }
    if is_identifier(word) {
        return Keyword::ignoring_case(word).map_or(Lexeme::Ident, Lexeme::Reserved);
    }
    Lexeme::Malformed(if starts_like_identifier(word) {
        Malformation::InvalidIdent
    } else {
        Malformation::InvalidToken
    })
}

pub fn is_identifier(word: &str) -> bool {
    let mut chars = word.chars();
    chars
        .next()
        .is_some_and(|first| first.is_ascii_alphabetic())
        && chars.all(|rest| rest.is_ascii_alphanumeric())
}

fn is_digits(word: &str) -> bool {
    !word.is_empty() && word.bytes().all(|byte| byte.is_ascii_digit())
}

fn number_literal(digits: &str) -> Lexeme {
    digits
        .bytes()
        .try_fold(0_i64, |value, digit| {
            let next = value * DECIMAL_BASE + i64::from(digit - b'0');
            (next <= MAX_LITERAL).then_some(next)
        })
        .map_or(Lexeme::Malformed(Malformation::NumberRange), Lexeme::Number)
}

fn starts_like_identifier(word: &str) -> bool {
    word.chars()
        .next()
        .is_some_and(|first| first.is_alphabetic() || first == '_')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_keywords_and_bool_literals() {
        assert_eq!(classify("step"), Lexeme::Keyword(Keyword::Step));
        assert_eq!(classify("isThere"), Lexeme::Keyword(Keyword::IsThere));
        assert_eq!(classify("and"), Lexeme::Keyword(Keyword::And));
        assert_eq!(classify("true"), Lexeme::Bool(true));
        assert_eq!(classify("false"), Lexeme::Bool(false));
    }

    #[test]
    fn symbolic_operators() {
        for op in BinOp::ALL {
            let expected = match op {
                BinOp::And => Lexeme::Keyword(Keyword::And),
                BinOp::Or => Lexeme::Keyword(Keyword::Or),
                _ => Lexeme::Operator(op),
            };
            assert_eq!(classify(op.symbol()), expected);
            assert_eq!(classify(op.symbol()).binary_operator(), Some(op));
        }
        assert_eq!(classify("not").binary_operator(), None);
    }

    #[test]
    fn numbers_up_to_one_hundred() {
        assert_eq!(classify("0"), Lexeme::Number(0));
        assert_eq!(classify("100"), Lexeme::Number(100));
        assert_eq!(classify("007"), Lexeme::Number(7));
        assert_eq!(classify("0000000000000000000000100"), Lexeme::Number(100));
        assert_eq!(classify("00"), Lexeme::Number(0));
        assert_eq!(
            classify("101"),
            Lexeme::Malformed(Malformation::NumberRange)
        );
        assert_eq!(
            classify("99999999999999999999999999"),
            Lexeme::Malformed(Malformation::NumberRange)
        );
    }

    #[test]
    fn identifiers_and_reserved_spellings() {
        assert_eq!(classify("arany"), Lexeme::Ident);
        assert_eq!(classify("x1"), Lexeme::Ident);
        assert_eq!(classify("If"), Lexeme::Reserved(Keyword::If));
        assert_eq!(classify("isthere"), Lexeme::Reserved(Keyword::IsThere));
        assert_eq!(classify("TRUE"), Lexeme::Reserved(Keyword::True));
    }

    #[test]
    fn malformed_words_by_first_character() {
        let ident = Lexeme::Malformed(Malformation::InvalidIdent);
        let token = Lexeme::Malformed(Malformation::InvalidToken);
        assert_eq!(classify("a_b"), ident);
        assert_eq!(classify("árany"), ident);
        assert_eq!(classify("_x"), ident);
        assert_eq!(classify("a+b"), ident);
        assert_eq!(classify("1+2"), token);
        assert_eq!(classify("-5"), token);
        assert_eq!(classify("1a"), token);
        assert_eq!(classify("("), token);
        assert_eq!(classify("=="), token);
    }

    #[test]
    fn malformations_map_to_codes() {
        assert_eq!(Malformation::NumberRange.code(), DiagCode::SynNumberRange);
        assert_eq!(Malformation::InvalidIdent.code(), DiagCode::SynInvalidIdent);
        assert_eq!(Malformation::InvalidToken.code(), DiagCode::SynInvalidToken);
        assert_eq!(
            classify("1+2").malformation(),
            Some(Malformation::InvalidToken)
        );
        assert_eq!(classify("1").malformation(), None);
    }

    #[test]
    fn simple_values() {
        assert!(classify("1").is_simple_value());
        assert!(classify("true").is_simple_value());
        assert!(classify("x").is_simple_value());
        assert!(!classify("If").is_simple_value());
        assert!(!classify("+").is_simple_value());
    }
}
