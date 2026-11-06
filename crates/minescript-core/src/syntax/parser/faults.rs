use super::context::LineContext;
use super::line::{GrammarFault, LineSyntax, parse_line};
use crate::syntax::lexeme::Malformation;
use crate::syntax::scanner::{CodeLine, SpacingFault, Word};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum TokenFault<'a> {
    Spacing(SpacingFault),
    Malformed(Word<'a>, Malformation),
    Grammar(GrammarFault<'a>),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Stage {
    Lexical,
    Grammatical,
}

impl TokenFault<'_> {
    fn position(&self, line_end: usize) -> (usize, Stage) {
        match self {
            Self::Spacing(fault) => (fault.start, Stage::Lexical),
            Self::Malformed(word, _) => (word.start, Stage::Lexical),
            Self::Grammar(fault) => (fault.column(line_end), Stage::Grammatical),
        }
    }
}

pub(super) fn check_tokens<'a>(
    line: &CodeLine<'a>,
    context: &LineContext<'_>,
) -> Result<LineSyntax, TokenFault<'a>> {
    let grammar = parse_line(&line.words, context);
    let first_fault = first_token_fault(line, grammar.as_ref().err().copied());
    first_fault.map_or(grammar.map_err(TokenFault::Grammar), Err)
}

fn first_token_fault<'a>(
    line: &CodeLine<'a>,
    grammar: Option<GrammarFault<'a>>,
) -> Option<TokenFault<'a>> {
    let malformed = line.words.iter().find_map(|word| {
        word.lexeme
            .malformation()
            .map(|malformation| TokenFault::Malformed(*word, malformation))
    });
    [
        line.spacing.map(TokenFault::Spacing),
        malformed,
        grammar.map(TokenFault::Grammar),
    ]
    .into_iter()
    .flatten()
    .min_by_key(|fault| fault.position(line.text.len()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source::LineIndex;
    use crate::syntax::scanner::{ScannedLine, SpacingKind, scan_line};

    fn fault_of(text: &str) -> TokenFault<'_> {
        let ScannedLine::Code(line) = scan_line(1, text) else {
            panic!("kódsor kell");
        };
        let index = LineIndex::new(text);
        let context = LineContext::new(&index, 1, text);
        let grammar = parse_line(&line.words, &context).err();
        first_token_fault(&line, grammar).expect("hiba kell")
    }

    #[test]
    fn the_leftmost_fault_wins() {
        assert!(matches!(
            fault_of("Step  forward 1"),
            TokenFault::Grammar(GrammarFault::UnknownCommand(_))
        ));
        assert!(matches!(
            fault_of("print  1"),
            TokenFault::Spacing(SpacingFault {
                kind: SpacingKind::Double,
                ..
            })
        ));
        assert!(matches!(
            fault_of("print 1 a_b"),
            TokenFault::Malformed(_, Malformation::InvalidIdent)
        ));
    }

    #[test]
    fn lexical_faults_beat_grammar_faults_on_the_same_word() {
        assert!(matches!(
            fault_of("set a_b to 1"),
            TokenFault::Malformed(_, Malformation::InvalidIdent)
        ));
        assert!(matches!(
            fault_of("set x 101"),
            TokenFault::Malformed(_, Malformation::NumberRange)
        ));
        assert!(matches!(
            fault_of("-5"),
            TokenFault::Malformed(_, Malformation::InvalidToken)
        ));
    }

    #[test]
    fn trailing_space_comes_before_a_missing_token() {
        assert!(matches!(
            fault_of("step forward "),
            TokenFault::Spacing(SpacingFault {
                kind: SpacingKind::Trailing,
                ..
            })
        ));
    }
}
