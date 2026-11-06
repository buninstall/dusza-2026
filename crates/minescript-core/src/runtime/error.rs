use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RuntimeErrorCode {
    ETypeMismatch,
    EUninitialized,
    ENonBoolCondition,
    EBadOperand,
    EBedrockHit,
    ENoGold,
    EBadArg,
    EIntOverflow,
    InstructionCountLimitExceeded,
}

impl RuntimeErrorCode {
    pub const ALL: [Self; 9] = [
        Self::ETypeMismatch,
        Self::EUninitialized,
        Self::ENonBoolCondition,
        Self::EBadOperand,
        Self::EBedrockHit,
        Self::ENoGold,
        Self::EBadArg,
        Self::EIntOverflow,
        Self::InstructionCountLimitExceeded,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::ETypeMismatch => "E_TYPE_MISMATCH",
            Self::EUninitialized => "E_UNINITIALIZED",
            Self::ENonBoolCondition => "E_NON_BOOL_CONDITION",
            Self::EBadOperand => "E_BAD_OPERAND",
            Self::EBedrockHit => "E_BEDROCK_HIT",
            Self::ENoGold => "E_NO_GOLD",
            Self::EBadArg => "E_BAD_ARG",
            Self::EIntOverflow => "E_INT_OVERFLOW",
            Self::InstructionCountLimitExceeded => "INSTRUCTION_COUNT_LIMIT_EXCEEDED",
        }
    }

    pub fn message(self) -> &'static str {
        match self {
            Self::ETypeMismatch => {
                "Típust váltó értékadás: a változó típusa az első értékadáskor rögzült."
            }
            Self::EUninitialized => "Értékadás előtt olvasott változó.",
            Self::ENonBoolCondition => "Az if vagy a while feltétele nem logikai érték.",
            Self::EBadOperand => "A művelet operandusának típusa nem megfelelő.",
            Self::EBedrockHit => "A robot falba ütközne vagy lelépne a térképről.",
            Self::ENoGold => "Ezen a mezőn nincs (vagy már nincs) kibányászható arany.",
            Self::EBadArg => "Az utasítás paramétere érvénytelen típusú vagy tartományon kívüli.",
            Self::EIntOverflow => {
                "Az egész szám túllépte a megengedett tartományt (±9 007 199 254 740 991)."
            }
            Self::InstructionCountLimitExceeded => {
                "A program elérte az 1000 feldolgozott sor korlátját."
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeError {
    pub code: RuntimeErrorCode,
    pub line: u32,
}

impl RuntimeError {
    pub fn new(code: RuntimeErrorCode, line: u32) -> Self {
        Self { code, line }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serde_name_matches_as_str() {
        for code in RuntimeErrorCode::ALL {
            let json = serde_json::to_string(&code).unwrap();
            assert_eq!(json, format!("\"{}\"", code.as_str()));
            assert!(!code.message().is_empty());
        }
    }
}
