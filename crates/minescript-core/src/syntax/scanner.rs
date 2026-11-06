use crate::diagnostics::DiagCode;
use crate::source::lines;
use crate::syntax::keywords::Command;
use crate::syntax::lexeme::{Lexeme, classify};

pub const SPACE: char = ' ';
pub const TAB: char = '\t';
pub const CARRIAGE_RETURN: char = '\r';
pub const TAB_AS_INDENT: &str = "    ";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Word<'a> {
    pub text: &'a str,
    pub start: usize,
    pub lexeme: Lexeme,
}

impl Word<'_> {
    pub fn end(&self) -> usize {
        self.start + self.text.len()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LineFault {
    LoneCarriageReturn,
    Tab,
    Empty,
}

impl LineFault {
    pub fn code(self) -> DiagCode {
        match self {
            Self::LoneCarriageReturn => DiagCode::SynLoneCr,
            Self::Tab => DiagCode::SynTab,
            Self::Empty => DiagCode::SynEmptyLine,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpacingKind {
    Double,
    Trailing,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SpacingFault {
    pub kind: SpacingKind,
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FaultyLine<'a> {
    pub number: u32,
    pub text: &'a str,
    pub fault: LineFault,
    pub column: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CodeLine<'a> {
    pub number: u32,
    pub text: &'a str,
    pub indent: usize,
    pub words: Vec<Word<'a>>,
    pub spacing: Option<SpacingFault>,
}

impl CodeLine<'_> {
    pub fn command(&self) -> Option<Command> {
        match self.words.first()?.lexeme {
            Lexeme::Keyword(keyword) => keyword.command(),
            _ => None,
        }
    }

    pub fn content_end(&self) -> usize {
        self.words.last().map_or(self.indent, Word::end)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ScannedLine<'a> {
    Faulty(FaultyLine<'a>),
    Code(CodeLine<'a>),
}

impl ScannedLine<'_> {
    pub fn number(&self) -> u32 {
        match self {
            Self::Faulty(line) => line.number,
            Self::Code(line) => line.number,
        }
    }
}

pub fn scan(normalized: &str) -> impl Iterator<Item = ScannedLine<'_>> {
    let bytes = normalized.as_bytes();
    let controls = bytes.contains(&b'\r') || bytes.contains(&b'\t');
    lines(normalized)
        .zip(1u32..)
        .map(move |(text, number)| scan_with(number, text, controls))
}

pub fn scan_line(number: u32, text: &str) -> ScannedLine<'_> {
    scan_with(number, text, true)
}

fn scan_with(number: u32, text: &str, controls: bool) -> ScannedLine<'_> {
    let fault = if controls { line_fault(text) } else { None };
    if let Some((fault, column)) = fault {
        return ScannedLine::Faulty(FaultyLine {
            number,
            text,
            fault,
            column,
        });
    }
    let words = words(text, |byte| byte == b' ');
    if words.is_empty() {
        return ScannedLine::Faulty(FaultyLine {
            number,
            text,
            fault: LineFault::Empty,
            column: 0,
        });
    }
    let indent = words.first().map_or(0, |word| word.start);
    let spacing = spacing_fault(&words, text.len());
    ScannedLine::Code(CodeLine {
        number,
        text,
        indent,
        words,
        spacing,
    })
}

pub fn lenient_words(text: &str) -> Vec<Word<'_>> {
    words(text, |byte| matches!(byte, b' ' | b'\t' | b'\r'))
}

pub fn leading_spaces(text: &str) -> usize {
    text.len() - text.trim_start_matches(SPACE).len()
}

fn line_fault(text: &str) -> Option<(LineFault, usize)> {
    if let Some(column) = text.find(CARRIAGE_RETURN) {
        return Some((LineFault::LoneCarriageReturn, column));
    }
    if let Some(column) = text.find(TAB) {
        return Some((LineFault::Tab, column));
    }
    None
}

fn words(text: &str, is_gap: impl Fn(u8) -> bool) -> Vec<Word<'_>> {
    let mut found = Vec::with_capacity(6);
    let mut open: Option<usize> = None;
    for (offset, &byte) in text.as_bytes().iter().enumerate() {
        match (is_gap(byte), open) {
            (true, Some(start)) => {
                found.push(word_at(text, start, offset));
                open = None;
            }
            (false, None) => open = Some(offset),
            _ => {}
        }
    }
    if let Some(start) = open {
        found.push(word_at(text, start, text.len()));
    }
    found
}

fn word_at(text: &str, start: usize, end: usize) -> Word<'_> {
    let slice = text.get(start..end).unwrap_or_default();
    Word {
        text: slice,
        start,
        lexeme: classify(slice),
    }
}

