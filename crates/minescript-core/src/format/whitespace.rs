use crate::source::split_lines;
use crate::syntax::scanner::{SPACE, TAB, TAB_AS_INDENT};

pub(super) fn repair(normalized: &str) -> String {
    split_lines(normalized)
        .into_iter()
        .map(repair_line)
        .filter(|line| !line.is_empty())
        .fold(String::with_capacity(normalized.len()), |mut text, line| {
            text.push_str(&line);
            text.push('\n');
            text
        })
}

fn repair_line(line: &str) -> String {
    let content = line.trim_start_matches([SPACE, TAB]);
    let indentation = line.get(..line.len() - content.len()).unwrap_or_default();
    let words: Vec<&str> = content
        .split(SPACE)
        .filter(|word| !word.is_empty())
        .collect();
    if words.is_empty() {
        return String::new();
    }
    format!(
        "{}{}",
        indentation.replace(TAB, TAB_AS_INDENT),
        words.join(" ")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

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
