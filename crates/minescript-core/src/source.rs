const BOM: char = '\u{feff}';

pub fn normalize(raw: &str) -> String {
    let without_bom = raw.strip_prefix(BOM).unwrap_or(raw);
    without_bom.replace("\r\n", "\n")
}

pub fn split_lines(text: &str) -> Vec<&str> {
    let body = text.strip_suffix('\n').unwrap_or(text);
    if body.is_empty() {
        return Vec::new();
    }
    body.split('\n').collect()
}

pub fn utf16_len(text: &str) -> u32 {
    u32::try_from(text.encode_utf16().count()).unwrap_or(u32::MAX)
}

pub struct Utf16Cursor<'a> {
    text: &'a str,
    byte: usize,
    utf16: u32,
}

impl<'a> Utf16Cursor<'a> {
    pub fn new(text: &'a str) -> Self {
        Self {
            text,
            byte: 0,
            utf16: 0,
        }
    }

    pub fn advance_to(&mut self, byte: usize) -> u32 {
        if byte > self.byte {
            let passed = self.text.get(self.byte..byte).unwrap_or_default();
            self.utf16 = self.utf16.saturating_add(utf16_len(passed));
            self.byte = byte;
        }
        self.utf16
    }
}

#[derive(Debug, Clone)]
pub struct LineIndex<'a> {
    text: &'a str,
    line_starts: Vec<usize>,
    utf16_line_starts: Vec<u32>,
}

impl<'a> LineIndex<'a> {
    pub fn new(text: &'a str) -> Self {
        let mut line_starts = vec![0];
        let mut utf16_line_starts = vec![0];
        let mut utf16_offset: u32 = 0;
        for (byte_offset, ch) in text.char_indices() {
            utf16_offset = utf16_offset.saturating_add(u32::try_from(ch.len_utf16()).unwrap_or(1));
            if ch == '\n' {
                line_starts.push(byte_offset + 1);
                utf16_line_starts.push(utf16_offset);
            }
        }
        Self {
            text,
            line_starts,
            utf16_line_starts,
        }
    }

    pub fn text(&self) -> &'a str {
        self.text
    }

    pub fn line_count(&self) -> u32 {
        u32::try_from(split_lines(self.text).len()).unwrap_or(u32::MAX)
    }

    pub fn line_start(&self, line: u32) -> Option<usize> {
        let index = usize::try_from(line.checked_sub(1)?).ok()?;
        self.line_starts.get(index).copied()
    }

    pub fn line_text(&self, line: u32) -> Option<&'a str> {
        let start = self.line_start(line)?;
        let rest = self.text.get(start..)?;
        Some(rest.split('\n').next().unwrap_or(""))
    }

    pub fn utf16_offset(&self, line: u32, byte_col: usize) -> Option<u32> {
        let index = usize::try_from(line.checked_sub(1)?).ok()?;
        let line_utf16_start = *self.utf16_line_starts.get(index)?;
        let line_text = self.line_text(line)?;
        let prefix = line_text.get(..byte_col.min(line_text.len()))?;
        Some(line_utf16_start.saturating_add(utf16_len(prefix)))
    }

    pub fn line_end_utf16(&self, line: u32) -> Option<u32> {
        self.utf16_offset(line, self.line_text(line)?.len())
    }

    pub fn removal_range(&self, first: u32, last: u32) -> Option<(u32, u32)> {
        let start = self.utf16_offset(first, 0)?;
        let next_line_index = usize::try_from(last).ok()?;
        if let Some(next_start) = self.utf16_line_starts.get(next_line_index) {
            return Some((start, *next_start));
        }
        let end = self.line_end_utf16(last)?;
        let preceding_newline = u32::from(first > 1);
        Some((start.saturating_sub(preceding_newline), end))
    }

    pub fn position_of_utf16(&self, offset: u32) -> Option<(u32, usize)> {
        let line_index = match self.utf16_line_starts.binary_search(&offset) {
            Ok(exact) => exact,
            Err(insert_at) => insert_at.checked_sub(1)?,
        };
        let line = u32::try_from(line_index + 1).ok()?;
        let line_text = self.line_text(line)?;
        let mut remaining = offset.saturating_sub(*self.utf16_line_starts.get(line_index)?);
        let mut byte_col = 0;
        for ch in line_text.chars() {
            let width = u32::try_from(ch.len_utf16()).unwrap_or(1);
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