fn spacing_fault(words: &[Word<'_>], line_end: usize) -> Option<SpacingFault> {
    let double = words.windows(2).find_map(|pair| match pair {
        [left, right] if right.start - left.end() > 1 => Some(SpacingFault {
            kind: SpacingKind::Double,
            start: left.end() + 1,
            end: right.start,
        }),
        _ => None,
    });
    double.or_else(|| {
        let content_end = words.last()?.end();
        (content_end < line_end).then_some(SpacingFault {
            kind: SpacingKind::Trailing,
            start: content_end,
            end: line_end,
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::syntax::keywords::Keyword;
    use crate::syntax::lexeme::Malformation;

    fn code(text: &str) -> CodeLine<'_> {
        match scan_line(1, text) {
            ScannedLine::Code(line) => line,
            ScannedLine::Faulty(line) => panic!("hibás sor: {line:?}"),
        }
    }

    fn fault(text: &str) -> (LineFault, usize) {
        match scan_line(1, text) {
            ScannedLine::Faulty(line) => (line.fault, line.column),
            ScannedLine::Code(line) => panic!("kódsor: {line:?}"),
        }
    }

    #[test]
    fn lines_are_numbered_from_one() {
        let lines: Vec<u32> = scan("print 1\n\nprint 2\n")
            .map(|line| line.number())
            .collect();
        assert_eq!(lines, vec![1, 2, 3]);
    }

    #[test]
    fn line_faults_follow_the_documented_precedence() {
        assert_eq!(fault("a\r\tb"), (LineFault::LoneCarriageReturn, 1));
        assert_eq!(fault("  \tprint 1"), (LineFault::Tab, 2));
        assert_eq!(fault(""), (LineFault::Empty, 0));
        assert_eq!(fault("    "), (LineFault::Empty, 0));
        assert_eq!(fault("\t"), (LineFault::Tab, 0));
        assert_eq!(LineFault::Tab.code(), DiagCode::SynTab);
        assert_eq!(LineFault::Empty.code(), DiagCode::SynEmptyLine);
        assert_eq!(LineFault::LoneCarriageReturn.code(), DiagCode::SynLoneCr);
    }

    #[test]
    fn code_lines_measure_indent_and_split_words() {
        let line = code("    step forward 3");
        assert_eq!(line.indent, 4);
        let texts: Vec<&str> = line.words.iter().map(|word| word.text).collect();
        assert_eq!(texts, vec!["step", "forward", "3"]);
        assert_eq!(line.words[1].start, 9);
        assert_eq!(line.words[1].end(), 16);
        assert_eq!(line.words[2].lexeme, Lexeme::Number(3));
        assert_eq!(line.command(), Some(Command::Step));
        assert_eq!(line.content_end(), 18);
        assert_eq!(line.spacing, None);
    }

    #[test]
    fn double_space_points_at_the_second_space() {
        let line = code("print   1");
        assert_eq!(
            line.spacing,
            Some(SpacingFault {
                kind: SpacingKind::Double,
                start: 6,
                end: 8
            })
        );
    }

    #[test]
    fn trailing_spaces_are_reported_from_the_first_one() {
        let line = code("print 1  ");
        assert_eq!(
            line.spacing,
            Some(SpacingFault {
                kind: SpacingKind::Trailing,
                start: 7,
                end: 9
            })
        );
    }

    #[test]
    fn indentation_is_not_a_double_space() {
        assert_eq!(code("        mine here").spacing, None);
    }

    #[test]
    fn first_word_decides_the_command() {
        assert_eq!(code("Step forward 1").command(), None);
        assert_eq!(code("else").command(), Some(Command::Else));
        assert_eq!(code("forward").command(), None);
    }

    #[test]
    fn words_keep_unicode_boundaries() {
        let line = code("set árany to 1");
        assert_eq!(line.words[1].text, "árany");
        assert_eq!(
            line.words[1].lexeme,
            Lexeme::Malformed(Malformation::InvalidIdent)
        );
        assert_eq!(line.words[2].start, "set árany ".len());
    }

    #[test]
    fn lenient_words_split_on_tabs_and_carriage_returns() {
        let words = lenient_words("\tset\rx to");
        let texts: Vec<&str> = words.iter().map(|word| word.text).collect();
        assert_eq!(texts, vec!["set", "x", "to"]);
        assert_eq!(words[0].lexeme, Lexeme::Keyword(Keyword::Set));
    }
}
