use crate::source::lines;
use crate::syntax::scanner::TAB_AS_INDENT;

pub(super) fn repair(normalized: &str) -> String {
    let mut text = Vec::with_capacity(normalized.len());
    for line in lines(normalized) {
        repair_line(line.as_bytes(), &mut text);
    }
    String::from_utf8(text)
        .unwrap_or_else(|error| String::from_utf8_lossy(error.as_bytes()).into_owned())
}

fn repair_line(line: &[u8], text: &mut Vec<u8>) {
    let indentation = line
        .iter()
        .take_while(|byte| matches!(byte, b' ' | b'\t'))
        .count();
    let content = line.get(indentation..).unwrap_or_default();
    if content.iter().all(|byte| *byte == b' ') {
        return;
    }
    for run in line
        .get(..indentation)
        .unwrap_or_default()
        .split_inclusive(|byte| *byte == b'\t')
    {
        match run.split_last() {
            Some((b'\t', spaces)) => {
                text.extend_from_slice(spaces);
                text.extend_from_slice(TAB_AS_INDENT.as_bytes());
            }
            _ => text.extend_from_slice(run),
        }
    }
    let mut gap = false;
    for &byte in content {
        if byte == b' ' {
            gap = true;
        } else {
            if gap {
                text.push(b' ');
                gap = false;
            }
            text.push(byte);
        }
    }
    text.push(b'\n');
}

#[cfg(test)]
mod tests {
    use super::*;

    fn repair_line(line: &str) -> String {
        let mut text = Vec::new();
        super::repair_line(line.as_bytes(), &mut text);
        text.pop();
        String::from_utf8(text).unwrap()
    }

    #[test]
    fn tabs_in_the_indentation_become_four_spaces() {
        assert_eq!(repair_line("\t print 1"), "     print 1");
    }

    #[test]
    fn inner_and_trailing_spaces_are_collapsed() {
        assert_eq!(repair_line("  set  a   to 1  "), "  set a to 1");
    }

    #[test]
    fn tabs_after_the_indentation_stay() {
        assert_eq!(repair_line("print\t1"), "print\t1");
    }

    #[test]
    fn blank_lines_disappear() {
        assert_eq!(repair("a\n\n \t \nb"), "a\nb\n");
        assert_eq!(repair(""), "");
    }
}
