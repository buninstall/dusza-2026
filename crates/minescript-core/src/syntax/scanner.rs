use crate::source::split_lines;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RawLine<'a> {
    pub number: u32,
    pub text: &'a str,
    pub indent: usize,
}

impl<'a> RawLine<'a> {
    pub fn content(&self) -> &'a str {
        self.text.get(self.indent..).unwrap_or("")
    }
}

pub fn raw_lines(normalized: &str) -> Vec<RawLine<'_>> {
    split_lines(normalized)
        .into_iter()
        .zip(1u32..)
        .map(|(text, number)| RawLine {
            number,
            text,
            indent: text.len() - text.trim_start_matches(' ').len(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn raw_lines_measure_space_indent() {
        let lines = raw_lines("while t\n    print 1\n");
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[1].number, 2);
        assert_eq!(lines[1].indent, 4);
        assert_eq!(lines[1].content(), "print 1");
    }

    #[test]
    fn tabs_are_not_counted_as_indent() {
        let lines = raw_lines("\tprint 1");
        assert_eq!(lines[0].indent, 0);
        assert_eq!(lines[0].content(), "\tprint 1");
    }
}
