use std::slice::Iter;

use super::context::LineContext;
use crate::source::LineIndex;
use crate::syntax::ast::{BinOp, Expr, Ident, Simple, StmtKind};
use crate::syntax::keywords::{Command, Keyword};
use crate::syntax::lexeme::Lexeme;
use crate::syntax::scanner::{ScannedLine, Word, scan_line};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum LineSyntax {
    Command(StmtKind),
    If(Simple),
    While(Simple),
    Else,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Expectation {
    Command,
    Keyword(Keyword),
    Value,
    Target,
    Operator,
    Expression,
}

impl Expectation {
    pub fn accepts(self, keyword: Keyword) -> bool {
        match self {
            Self::Command => keyword.command().is_some(),
            Self::Keyword(expected) => keyword == expected,
            Self::Value => keyword.bool_value().is_some(),
            Self::Target => false,
            Self::Operator => matches!(keyword, Keyword::And | Keyword::Or),
            Self::Expression => {
                matches!(keyword, Keyword::IsThere | Keyword::Not) || keyword.bool_value().is_some()
            }
        }
    }

    fn admits_identifier(self) -> bool {
        matches!(self, Self::Value | Self::Target | Self::Expression)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum GrammarFault<'a> {
    UnknownCommand(Word<'a>),
    Missing {
        expected: Expectation,
        command: Option<Command>,
    },
    Extra {
        word: Word<'a>,
        command: Command,
    },
    Unexpected {
        word: Word<'a>,
        expected: Expectation,
        command: Command,
    },
    Reserved {
        word: Word<'a>,
        keyword: Keyword,
        expected: Expectation,
    },
}

impl GrammarFault<'_> {
    pub fn column(&self, line_end: usize) -> usize {
        match self {
            Self::UnknownCommand(word)
            | Self::Extra { word, .. }
            | Self::Unexpected { word, .. }
            | Self::Reserved { word, .. } => word.start,
            Self::Missing { .. } => line_end,
        }
    }
}

type Parsed<'a, T> = Result<T, GrammarFault<'a>>;

pub(super) fn parse_line<'a>(
    words: &[Word<'a>],
    context: &LineContext<'_>,
) -> Parsed<'a, LineSyntax> {
    let Some((first, rest)) = words.split_first() else {
        return Err(GrammarFault::Missing {
            expected: Expectation::Command,
            command: None,
        });
    };
    let command = command_of(*first)?;
    let mut walker = Walker {
        rest: rest.iter(),
        command,
        context,
    };
    let syntax = walker.statement()?;
    walker.finish()?;
    Ok(syntax)
}

pub(super) fn is_grammatical(text: &str) -> bool {
    let ScannedLine::Code(line) = scan_line(1, text) else {
        return false;
    };
    let index = LineIndex::new(text);
    parse_line(&line.words, &LineContext::new(&index, 1, text)).is_ok()
}

fn command_of(word: Word<'_>) -> Parsed<'_, Command> {
    match word.lexeme {
        Lexeme::Keyword(keyword) => keyword.command(),
        _ => None,
    }
    .ok_or(GrammarFault::UnknownCommand(word))
}

struct Walker<'w, 'a, 'c> {
    rest: Iter<'w, Word<'a>>,
    command: Command,
    context: &'c LineContext<'c>,
}

impl<'a> Walker<'_, 'a, '_> {
    fn statement(&mut self) -> Parsed<'a, LineSyntax> {
        Ok(match self.command {
            Command::Step => {
                self.keyword(Keyword::Forward)?;
                LineSyntax::Command(StmtKind::Step {
                    count: self.value()?,
                })
            }
            Command::Turn => {
                self.keyword(Keyword::By)?;
                LineSyntax::Command(StmtKind::Turn {
                    quarters: self.value()?,
                })
            }
            Command::Mine => {
                self.keyword(Keyword::Here)?;
                LineSyntax::Command(StmtKind::Mine)
            }
            Command::Print => LineSyntax::Command(StmtKind::Print {
                value: self.value()?,
            }),
            Command::Set => LineSyntax::Command(self.assignment()?),
            Command::If => LineSyntax::If(self.value()?),
            Command::While => LineSyntax::While(self.value()?),
            Command::Else => LineSyntax::Else,
        })
    }

    fn assignment(&mut self) -> Parsed<'a, StmtKind> {
        let name = self.target()?;
        self.keyword(Keyword::To)?;
        let value = self.expression()?;
        Ok(StmtKind::Set { name, value })
    }

    fn expression(&mut self) -> Parsed<'a, Expr> {
        match self.peek(Expectation::Expression)?.lexeme {
            Lexeme::Keyword(Keyword::IsThere) => {
                self.rest.next();
                Ok(Expr::IsThere { arg: self.value()? })
            }
            Lexeme::Keyword(Keyword::Not) => {
                self.rest.next();
                Ok(Expr::Not {
                    operand: self.value()?,
                })
            }
            _ => self.operation(),
        }
    }

    fn operation(&mut self) -> Parsed<'a, Expr> {
        let lhs = self.simple(Expectation::Expression)?;
        if self.rest.as_slice().is_empty() {
            return Ok(Expr::Simple { value: lhs });
        }
        let op = self.operator()?;
        let rhs = self.value()?;
        Ok(Expr::Binary { op, lhs, rhs })
    }

    fn keyword(&mut self, keyword: Keyword) -> Parsed<'a, ()> {
        let expected = Expectation::Keyword(keyword);
        let word = self.next(expected)?;
        if word.lexeme == Lexeme::Keyword(keyword) {
            Ok(())
        } else {
            Err(self.rejected(word, expected))
        }
    }

    fn value(&mut self) -> Parsed<'a, Simple> {
        self.simple(Expectation::Value)
    }

    fn simple(&mut self, expected: Expectation) -> Parsed<'a, Simple> {
        let word = self.next(expected)?;
        let span = self.context.word_span(&word);
        match word.lexeme {
            Lexeme::Number(value) => Ok(Simple::Int { value, span }),
            Lexeme::Bool(value) => Ok(Simple::Bool { value, span }),
            Lexeme::Ident => Ok(Simple::Ident {
                name: word.text.to_owned(),
                span,
            }),
            _ => Err(self.rejected(word, expected)),
        }
    }

    fn target(&mut self) -> Parsed<'a, Ident> {
        let word = self.next(Expectation::Target)?;
        match word.lexeme {
            Lexeme::Ident => Ok(Ident {
                name: word.text.to_owned(),
                span: self.context.word_span(&word),
            }),
            _ => Err(self.rejected(word, Expectation::Target)),
        }
    }

    fn operator(&mut self) -> Parsed<'a, BinOp> {
        let word = self.next(Expectation::Operator)?;
        word.lexeme
            .binary_operator()
            .ok_or_else(|| self.rejected(word, Expectation::Operator))
    }

    fn finish(&mut self) -> Parsed<'a, ()> {
        match self.rest.next() {
            Some(word) => Err(GrammarFault::Extra {
                word: *word,
                command: self.command,
            }),
            None => Ok(()),
        }
    }

    fn peek(&self, expected: Expectation) -> Parsed<'a, Word<'a>> {
        self.rest
            .as_slice()
            .first()
            .copied()
            .ok_or_else(|| self.missing(expected))
    }

    fn next(&mut self, expected: Expectation) -> Parsed<'a, Word<'a>> {
        let word = self.peek(expected)?;
        self.rest.next();
        Ok(word)
    }

    fn missing(&self, expected: Expectation) -> GrammarFault<'a> {
        GrammarFault::Missing {
            expected,
            command: Some(self.command),
        }
    }

    fn rejected(&self, word: Word<'a>, expected: Expectation) -> GrammarFault<'a> {
        match word.lexeme {
            Lexeme::Reserved(keyword) if expected.admits_identifier() => GrammarFault::Reserved {
                word,
                keyword,
                expected,
            },
            _ => GrammarFault::Unexpected {
                word,
                expected,
                command: self.command,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_text(text: &str) -> Parsed<'_, LineSyntax> {
        let ScannedLine::Code(line) = scan_line(1, text) else {
            panic!("kódsornak kell lennie: {text:?}");
        };
        let index = LineIndex::new(text);
        let context = LineContext::new(&index, 1, text);
        parse_line(&line.words, &context)
    }

    fn fault_of(text: &str) -> GrammarFault<'_> {
        parse_text(text).expect_err("hibának kell lennie")
    }

    fn found(fault: GrammarFault<'_>) -> Option<&str> {
        match fault {
            GrammarFault::UnknownCommand(word)
            | GrammarFault::Extra { word, .. }
            | GrammarFault::Unexpected { word, .. }
            | GrammarFault::Reserved { word, .. } => Some(word.text),
            GrammarFault::Missing { .. } => None,
        }
    }

    #[test]
    fn parses_every_statement_form() {
        assert!(matches!(
            parse_text("step forward 3"),
            Ok(LineSyntax::Command(StmtKind::Step {
                count: Simple::Int { value: 3, .. }
            }))
        ));
        assert!(matches!(
            parse_text("turn by n"),
            Ok(LineSyntax::Command(StmtKind::Turn {
                quarters: Simple::Ident { .. }
            }))
        ));
        assert_eq!(
            parse_text("mine here"),
            Ok(LineSyntax::Command(StmtKind::Mine))
        );
        assert!(matches!(
            parse_text("print true"),
            Ok(LineSyntax::Command(StmtKind::Print {
                value: Simple::Bool { value: true, .. }
            }))
        ));
        assert!(matches!(
            parse_text("if a"),
            Ok(LineSyntax::If(Simple::Ident { .. }))
        ));
        assert!(matches!(
            parse_text("while false"),
            Ok(LineSyntax::While(Simple::Bool { value: false, .. }))
        ));
        assert_eq!(parse_text("else"), Ok(LineSyntax::Else));
    }

    #[test]
    fn parses_every_calculated_value_form() {
        let expr = |text: &str| match parse_text(text) {
            Ok(LineSyntax::Command(StmtKind::Set { value, .. })) => value,
            other => panic!("{other:?}"),
        };
        assert!(matches!(expr("set a to 1"), Expr::Simple { .. }));
        assert!(matches!(expr("set a to isThere 2"), Expr::IsThere { .. }));
        assert!(matches!(expr("set a to not b"), Expr::Not { .. }));
        assert!(matches!(
            expr("set a to b and c"),
            Expr::Binary { op: BinOp::And, .. }
        ));
        assert!(matches!(
            expr("set a to 1 <= 2"),
            Expr::Binary { op: BinOp::Le, .. }
        ));
    }

    #[test]
    fn unknown_commands() {
        assert!(matches!(
            fault_of("Step forward 1"),
            GrammarFault::UnknownCommand(_)
        ));
        assert!(matches!(
            fault_of("forward 1"),
            GrammarFault::UnknownCommand(_)
        ));
        assert!(matches!(fault_of("x"), GrammarFault::UnknownCommand(_)));
    }

    #[test]
    fn missing_tokens_at_the_end_of_line() {
        for text in [
            "step forward",
            "set x to",
            "set x to 1 +",
            "if",
            "mine",
            "set",
            "set x",
        ] {
            assert!(
                matches!(fault_of(text), GrammarFault::Missing { .. }),
                "{text}"
            );
        }
    }

    #[test]
    fn extra_tokens_after_a_complete_statement() {
        for (text, extra) in [
            ("print 1 2", "2"),
            ("mine here now", "now"),
            ("else x", "x"),
            ("set x to 1 + 2 + 3", "+"),
            ("set x to isThere 1 2", "2"),
        ] {
            let fault = fault_of(text);
            assert!(matches!(fault, GrammarFault::Extra { .. }), "{text}");
            assert_eq!(found(fault), Some(extra));
        }
    }

    #[test]
    fn unexpected_tokens_at_fixed_and_value_positions() {
        for (text, culprit) in [
            ("step back 1", "back"),
            ("turn 1", "1"),
            ("mine there", "there"),
            ("set x 1", "1"),
            ("if isThere 2", "isThere"),
            ("print while", "while"),
            ("set 5 to 1", "5"),
            ("set true to 1", "true"),
            ("set x to 1 2", "2"),
            ("set x to +", "+"),
            ("step Forward 1", "Forward"),
            ("set x to a AND b", "AND"),
        ] {
            let fault = fault_of(text);
            assert!(
                matches!(fault, GrammarFault::Unexpected { .. }),
                "{text}: {fault:?}"
            );
            assert_eq!(found(fault), Some(culprit));
        }
    }

    #[test]
    fn reserved_identifiers_where_a_name_may_stand() {
        for (text, keyword) in [
            ("set If to 1", Keyword::If),
            ("print TRUE", Keyword::True),
            ("set x to isthere 2", Keyword::IsThere),
            ("set x to 1 + Step", Keyword::Step),
        ] {
            let fault = fault_of(text);
            assert!(
                matches!(fault, GrammarFault::Reserved { keyword: found, .. } if found == keyword),
                "{text}: {fault:?}"
            );
        }
    }

    #[test]
    fn expectations_accept_case_corrected_keywords() {
        assert!(Expectation::Command.accepts(Keyword::Step));
        assert!(!Expectation::Command.accepts(Keyword::Forward));
        assert!(Expectation::Keyword(Keyword::To).accepts(Keyword::To));
        assert!(Expectation::Value.accepts(Keyword::True));
        assert!(!Expectation::Value.accepts(Keyword::IsThere));
        assert!(!Expectation::Target.accepts(Keyword::If));
        assert!(Expectation::Operator.accepts(Keyword::Or));
        assert!(Expectation::Expression.accepts(Keyword::Not));
        assert!(Expectation::Expression.accepts(Keyword::False));
        assert!(!Expectation::Expression.accepts(Keyword::Set));
    }

    #[test]
    fn fault_columns_point_at_the_culprit_or_the_line_end() {
        assert_eq!(fault_of("print 1 2").column(9), 8);
        assert_eq!(fault_of("step forward").column(12), 12);
        assert_eq!(fault_of("Step").column(4), 0);
    }

    #[test]
    fn grammatical_lines_ignore_spacing_but_not_structure() {
        assert!(is_grammatical("set a to 1 + 2"));
        assert!(is_grammatical("    print x "));
        assert!(!is_grammatical("print 0 - 5"));
        assert!(!is_grammatical("set a to 1 + 2 a_b"));
        assert!(!is_grammatical(""));
    }

    #[test]
    fn a_line_without_words_misses_its_command() {
        let index = LineIndex::new("");
        let context = LineContext::new(&index, 1, "");
        assert_eq!(
            parse_line(&[], &context),
            Err(GrammarFault::Missing {
                expected: Expectation::Command,
                command: None
            })
        );
    }
}
