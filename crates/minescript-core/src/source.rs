use std::borrow::Cow;

pub const BOM: char = '\u{feff}';

pub fn normalize(raw: &str) -> String {
    normalized(raw).into_owned()
}

pub fn normalized(raw: &str) -> Cow<'_, str> {
    let without_bom = raw.strip_prefix(BOM).unwrap_or(raw);
    if without_bom.as_bytes().contains(&b'\r') {
        Cow::Owned(without_bom.replace("\r\n", "\n"))
    } else {
        Cow::Borrowed(without_bom)
    }
}

pub fn split_lines(text: &str) -> Vec<&str> {
    lines(text).collect()
}

pub fn lines(text: &str) -> impl Iterator<Item = &str> {
    let body = text.strip_suffix('\n').unwrap_or(text);
    let mut segments = body.split('\n');
    if body.is_empty() {
        segments.next();
    }
    segments
}

pub fn utf16_len(text: &str) -> u32 {
    let units: usize = text
        .as_bytes()
        .iter()
        .map(|&byte| usize::from(byte & 0xC0 != 0x80) + usize::from(byte >= 0xF0))
        .sum();
    u32::try_from(units).unwrap_or(u32::MAX)
}

fn width_u32(length: usize) -> u32 {
    u32::try_from(length).unwrap_or(u32::MAX)
}

pub struct Utf16Cursor<'a> {
    text: &'a str,
    byte: usize,
    utf16: u32,
    ascii: bool,
}

impl<'a> Utf16Cursor<'a> {
    pub fn new(text: &'a str) -> Self {
        Self {
            text,
            byte: 0,
            utf16: 0,
            ascii: text.is_ascii(),
        }
    }

    pub fn advance_to(&mut self, byte: usize) -> u32 {
        if byte > self.byte {
            let passed = if self.ascii {
                if byte <= self.text.len() {
                    width_u32(byte - self.byte)
                } else {
                    0
                }
            } else {
                self.text.get(self.byte..byte).map_or(0, utf16_len)
            };
            self.utf16 = self.utf16.saturating_add(passed);
            self.byte = byte;
        }
        self.utf16
    }
}

#[derive(Debug, Clone, Copy)]
struct LineSlot {
    start: usize,
    end: usize,
    utf16_start: u32,
    ascii: bool,
}

#[derive(Debug, Clone)]
pub struct LineIndex<'a> {
    text: &'a str,
    lines: Vec<LineSlot>,
}

impl<'a> LineIndex<'a> {
    pub fn new(text: &'a str) -> Self {
        let mut lines = Vec::with_capacity(text.len() / 16 + 1);
        let mut start = 0;
        let mut utf16_start: u32 = 0;
        for segment in text.split('\n') {
            let ascii = segment.is_ascii();
            let width = if ascii {
                width_u32(segment.len())
            } else {
                utf16_len(segment)
            };
            lines.push(LineSlot {
                start,
                end: start + segment.len(),
                utf16_start,
                ascii,
            });
            start += segment.len() + 1;
            utf16_start = utf16_start.saturating_add(width).saturating_add(1);
        }
        Self { text, lines }
    }

    fn slot(&self, line: u32) -> Option<&LineSlot> {
        let index = usize::try_from(line.checked_sub(1)?).ok()?;
        self.lines.get(index)
    }

