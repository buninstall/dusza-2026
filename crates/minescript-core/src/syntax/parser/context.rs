use crate::diagnostics::TextEdit;
use crate::source::{LineIndex, Utf16Cursor};
use crate::span::Span;
use crate::syntax::scanner::Word;

#[derive(Clone, Copy)]
pub(super) struct LineContext<'i> {
    pub index: &'i LineIndex<'i>,
    pub number: u32,
    pub text: &'i str,
}

impl<'i> LineContext<'i> {
    pub fn new(index: &'i LineIndex<'i>, number: u32, text: &'i str) -> Self {
        Self {
            index,
            number,
            text,
        }
    }

    pub fn span(&self, start: usize, end: usize) -> Span {
        Span::in_line(self.index, self.number, start, end)
    }

    pub fn word_span(&self, word: &Word<'_>) -> Span {
        self.span(word.start, word.end())
    }

    pub fn edit(&self, start: usize, end: usize, insert: impl Into<String>) -> TextEdit {
        let span = self.span(start, end);
        TextEdit::new(span.from, span.to, insert)
    }

    pub fn replacements<'r>(
        &self,
        targets: impl IntoIterator<Item = (usize, usize, &'r str)>,
    ) -> Vec<TextEdit> {
        let line_start = self.index.utf16_offset(self.number, 0).unwrap_or(0);
        let mut cursor = Utf16Cursor::new(self.text);
        targets
            .into_iter()
            .map(|(start, end, insert)| {
                let from = line_start.saturating_add(cursor.advance_to(start));
                let to = line_start.saturating_add(cursor.advance_to(end));
                TextEdit::new(from, to, insert)
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spans_and_edits_use_utf16_offsets() {
        let index = LineIndex::new("x\nő😀 y");
        let context = LineContext::new(&index, 2, "ő😀 y");
        let span = context.span("ő😀 ".len(), "ő😀 y".len());
        assert_eq!((span.from, span.to, span.col_start), (6, 7, 5));
        let edit = context.edit(0, "ő".len(), "o");
        assert_eq!((edit.from, edit.to), (2, 3));
    }

    #[test]
    fn bulk_replacements_walk_the_line_once() {
        let index = LineIndex::new("é\t\tb");
        let context = LineContext::new(&index, 1, "é\t\tb");
        let edits = context.replacements([(2, 3, " "), (3, 4, " ")]);
        assert_eq!((edits[0].from, edits[0].to), (1, 2));
        assert_eq!((edits[1].from, edits[1].to), (2, 3));
    }
}
