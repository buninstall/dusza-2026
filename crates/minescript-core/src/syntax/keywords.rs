pub const KEYWORDS: [&str; 18] = [
    "and", "by", "else", "false", "forward", "here", "if", "isThere", "mine", "not", "or", "print",
    "set", "step", "to", "true", "turn", "while",
];

pub const COMMANDS: [&str; 8] = [
    "step", "turn", "mine", "print", "set", "if", "else", "while",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Keyword {
    And,
    By,
    Else,
    False,
    Forward,
    Here,
    If,
    IsThere,
    Mine,
    Not,
    Or,
    Print,
    Set,
    Step,
    To,
    True,
    Turn,
    While,
}

impl Keyword {
    pub const ALL: [Self; 18] = [
        Self::And,
        Self::By,
        Self::Else,
        Self::False,
        Self::Forward,
        Self::Here,
        Self::If,
        Self::IsThere,
        Self::Mine,
        Self::Not,
        Self::Or,
        Self::Print,
        Self::Set,
        Self::Step,
        Self::To,
        Self::True,
        Self::Turn,
        Self::While,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::And => "and",
            Self::By => "by",
            Self::Else => "else",
            Self::False => "false",
            Self::Forward => "forward",
            Self::Here => "here",
            Self::If => "if",
            Self::IsThere => "isThere",
            Self::Mine => "mine",
            Self::Not => "not",
            Self::Or => "or",
            Self::Print => "print",
            Self::Set => "set",
            Self::Step => "step",
            Self::To => "to",
            Self::True => "true",
            Self::Turn => "turn",
            Self::While => "while",
        }
    }

    pub fn exact(word: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|keyword| keyword.as_str() == word)
    }

    pub fn ignoring_case(word: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|keyword| keyword.as_str().eq_ignore_ascii_case(word))
    }

    pub fn command(self) -> Option<Command> {
        match self {
            Self::Step => Some(Command::Step),
            Self::Turn => Some(Command::Turn),
            Self::Mine => Some(Command::Mine),
            Self::Print => Some(Command::Print),
            Self::Set => Some(Command::Set),
            Self::If => Some(Command::If),
            Self::Else => Some(Command::Else),
            Self::While => Some(Command::While),
            Self::And
            | Self::By
            | Self::False
            | Self::Forward
            | Self::Here
            | Self::IsThere
            | Self::Not
            | Self::Or
            | Self::To
            | Self::True => None,
        }
    }

    pub fn bool_value(self) -> Option<bool> {
        match self {
            Self::True => Some(true),
            Self::False => Some(false),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Command {
    Step,
    Turn,
    Mine,
    Print,
    Set,
    If,
    Else,
    While,
}

impl Command {
    pub fn keyword(self) -> Keyword {
        match self {
            Self::Step => Keyword::Step,
            Self::Turn => Keyword::Turn,
            Self::Mine => Keyword::Mine,
            Self::Print => Keyword::Print,
            Self::Set => Keyword::Set,
            Self::If => Keyword::If,
            Self::Else => Keyword::Else,
            Self::While => Keyword::While,
        }
    }

    pub fn opens_block(self) -> bool {
        matches!(self, Self::If | Self::Else | Self::While)
    }
}

pub fn is_keyword(word: &str) -> bool {
    Keyword::exact(word).is_some()
}

pub fn is_command(word: &str) -> bool {
    Keyword::exact(word).and_then(Keyword::command).is_some()
}

pub fn is_reserved(word: &str) -> bool {
    Keyword::ignoring_case(word).is_some()
}

pub fn canonical_keyword(word: &str) -> Option<&'static str> {
    Keyword::ignoring_case(word).map(Keyword::as_str)
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
    fn keyword_enum_matches_the_spelled_list() {
        let spelled: Vec<&str> = Keyword::ALL
            .iter()
            .map(|keyword| keyword.as_str())
            .collect();
        assert_eq!(spelled, KEYWORDS);
    }

    #[test]
    fn command_flag_matches_the_command_list() {
        let commands: Vec<&str> = Keyword::ALL
            .iter()
            .filter(|keyword| keyword.command().is_some())
            .map(|keyword| keyword.as_str())
            .collect();
        let mut expected = COMMANDS.to_vec();
        expected.sort_unstable();
        let mut actual = commands;
        actual.sort_unstable();
        assert_eq!(actual, expected);
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
        assert!(!is_command("Step"));
    }

    #[test]
    fn canonical_keyword_restores_spelling() {
        assert_eq!(canonical_keyword("ISTHERE"), Some("isThere"));
        assert_eq!(canonical_keyword("Step"), Some("step"));
        assert_eq!(canonical_keyword("arany"), None);
    }

    #[test]
    fn commands_round_trip_and_know_their_blocks() {
        for keyword in Keyword::ALL {
            if let Some(command) = keyword.command() {
                assert_eq!(command.keyword(), keyword);
            }
        }
        assert!(Command::If.opens_block());
        assert!(Command::Else.opens_block());
        assert!(Command::While.opens_block());
        assert!(!Command::Set.opens_block());
    }

    #[test]
    fn bool_values() {
        assert_eq!(Keyword::True.bool_value(), Some(true));
        assert_eq!(Keyword::False.bool_value(), Some(false));
        assert_eq!(Keyword::Not.bool_value(), None);
    }
}
