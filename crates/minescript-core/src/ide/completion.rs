use super::docs::{
    BOOL_DETAIL, COMMAND_DOCS, ISTHERE_SNIPPET, NOT_SNIPPET, PROBE_CODES, PROBE_DETAIL,
    VARIABLE_DETAIL, keyword_doc, operator_doc,
};
use super::outline::{code_lines, first_assignments};
use super::{CompletionItem, CompletionKind};
use crate::source::{LineIndex, normalize};
use crate::syntax::ast::BinOp;
use crate::syntax::keywords::Keyword;
use crate::syntax::lexeme::classify;
use crate::syntax::scanner::SPACE;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Slot {
    Command,
    Keyword(Keyword),
    Value { with_booleans: bool },
    Target,
    Expression,
    ProbeCode,
    Operator,
    Nothing,
}

pub fn complete(src: &str, offset: u32) -> Vec<CompletionItem> {
    let text = normalize(src);
    let index = LineIndex::new(&text);
    let Some((line, byte_col)) = index.position_of_utf16(offset) else {
        return Vec::new();
    };
    let before_cursor = index
        .line_text(line)
        .and_then(|line_text| line_text.get(..byte_col))
        .unwrap_or_default();
    let mut words: Vec<&str> = before_cursor
        .trim_start_matches(SPACE)
        .split(SPACE)
        .collect();
    words.pop();
    let lines = code_lines(&text);
    let variables: Vec<&str> = first_assignments(&lines)
        .into_iter()
        .filter(|site| site.line != line)
        .map(|site| site.name)
        .collect();
    items_for(slot_after(&words), &variables)
}

fn slot_after(words: &[&str]) -> Slot {
    let is_value = |word: &str| classify(word).is_simple_value();
    let is_operator = |word: &str| classify(word).binary_operator().is_some();
    match words {
        [] => Slot::Command,
        ["step"] => Slot::Keyword(Keyword::Forward),
        ["turn"] => Slot::Keyword(Keyword::By),
        ["mine"] => Slot::Keyword(Keyword::Here),
        ["step", "forward"] | ["turn", "by"] => Slot::Value {
            with_booleans: false,
        },
        ["print" | "if" | "while"] | ["set", _, "to", "not"] => Slot::Value {
            with_booleans: true,
        },
        ["set"] => Slot::Target,
        ["set", _] => Slot::Keyword(Keyword::To),
        ["set", _, "to"] => Slot::Expression,
        ["set", _, "to", "isThere"] => Slot::ProbeCode,
        ["set", _, "to", value] if is_value(value) => Slot::Operator,
        ["set", _, "to", value, op] if is_value(value) && is_operator(op) => Slot::Value {
            with_booleans: true,
        },
        _ => Slot::Nothing,
    }
}

fn items_for(slot: Slot, variables: &[&str]) -> Vec<CompletionItem> {
    match slot {
        Slot::Command => commands(),
        Slot::Keyword(keyword) => vec![keyword_item(keyword)],
        Slot::Value { with_booleans } => values(variables, with_booleans),
        Slot::Target => variable_items(variables),
        Slot::Expression => {
            let mut items = values(variables, true);
            items.push(snippet(Keyword::IsThere, ISTHERE_SNIPPET));
            items.push(snippet(Keyword::Not, NOT_SNIPPET));
            items
        }
        Slot::ProbeCode => {
            let mut items: Vec<CompletionItem> = PROBE_CODES
                .iter()
                .map(|(code, meaning)| {
                    item(code, CompletionKind::Value, PROBE_DETAIL, meaning, code)
                })
                .collect();
            items.extend(variable_items(variables));
            items
        }
        Slot::Operator => BinOp::ALL.into_iter().map(operator_item).collect(),
        Slot::Nothing => Vec::new(),
    }
}

fn item(
    label: &str,
    kind: CompletionKind,
    detail: &str,
    documentation: &str,
    insert_text: &str,
) -> CompletionItem {
    CompletionItem {
        label: label.to_owned(),
        kind,
        detail: detail.to_owned(),
        documentation: documentation.to_owned(),
        insert_text: insert_text.to_owned(),
    }
}

