pub mod messages;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::source::LineIndex;
use crate::span::Span;

pub use messages::{help, message};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum Severity {
    Error,
    Warning,
    Info,
    Hint,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TextEdit {
    pub from: u32,
    pub to: u32,
    pub insert: String,
}

impl TextEdit {
    pub fn new(from: u32, to: u32, insert: impl Into<String>) -> Self {
        Self {
            from,
            to,
            insert: insert.into(),
        }
    }

    pub fn delete(from: u32, to: u32) -> Self {
        Self::new(from, to, String::new())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Fix {
    pub title: String,
    pub edits: Vec<TextEdit>,
}

impl Fix {
    pub fn new(title: impl Into<String>, edits: Vec<TextEdit>) -> Self {
        Self {
            title: title.into(),
            edits,
        }
    }

    pub fn single(title: impl Into<String>, edit: TextEdit) -> Self {
        Self::new(title, vec![edit])
    }

    pub fn removing_lines(index: &LineIndex<'_>, first: u32, last: u32) -> Option<Self> {
        let (from, to) = index.removal_range(first, last)?;
        let title = if first == last {
            messages::FIX_DELETE_LINE
        } else {
            messages::FIX_DELETE_LINES
        };
        Some(Self::single(title, TextEdit::delete(from, to)))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DiagCode {
    SynTab,
    SynEmptyLine,
    SynDoubleSpace,
    SynTrailingSpace,
    SynLoneCr,
    SynUnknownCommand,
    SynUnexpectedToken,
    SynMissingToken,
    SynExtraToken,
    SynInvalidToken,
    SynInvalidIdent,
    SynReservedIdent,
    SynNumberRange,
    SynToplevelIndent,
    SynUnexpectedIndent,
    SynInconsistentIndent,
    SynDedentMismatch,
    SynElseWithoutIf,
    SynNotImplemented,
    LintUnusedVar,
    LintMaybeUninit,
    LintNonBoolLiteralCondition,
    LintTypeChange,
    LintIsthereRange,
    LintEmptyBlock,
    LintCaseCollision,
    LintLeadingZero,
    LintMergeSteps,
    LintMergeTurns,
    LintTurnMod4,
    LintNoop,
    MapEmpty,
    MapHeader,
    MapDimRange,
    MapRowCount,
    MapRowLength,
    MapBadSymbol,
    MapNoRobot,
    MapMultipleRobots,
    MapNoGold,
    MapUnreachableGold,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiagCategory {
    Syntax,
    Lint,
    Map,
}

impl DiagCode {
    pub const ALL: [Self; 41] = [
        Self::SynTab,
        Self::SynEmptyLine,
        Self::SynDoubleSpace,
        Self::SynTrailingSpace,
        Self::SynLoneCr,
        Self::SynUnknownCommand,
        Self::SynUnexpectedToken,
        Self::SynMissingToken,
        Self::SynExtraToken,
        Self::SynInvalidToken,
        Self::SynInvalidIdent,
        Self::SynReservedIdent,
        Self::SynNumberRange,
        Self::SynToplevelIndent,
        Self::SynUnexpectedIndent,
        Self::SynInconsistentIndent,
        Self::SynDedentMismatch,
        Self::SynElseWithoutIf,
        Self::SynNotImplemented,
        Self::LintUnusedVar,
        Self::LintMaybeUninit,
        Self::LintNonBoolLiteralCondition,
        Self::LintTypeChange,
        Self::LintIsthereRange,
        Self::LintEmptyBlock,
        Self::LintCaseCollision,
        Self::LintLeadingZero,
        Self::LintMergeSteps,
        Self::LintMergeTurns,
        Self::LintTurnMod4,
        Self::LintNoop,
        Self::MapEmpty,
        Self::MapHeader,
        Self::MapDimRange,
        Self::MapRowCount,
        Self::MapRowLength,
        Self::MapBadSymbol,
        Self::MapNoRobot,
        Self::MapMultipleRobots,
        Self::MapNoGold,
        Self::MapUnreachableGold,
    ];

    pub fn category(self) -> DiagCategory {
        match self {
            Self::SynTab
            | Self::SynEmptyLine
            | Self::SynDoubleSpace
            | Self::SynTrailingSpace
            | Self::SynLoneCr
            | Self::SynUnknownCommand
            | Self::SynUnexpectedToken
            | Self::SynMissingToken
            | Self::SynExtraToken
            | Self::SynInvalidToken
            | Self::SynInvalidIdent
            | Self::SynReservedIdent
            | Self::SynNumberRange
            | Self::SynToplevelIndent
            | Self::SynUnexpectedIndent
            | Self::SynInconsistentIndent
            | Self::SynDedentMismatch
            | Self::SynElseWithoutIf
            | Self::SynNotImplemented => DiagCategory::Syntax,
            Self::LintUnusedVar
            | Self::LintMaybeUninit
            | Self::LintNonBoolLiteralCondition
            | Self::LintTypeChange
            | Self::LintIsthereRange
            | Self::LintEmptyBlock
            | Self::LintCaseCollision
            | Self::LintLeadingZero
            | Self::LintMergeSteps
            | Self::LintMergeTurns
            | Self::LintTurnMod4
            | Self::LintNoop => DiagCategory::Lint,
            Self::MapEmpty
            | Self::MapHeader
            | Self::MapDimRange
            | Self::MapRowCount
            | Self::MapRowLength
            | Self::MapBadSymbol
            | Self::MapNoRobot
            | Self::MapMultipleRobots
            | Self::MapNoGold
            | Self::MapUnreachableGold => DiagCategory::Map,
        }
    }

    pub fn default_severity(self) -> Severity {
        match (self.category(), self) {
            (DiagCategory::Lint, Self::LintLeadingZero | Self::LintTurnMod4) => Severity::Info,
            (DiagCategory::Lint, Self::LintMergeSteps | Self::LintMergeTurns) => Severity::Hint,
            (DiagCategory::Lint, _) | (_, Self::MapNoGold | Self::MapUnreachableGold) => {
                Severity::Warning
            }
            (DiagCategory::Syntax | DiagCategory::Map, _) => Severity::Error,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub code: DiagCode,
    pub severity: Severity,
    pub span: Span,
    pub message: String,
    pub help: Option<String>,
    pub fixes: Vec<Fix>,
}

impl Diagnostic {
    pub fn new(code: DiagCode, span: Span) -> Self {
        Self {
            code,
            severity: code.default_severity(),
            span,
            message: message(code).to_owned(),
            help: help(code).map(str::to_owned),
            fixes: Vec::new(),
        }
    }

    #[must_use]
    pub fn with_message(mut self, message: impl Into<String>) -> Self {
        self.message = message.into();
        self
    }

    #[must_use]
    pub fn with_help(mut self, help: impl Into<String>) -> Self {
        self.help = Some(help.into());
        self
    }

    #[must_use]
    pub fn with_fix(mut self, fix: Fix) -> Self {
        self.fixes.push(fix);
        self
    }

    #[must_use]
    pub fn with_fixes(mut self, fixes: impl IntoIterator<Item = Fix>) -> Self {
        self.fixes.extend(fixes);
        self
    }

    pub fn is_error(&self) -> bool {
        self.severity == Severity::Error
    }
}

pub fn has_errors(diagnostics: &[Diagnostic]) -> bool {
    diagnostics.iter().any(Diagnostic::is_error)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_code_has_a_message() {
        for code in DiagCode::ALL {
            assert!(!message(code).is_empty(), "{code:?}");
        }
    }

    #[test]
    fn codes_serialize_in_screaming_snake_case() {
        let json = serde_json::to_string(&DiagCode::LintIsthereRange).unwrap();
        assert_eq!(json, "\"LINT_ISTHERE_RANGE\"");
        let json = serde_json::to_string(&DiagCode::LintTurnMod4).unwrap();
        assert_eq!(json, "\"LINT_TURN_MOD4\"");
    }

    #[test]
    fn severities_follow_category() {
        assert_eq!(DiagCode::SynTab.default_severity(), Severity::Error);
        assert_eq!(DiagCode::LintNoop.default_severity(), Severity::Warning);
        assert_eq!(DiagCode::MapNoGold.default_severity(), Severity::Warning);
        assert_eq!(DiagCode::MapHeader.default_severity(), Severity::Error);
        assert_eq!(DiagCode::LintLeadingZero.default_severity(), Severity::Info);
        assert_eq!(DiagCode::LintTurnMod4.default_severity(), Severity::Info);
        assert_eq!(DiagCode::LintMergeSteps.default_severity(), Severity::Hint);
        assert_eq!(DiagCode::LintMergeTurns.default_severity(), Severity::Hint);
    }

    #[test]
    fn builders_attach_messages_help_and_fixes() {
        let fix = Fix::single("Törlés", TextEdit::delete(1, 2));
        let diagnostic = Diagnostic::new(DiagCode::SynTab, Span::default())
            .with_message("üzenet")
            .with_help("súgó")
            .with_fix(fix.clone())
            .with_fixes(None)
            .with_fixes(Some(Fix::new("Csere", vec![TextEdit::new(0, 1, "x")])));
        assert_eq!(diagnostic.message, "üzenet");
        assert_eq!(diagnostic.help.as_deref(), Some("súgó"));
        assert_eq!(diagnostic.fixes.len(), 2);
        assert_eq!(diagnostic.fixes[0], fix);
        assert_eq!(diagnostic.fixes[1].edits[0].insert, "x");
    }

    #[test]
    fn removing_lines_names_the_amount() {
        let index = LineIndex::new("a\nb\nc\n");
        let one = Fix::removing_lines(&index, 2, 2).unwrap();
        assert_eq!(one.title, messages::FIX_DELETE_LINE);
        assert_eq!(one.edits, vec![TextEdit::delete(2, 4)]);
        let two = Fix::removing_lines(&index, 2, 3).unwrap();
        assert_eq!(two.title, messages::FIX_DELETE_LINES);
        assert_eq!(two.edits, vec![TextEdit::delete(2, 6)]);
        assert_eq!(Fix::removing_lines(&index, 9, 9), None);
    }

    #[test]
    fn has_errors_ignores_warnings() {
        let warning = Diagnostic::new(DiagCode::MapNoGold, Span::default());
        assert!(!has_errors(std::slice::from_ref(&warning)));
        let error = Diagnostic::new(DiagCode::MapHeader, Span::default());
        assert!(has_errors(&[warning, error]));
    }
}
