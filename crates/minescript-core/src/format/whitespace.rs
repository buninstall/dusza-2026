use crate::source::lines;
use crate::syntax::scanner::{SPACE, TAB, TAB_AS_INDENT};

pub(super) fn repair(normalized: &str) -> String {
    let mut text = String::with_capacity(normalized.len());
    for line in lines(normalized) {
        repair_line(line, &mut text);
    }
    text
}

fn repair_line(line: &str, text: &mut String) {
    let content = line.trim_start_matches([SPACE, TAB]);
    let mut words = content.split(SPACE).filter(|word| !word.is_empty());
    let Some(first) = words.next() else {
        return;
    };
    let indentation = line.get(..line.len() - content.len()).unwrap_or_default();
    for ch in indentation.chars() {
        if ch == TAB {
            text.push_str(TAB_AS_INDENT);
        } else {
            text.push(ch);
        }
    }
    text.push_str(first);
    for word in words {
        text.push(SPACE);
        text.push_str(word);
    }
    text.push('\n');
}

#[cfg(test)]
mod tests {
    use super::*;

    fn repair_line(line: &str) -> String {
        let mut text = String::new();
        super::repair_line(line, &mut text);
        text.pop();
        text
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