    pub fn text(&self) -> &'a str {
        self.text
    }

    pub fn line_count(&self) -> u32 {
        let body = self.text.strip_suffix('\n').unwrap_or(self.text);
        if body.is_empty() {
            return 0;
        }
        let count = self.lines.len() - usize::from(self.text.ends_with('\n'));
        width_u32(count)
    }

    pub fn line_start(&self, line: u32) -> Option<usize> {
        self.slot(line).map(|slot| slot.start)
    }

    pub fn line_text(&self, line: u32) -> Option<&'a str> {
        let slot = self.slot(line)?;
        self.text.get(slot.start..slot.end)
    }

    pub fn utf16_offset(&self, line: u32, byte_col: usize) -> Option<u32> {
        let slot = self.slot(line)?;
        let length = slot.end - slot.start;
        let col = byte_col.min(length);
        if slot.ascii {
            return Some(slot.utf16_start.saturating_add(width_u32(col)));
        }
        let prefix = self.text.get(slot.start..slot.start + col)?;
        Some(slot.utf16_start.saturating_add(utf16_len(prefix)))
    }

    pub fn line_end_utf16(&self, line: u32) -> Option<u32> {
        let slot = self.slot(line)?;
        self.utf16_offset(line, slot.end - slot.start)
    }

    pub fn removal_range(&self, first: u32, last: u32) -> Option<(u32, u32)> {
        let start = self.utf16_offset(first, 0)?;
        let next_line_index = usize::try_from(last).ok()?;
        if let Some(next) = self.lines.get(next_line_index) {
            return Some((start, next.utf16_start));
        }
        let end = self.line_end_utf16(last)?;
        let preceding_newline = u32::from(first > 1);
        Some((start.saturating_sub(preceding_newline), end))
    }

    pub fn position_of_utf16(&self, offset: u32) -> Option<(u32, usize)> {
        let line_index = self
            .lines
            .partition_point(|slot| slot.utf16_start <= offset)
            .checked_sub(1)?;
        let slot = self.lines.get(line_index)?;
        let line = u32::try_from(line_index + 1).ok()?;
        let line_text = self.text.get(slot.start..slot.end)?;
        let mut remaining = offset.saturating_sub(slot.utf16_start);
        if slot.ascii {
            let col = usize::try_from(remaining).unwrap_or(usize::MAX);
            return Some((line, col.min(line_text.len())));
        }
        let mut byte_col = 0;
        for ch in line_text.chars() {
            let width = width_u32(ch.len_utf16());
            if remaining < width {
                break;
            }
            remaining -= width;
            byte_col += ch.len_utf8();
        }
        Some((line, byte_col))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_strips_bom_and_crlf() {
        assert_eq!(normalize("\u{feff}a\r\nb\r\n"), "a\nb\n");
    }

    #[test]
    fn normalize_keeps_lone_cr() {
        assert_eq!(normalize("a\rb"), "a\rb");
    }

    #[test]
    fn split_lines_ignores_single_trailing_newline() {
        assert_eq!(split_lines("a\nb\n"), vec!["a", "b"]);
        assert_eq!(split_lines("a\nb"), vec!["a", "b"]);
    }

    #[test]
    fn split_lines_keeps_extra_empty_line() {
        assert_eq!(split_lines("a\n\n"), vec!["a", ""]);
        assert_eq!(split_lines("a\n\nb"), vec!["a", "", "b"]);
    }

    #[test]
    fn split_lines_of_empty_file_is_empty() {
        assert!(split_lines("").is_empty());
        assert!(split_lines("\n").is_empty());
    }

    #[test]
    fn line_index_maps_lines_and_offsets() {
        let index = LineIndex::new("ab\ncd\n");
        assert_eq!(index.line_count(), 2);
        assert_eq!(index.line_text(2), Some("cd"));
        assert_eq!(index.utf16_offset(2, 1), Some(4));
        assert_eq!(index.position_of_utf16(4), Some((2, 1)));
        assert_eq!(index.line_text(9), None);
    }

    #[test]
    fn removal_range_takes_the_line_break_with_it() {
        let terminated = LineIndex::new("a\nb\n");
        assert_eq!(terminated.removal_range(2, 2), Some((2, 4)));
        assert_eq!(terminated.removal_range(1, 2), Some((0, 4)));
        let unterminated = LineIndex::new("a\nbc");
        assert_eq!(unterminated.removal_range(2, 2), Some((1, 4)));
        assert_eq!(unterminated.removal_range(1, 1), Some((0, 2)));
        let single = LineIndex::new("abc");
        assert_eq!(single.removal_range(1, 1), Some((0, 3)));
        assert_eq!(single.removal_range(3, 3), None);
        assert_eq!(single.line_end_utf16(1), Some(3));
    }

    #[test]
    fn utf16_cursor_never_moves_backwards() {
        let mut cursor = Utf16Cursor::new("éab");
        assert_eq!(cursor.advance_to(3), 2);
        assert_eq!(cursor.advance_to(1), 2);
        assert_eq!(cursor.advance_to(4), 3);
    }

    #[test]
    fn line_index_counts_utf16_units() {
        let index = LineIndex::new("é😀x\ny");
        assert_eq!(index.utf16_offset(1, "é😀".len()), Some(3));
        assert_eq!(index.utf16_offset(2, 0), Some(5));
        assert_eq!(index.position_of_utf16(3), Some((1, "é😀".len())));
    }
}