fn commands() -> Vec<CompletionItem> {
    COMMAND_DOCS
        .iter()
        .map(|doc| {
            let kind = if doc.snippet.contains("${") {
                CompletionKind::Snippet
            } else {
                CompletionKind::Keyword
            };
            item(doc.label, kind, doc.detail, doc.documentation, doc.snippet)
        })
        .collect()
}

fn keyword_item(keyword: Keyword) -> CompletionItem {
    let word = keyword.as_str();
    item(
        word,
        CompletionKind::Keyword,
        word,
        keyword_doc(word).unwrap_or_default(),
        word,
    )
}

fn snippet(keyword: Keyword, snippet: &str) -> CompletionItem {
    let word = keyword.as_str();
    item(
        word,
        CompletionKind::Snippet,
        snippet,
        keyword_doc(word).unwrap_or_default(),
        snippet,
    )
}

fn variable_items(variables: &[&str]) -> Vec<CompletionItem> {
    variables
        .iter()
        .map(|name| item(name, CompletionKind::Variable, VARIABLE_DETAIL, "", name))
        .collect()
}

fn values(variables: &[&str], with_booleans: bool) -> Vec<CompletionItem> {
    let mut items = variable_items(variables);
    if with_booleans {
        items.extend([Keyword::True, Keyword::False].map(|keyword| {
            let word = keyword.as_str();
            item(
                word,
                CompletionKind::Value,
                BOOL_DETAIL,
                keyword_doc(word).unwrap_or_default(),
                word,
            )
        }));
    }
    items
}

fn operator_item(op: BinOp) -> CompletionItem {
    let symbol = op.symbol();
    item(
        symbol,
        CompletionKind::Keyword,
        operator_doc(op),
        operator_doc(op),
        symbol,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn labels(src: &str) -> Vec<String> {
        let offset = u32::try_from(src.encode_utf16().count()).unwrap();
        complete(src, offset)
            .into_iter()
            .map(|item| item.label)
            .collect()
    }

    const DEFINED: &str = "set arany to isThere 2\nset count to 0\n";

    #[test]
    fn completes_all_commands_at_line_start() {
        let items = complete("", 0);
        assert_eq!(items.len(), 8);
        assert!(
            items
                .iter()
                .any(|item| item.insert_text.starts_with("while "))
        );
        assert_eq!(labels("while t\n    pr").len(), 8);
    }

    #[test]
    fn completes_fixed_keywords_after_commands() {
        assert_eq!(labels("step "), vec!["forward"]);
        assert_eq!(labels("turn b"), vec!["by"]);
        assert_eq!(labels("mine "), vec!["here"]);
        assert_eq!(labels(&format!("{DEFINED}set x ")), vec!["to"]);
    }

    #[test]
    fn completes_variable_names_and_values() {
        assert_eq!(labels(&format!("{DEFINED}set ")), vec!["arany", "count"]);
        assert_eq!(
            labels(&format!("{DEFINED}step forward ")),
            vec!["arany", "count"]
        );
        assert_eq!(
            labels(&format!("{DEFINED}if ")),
            vec!["arany", "count", "true", "false"]
        );
        assert!(labels("set a").is_empty());
    }

    #[test]
    fn completes_calculated_values() {
        assert_eq!(
            labels(&format!("{DEFINED}set x to ")),
            vec!["arany", "count", "true", "false", "isThere", "not"]
        );
        assert_eq!(
            labels(&format!("{DEFINED}set x to isThere ")),
            vec!["0", "1", "2", "arany", "count"]
        );
        assert_eq!(
            labels(&format!("{DEFINED}set x to not ")),
            vec!["arany", "count", "true", "false"]
        );
    }

    #[test]
    fn completes_operators_after_the_first_operand() {
        let operators = labels(&format!("{DEFINED}set x to count "));
        assert_eq!(operators.len(), 11);
        assert!(operators.contains(&"<=".to_owned()));
        assert_eq!(
            labels(&format!("{DEFINED}set x to count + ")),
            vec!["arany", "count", "true", "false"]
        );
    }

    #[test]
    fn nothing_fits_after_a_complete_statement() {
        assert!(labels("mine here ").is_empty());
        assert!(labels("set x to 1 + 2 ").is_empty());
    }

    #[test]
    fn offsets_past_the_end_complete_at_the_end() {
        assert_eq!(complete("print 1", 99), complete("print 1", 7));
    }
}
