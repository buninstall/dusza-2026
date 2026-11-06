mod context;
mod faults;
mod layout;
mod line;
mod repair;
mod report;
mod tree;

use std::borrow::Borrow;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use self::context::LineContext;
use self::faults::check_tokens;
use self::layout::{Layout, LineRole};
use self::tree::PlacedLine;
use crate::diagnostics::Diagnostic;
use crate::source::{LineIndex, normalized};
use crate::syntax::ast::Program;
use crate::syntax::scanner::{CodeLine, ScannedLine, scan};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ParseResult {
    pub program: Option<Program>,
    pub diagnostics: Vec<Diagnostic>,
}

pub fn parse(src: &str) -> ParseResult {
    let text = normalized(src);
    let index = LineIndex::new(&text);
    parse_lines(&index, scan(&text))
}

pub(crate) fn parse_lines<'t, L: Borrow<ScannedLine<'t>>>(
    index: &LineIndex<'_>,
    lines: impl IntoIterator<Item = L>,
) -> ParseResult {
    let mut parser = Parser::new(index);
    for line in lines {
        match line.borrow() {
            ScannedLine::Faulty(line) => parser.diagnostics.push(report::line_fault(line, index)),
            ScannedLine::Code(line) => parser.code_line(line),
        }
    }
    parser.finish()
}

struct Parser<'i> {
    index: &'i LineIndex<'i>,
    layout: Layout,
    placed: Vec<PlacedLine>,
    diagnostics: Vec<Diagnostic>,
}

impl<'i> Parser<'i> {
    fn new(index: &'i LineIndex<'i>) -> Self {
        Self {
            index,
            layout: Layout::default(),
            placed: Vec::new(),
            diagnostics: Vec::new(),
        }
    }

    fn code_line(&mut self, line: &CodeLine<'_>) {
        let context = LineContext::new(self.index, line.number, line.text);
        let placement = self.layout.place(line.indent, LineRole::of(line.command()));
        if let Some(fault) = placement.fault {
            self.diagnostics
                .push(report::indent_fault(fault, line, &context));
        }
        match check_tokens(line, &context) {
            Ok(syntax) => self.placed.push(PlacedLine {
                depth: placement.depth,
                number: line.number,
                span: context.span(line.indent, line.content_end()),
                syntax,
            }),
            Err(fault) => self.diagnostics.push(report::token_fault(fault, &context)),
        }
    }

    fn finish(mut self) -> ParseResult {
        self.diagnostics
            .sort_by_key(|diagnostic| (diagnostic.span.line, diagnostic.span.col_start));
        let program = self
            .diagnostics
            .is_empty()
            .then(|| tree::build(self.placed));
        ParseResult {
            program,
            diagnostics: self.diagnostics,
        }
    }
}

#[cfg(test)]
mod tests;
