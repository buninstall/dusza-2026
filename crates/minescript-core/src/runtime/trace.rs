use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::error::RuntimeErrorCode;
use super::robot::RobotState;
use super::value::Value;
use crate::diagnostics::Diagnostic;
use crate::map::Pos;

pub const MAX_STEPS: u32 = 1000;
pub const INT_LIMIT: i64 = 9_007_199_254_740_991;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Assignment {
    pub name: String,
    pub value: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub index: u32,
    pub line: u32,
    pub robot: RobotState,
    pub path: Vec<Pos>,
    pub discovered: Vec<Pos>,
    pub mined: Option<Pos>,
    pub gold: u32,
    pub steps: u32,
    pub print: Option<String>,
    pub assigned: Option<Assignment>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Outcome {
    Ok,
    RuntimeError {
        code: RuntimeErrorCode,
        line: u32,
        message: String,
    },
    SyntaxError {
        diagnostics: Vec<Diagnostic>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    pub outcome: Outcome,
    pub events: Vec<Event>,
    pub gold: u32,
    pub steps: u32,
    pub console: Vec<String>,
    pub final_robot: RobotState,
    pub discovered: Vec<Pos>,
}

impl RunResult {
    pub fn not_started(start: RobotState, outcome: Outcome) -> Self {
        Self {
            outcome,
            events: Vec::new(),
            gold: 0,
            steps: 0,
            console: Vec::new(),
            final_robot: start,
            discovered: vec![start.pos],
        }
    }

    pub fn is_ok(&self) -> bool {
        matches!(self.outcome, Outcome::Ok)
    }

    pub fn is_syntax_error(&self) -> bool {
        matches!(self.outcome, Outcome::SyntaxError { .. })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::map::{Dir, Pos};

    #[test]
    fn int_limit_is_js_max_safe_integer() {
        assert_eq!(INT_LIMIT, (1_i64 << 53) - 1);
    }

    #[test]
    fn outcome_serializes_with_kind_tag() {
        let ok = serde_json::to_value(Outcome::Ok).unwrap();
        assert_eq!(ok, serde_json::json!({ "kind": "ok" }));
        let error = serde_json::to_value(Outcome::RuntimeError {
            code: RuntimeErrorCode::ENoGold,
            line: 3,
            message: String::new(),
        })
        .unwrap();
        assert_eq!(error["kind"], "runtimeError");
        assert_eq!(error["code"], "E_NO_GOLD");
    }

    #[test]
    fn not_started_discovers_start_cell() {
        let start = RobotState {
            pos: Pos::new(1, 2),
            dir: Dir::West,
        };
        let result = RunResult::not_started(start, Outcome::Ok);
        assert_eq!(result.discovered, vec![Pos::new(1, 2)]);
        assert_eq!(result.final_robot, start);
        assert!(result.is_ok());
    }
}
