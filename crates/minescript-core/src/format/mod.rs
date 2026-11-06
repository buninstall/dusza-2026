use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::diagnostics::Diagnostic;
use crate::syntax::parse;

pub const DEFAULT_INDENT_WIDTH: u32 = 4;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", default)]
pub struct FormatOptions {
    pub indent_width: u32,
}

impl Default for FormatOptions {
    fn default() -> Self {
        Self {
            indent_width: DEFAULT_INDENT_WIDTH,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FormatResult {
    pub text: String,
    pub changed: bool,
    pub diagnostics: Vec<Diagnostic>,
}

pub fn format(src: &str, options: &FormatOptions) -> FormatResult {
    let _ = options;
    FormatResult {
        text: src.to_owned(),
        changed: false,
        diagnostics: parse(src).diagnostics,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_indent_is_four_spaces() {
        assert_eq!(FormatOptions::default().indent_width, 4);
    }

    #[test]
    fn options_deserialize_with_defaults() {
        let options: FormatOptions = serde_json::from_str("{}").unwrap();
        assert_eq!(options, FormatOptions::default());
    }

    #[test]
    fn empty_source_stays_unchanged() {
        let result = format("", &FormatOptions::default());
        assert_eq!(result.text, "");
        assert!(!result.changed);
    }
}
