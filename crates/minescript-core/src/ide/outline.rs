use std::collections::BTreeSet;

use super::{FoldRange, Symbol};
use crate::source::LineIndex;
use crate::span::Span;
use crate::syntax::keywords::{Command, Keyword};
use crate::syntax::lexeme::Lexeme;
use crate::syntax::scanner::{CodeLine, ScannedLine, scan};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct AssignmentSite<'a> {
    pub name: &'a str,
    pub line: u32,
    pub start: usize,
    pub end: usize,
}

pub(super) fn code_lines(text: &str) -> Vec<CodeLine<'_>> {
    scan(text)
        .filter_map(|line| match line {
            ScannedLine::Code(code) => Some(code),
            ScannedLine::Faulty(_) => None,
        })
        .collect()
}

pub(super) fn first_assignments<'a>(lines: &[CodeLine<'a>]) -> Vec<AssignmentSite<'a>> {
    let mut seen = BTreeSet::new();
    lines
        .iter()
        .filter_map(assignment_site)
        .filter(|site| seen.insert(site.name))
        .collect()
}

fn assignment_site<'a>(line: &CodeLine<'a>) -> Option<AssignmentSite<'a>> {
    let [first, target, ..] = line.words.as_slice() else {
        return None;
    };
    (first.lexeme == Lexeme::Keyword(Keyword::Set) && target.lexeme == Lexeme::Ident).then_some(
        AssignmentSite {
            name: target.text,
            line: line.number,
            start: target.start,
            end: target.end(),
        },
    )
}

pub(super) fn symbols(lines: &[CodeLine<'_>], index: &LineIndex<'_>) -> Vec<Symbol> {
    first_assignments(lines)
        .into_iter()
        .map(|site| Symbol {
            name: site.name.to_owned(),
            span: Span::in_line(index, site.line, site.start, site.end),
        })
        .collect()
}

pub(super) fn folds(lines: &[CodeLine<'_>], index: &LineIndex<'_>) -> Vec<FoldRange> {
    lines
        .iter()
        .enumerate()
        .filter(|(_, line)| line.command().is_some_and(Command::opens_block))
        .filter_map(|(position, header)| {
            let last = lines
                .iter()
                .skip(position + 1)
                .take_while(|line| line.indent > header.indent)
                .last()?;
            Some(FoldRange {
                from: index.line_end_utf16(header.number)?,
                to: index.line_end_utf16(last.number)?,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folds_cover_every_non_empty_block() {
        let text = "while t\n    if a\n        mine here\n    else\n        print 1\nprint 2\nif b\nprint 3\n";
        let index = LineIndex::new(text);
        let folds: Vec<(u32, u32)> = folds(&code_lines(text), &index)
            .into_iter()
            .map(|fold| (fold.from, fold.to))
            .collect();
        assert_eq!(folds, vec![(7, 59), (16, 34), (43, 59)]);
    }

    #[test]
    fn symbols_are_first_assignments_even_in_broken_programs() {
        let text = "set a to 1\nset b to a\nset a to 2\n\tset c to 3\nset If to 1\nset d\n";
        let index = LineIndex::new(text);
        let symbols: Vec<(String, u32)> = symbols(&code_lines(text), &index)
            .into_iter()
            .map(|symbol| (symbol.name, symbol.span.line))
            .collect();
        assert_eq!(
            symbols,
            vec![
                ("a".to_owned(), 1),
                ("b".to_owned(), 2),
                ("d".to_owned(), 6)
            ]
        );
    }
}
