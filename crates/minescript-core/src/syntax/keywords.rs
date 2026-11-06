pub const KEYWORDS: [&str; 18] = [
    "and", "by", "else", "false", "forward", "here", "if", "isThere", "mine", "not", "or", "print",
    "set", "step", "to", "true", "turn", "while",
];

pub const COMMANDS: [&str; 8] = [
    "step", "turn", "mine", "print", "set", "if", "else", "while",
];

pub fn is_keyword(word: &str) -> bool {
    KEYWORDS.contains(&word)
}

pub fn is_command(word: &str) -> bool {
    COMMANDS.contains(&word)
}

pub fn is_reserved(word: &str) -> bool {
    KEYWORDS
        .iter()
        .any(|keyword| keyword.eq_ignore_ascii_case(word))
}

pub fn canonical_keyword(word: &str) -> Option<&'static str> {
    KEYWORDS
        .iter()
        .copied()
        .find(|keyword| keyword.eq_ignore_ascii_case(word))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn there_are_eighteen_distinct_keywords() {
        let mut sorted = KEYWORDS.to_vec();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), 18);
    }

    #[test]
    fn keywords_are_case_sensitive() {
        assert!(is_keyword("isThere"));
        assert!(!is_keyword("isthere"));
        assert!(!is_keyword("Step"));
    }

    #[test]
    fn reserved_check_ignores_case() {
        assert!(is_reserved("If"));
        assert!(is_reserved("ISTHERE"));
        assert!(is_reserved("while"));
        assert!(!is_reserved("arany"));
        assert!(!is_reserved("iff"));
    }

    #[test]
    fn commands_are_keywords() {
        assert!(COMMANDS.iter().all(|command| is_keyword(command)));
        assert!(is_command("else"));
        assert!(!is_command("forward"));
    }

    #[test]
    fn canonical_keyword_restores_spelling() {
        assert_eq!(canonical_keyword("ISTHERE"), Some("isThere"));
        assert_eq!(canonical_keyword("Step"), Some("step"));
        assert_eq!(canonical_keyword("arany"), None);
    }
}
