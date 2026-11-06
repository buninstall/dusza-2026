pub mod messages;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Fix {
    pub title: String,
    pub edits: Vec<TextEdit>,
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
            (DiagCategory::Syntax, _) => Severity::Error,
            (DiagCategory::Lint, _) | (_, Self::MapNoGold | Self::MapUnreachableGold) => {
                Severity::Warning
            }
            (DiagCategory::Map, _) => Severity::Error,
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
    }

    #[test]
    fn has_errors_ignores_warnings() {
        let warning = Diagnostic::new(DiagCode::MapNoGold, Span::default());
        assert!(!has_errors(std::slice::from_ref(&warning)));
        let error = Diagnostic::new(DiagCode::MapHeader, Span::default());
        assert!(has_errors(&[warning, error]));
    }
}
