use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::source::LineIndex;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Span {
    pub line: u32,
    pub col_start: u32,
    pub col_end: u32,
    pub from: u32,
    pub to: u32,
}

impl Span {
    pub fn in_line(index: &LineIndex<'_>, line: u32, byte_start: usize, byte_end: usize) -> Self {
        let line_utf16_start = index.utf16_offset(line, 0).unwrap_or(0);
        let from = index
            .utf16_offset(line, byte_start)
            .unwrap_or(line_utf16_start);
        let to = index
            .utf16_offset(line, byte_end.max(byte_start))
            .unwrap_or(from);
        Self {
            line,
            col_start: from.saturating_sub(line_utf16_start) + 1,
            col_end: to.saturating_sub(line_utf16_start) + 1,
            from,
            to,
        }
    }

    pub fn whole_line(index: &LineIndex<'_>, line: u32) -> Self {
        let length = index.line_text(line).map_or(0, str::len);
        Self::in_line(index, line, 0, length)
    }

    pub fn is_empty(&self) -> bool {
        self.from == self.to
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn span_in_line_is_one_based_for_display() {
        let index = LineIndex::new("print 1\nset a to 2");
        let span = Span::in_line(&index, 2, 4, 5);
        assert_eq!(span.line, 2);
        assert_eq!(span.col_start, 5);
        assert_eq!(span.col_end, 6);
        assert_eq!(span.from, 12);
        assert_eq!(span.to, 13);
    }

    #[test]
    fn whole_line_span_covers_line() {
        let index = LineIndex::new("print 1\n");
        let span = Span::whole_line(&index, 1);
        assert_eq!((span.from, span.to), (0, 7));
        assert!(!span.is_empty());
    }

    #[test]
    fn span_out_of_range_line_does_not_panic() {
        let index = LineIndex::new("x");
        let span = Span::whole_line(&index, 5);
        assert!(span.is_empty());
    }
}
