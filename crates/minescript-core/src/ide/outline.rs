use std::borrow::Borrow;
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

pub(super) fn first_assignments<'a, L: Borrow<CodeLine<'a>>>(
    lines: &[L],
) -> Vec<AssignmentSite<'a>> {
    let mut seen = BTreeSet::new();
    lines
        .iter()
        .filter_map(|line| assignment_site(line.borrow()))
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

pub(super) fn symbols<'a, L: Borrow<CodeLine<'a>>>(
    lines: &[L],
    index: &LineIndex<'_>,
) -> Vec<Symbol> {
    first_assignments(lines)
        .into_iter()
        .map(|site| Symbol {
            name: site.name.to_owned(),
            span: Span::in_line(index, site.line, site.start, site.end),
        })
        .collect()
}

struct OpenHeader {
    order: usize,
    position: usize,
    indent: usize,
    number: u32,
}

pub(super) fn folds<'a, L: Borrow<CodeLine<'a>>>(
    lines: &[L],
    index: &LineIndex<'_>,
) -> Vec<FoldRange> {
    let mut found: Vec<Option<FoldRange>> = Vec::new();
    let mut open: Vec<OpenHeader> = Vec::new();
    let close =
        |header: OpenHeader, last: Option<&CodeLine<'_>>, found: &mut [Option<FoldRange>]| {
            let fold = last.and_then(|last| {
                Some(FoldRange {
                    from: index.line_end_utf16(header.number)?,
                    to: index.line_end_utf16(last.number)?,
                })
            });
            if let Some(slot) = found.get_mut(header.order) {
                *slot = fold;
            }
        };
    let mut previous: Option<&CodeLine<'_>> = None;
    for (position, line) in lines.iter().enumerate() {
        let line = line.borrow();
        while let Some(header) = open.pop_if(|header| header.indent >= line.indent) {
            let last = previous.filter(|_| position > header.position + 1);
            close(header, last, &mut found);
        }
        if line.command().is_some_and(Command::opens_block) {
            open.push(OpenHeader {
                order: found.len(),
                position,
                indent: line.indent,
                number: line.number,
            });
            found.push(None);
        }
        previous = Some(line);
    }
    while let Some(header) = open.pop() {
        let last = previous.filter(|_| lines.len() > header.position + 1);
        close(header, last, &mut found);
    }
    found.into_iter().flatten().collect()
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
