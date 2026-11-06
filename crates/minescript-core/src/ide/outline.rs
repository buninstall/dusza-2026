use std::borrow::Borrow;

use super::{FoldRange, Symbol};
use crate::names::NameHashSet;
use crate::source::LineIndex;
use crate::source::lines;
use crate::span::Span;
use crate::syntax::keywords::{Command, Keyword};
use crate::syntax::lexeme::{Lexeme, classify};
use crate::syntax::scanner::CodeLine;
#[cfg(test)]
use crate::syntax::scanner::{ScannedLine, scan};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct AssignmentSite<'a> {
    pub name: &'a str,
    pub line: u32,
    pub start: usize,
    pub end: usize,
}

#[cfg(test)]
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
    let mut seen: NameHashSet<&str> = NameHashSet::default();
    lines
        .iter()
        .filter_map(|line| assignment_site(line.borrow()))
        .filter(|site| seen.insert(site.name))
        .collect()
}

pub(super) fn assignment_sites(text: &str) -> Vec<AssignmentSite<'_>> {
    let mut seen: NameHashSet<&str> = NameHashSet::default();
    lines(text)
        .zip(1u32..)
        .filter_map(|(line, number)| quick_assignment_site(line, number))
        .filter(|site| seen.insert(site.name))
        .collect()
}

fn quick_assignment_site(line: &str, number: u32) -> Option<AssignmentSite<'_>> {
    let content = line.trim_start_matches(' ');
    if !content.starts_with("set ") && content != "set" {
        return None;
    }
    let indent = line.len() - content.len();
    let mut words = content
        .split(' ')
        .scan(indent, |offset, word| {
            let start = *offset;
            *offset += word.len() + 1;
            Some((start, word))
        })
        .filter(|(_, word)| !word.is_empty());
    let (_, first) = words.next()?;
    if first != "set" {
        return None;
    }
    let (start, target) = words.next()?;
    if line
        .as_bytes()
        .iter()
        .any(|byte| matches!(byte, b'\r' | b'\t'))
        || classify(target) != Lexeme::Ident
    {
        return None;
    }
    Some(AssignmentSite {
        name: target,
        line: number,
        start,
        end: start + target.len(),
    })
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
    fn quick_assignment_sites_match_the_full_scan() {
        for text in [
            "set a to 1\nset b to a\nset a to 2\n\tset c to 3\nset If to 1\nset d\n",
            "  set   x to 1\nset y\r to 2\nSet z to 1\nset 1 to 2\nset árany to 1\nset\n\n   \nset q  \n",
            "set a_b to 1\nset ok to 1 \nset a\tb to 2\n",
        ] {
            assert_eq!(
                assignment_sites(text),
                first_assignments(&code_lines(text)),
                "{text:?}"
            );
        }
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
