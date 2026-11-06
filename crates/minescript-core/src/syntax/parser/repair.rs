use crate::syntax::lexeme::classify;

const OPERATOR_CHARS: &str = "+-*=<>";
const NEGATION_PREFIX: char = '-';

pub(super) fn respaced(word: &str) -> Option<String> {
    negated_literal(word).or_else(|| separated_operators(word))
}

fn negated_literal(word: &str) -> Option<String> {
    let operand = word.strip_prefix(NEGATION_PREFIX)?;
    classify(operand)
        .is_simple_value()
        .then(|| format!("0 - {operand}"))
}

fn separated_operators(word: &str) -> Option<String> {
    let pieces = operator_runs(word);
    let alternates = pieces.len() >= 3
        && pieces.len() % 2 == 1
        && pieces.iter().enumerate().all(|(position, piece)| {
            let lexeme = classify(piece);
            if position % 2 == 0 {
                lexeme.is_simple_value()
            } else {
                lexeme.binary_operator().is_some()
            }
        });
    alternates.then(|| pieces.join(" "))
}

fn operator_runs(word: &str) -> Vec<&str> {
    let mut pieces = Vec::new();
    let mut piece_start = 0;
    let mut previous_is_operator: Option<bool> = None;
    for (offset, ch) in word.char_indices() {
        let is_operator = OPERATOR_CHARS.contains(ch);
        if previous_is_operator.is_some_and(|previous| previous != is_operator) {
            pieces.push(word.get(piece_start..offset).unwrap_or_default());
            piece_start = offset;
        }
        previous_is_operator = Some(is_operator);
    }
    pieces.push(word.get(piece_start..).unwrap_or_default());
    pieces
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn negative_literals_become_subtractions() {
        assert_eq!(respaced("-5").as_deref(), Some("0 - 5"));
        assert_eq!(respaced("-x").as_deref(), Some("0 - x"));
        assert_eq!(respaced("-"), None);
        assert_eq!(respaced("-If"), None);
    }

    #[test]
    fn glued_operators_get_spaces() {
        assert_eq!(respaced("1+2").as_deref(), Some("1 + 2"));
        assert_eq!(respaced("a<=b").as_deref(), Some("a <= b"));
        assert_eq!(respaced("x<>true").as_deref(), Some("x <> true"));
        assert_eq!(respaced("1+2*3").as_deref(), Some("1 + 2 * 3"));
    }

    #[test]
    fn nonsense_has_no_suggestion() {
        assert_eq!(respaced("1+-2"), None);
        assert_eq!(respaced("a_b"), None);
        assert_eq!(respaced("1a+2"), None);
        assert_eq!(respaced("+1"), None);
        assert_eq!(respaced("árany"), None);
    }

    #[test]
    fn operator_runs_split_at_kind_changes() {
        assert_eq!(operator_runs("ab<=cd"), vec!["ab", "<=", "cd"]);
        assert_eq!(operator_runs("+"), vec!["+"]);
        assert_eq!(operator_runs(""), vec![""]);
    }
}
