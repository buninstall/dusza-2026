use std::fmt;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", content = "value", rename_all = "camelCase")]
pub enum Value {
    Int(i64),
    Bool(bool),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ValueType {
    Int,
    Bool,
}

impl Value {
    pub fn value_type(self) -> ValueType {
        match self {
            Self::Int(_) => ValueType::Int,
            Self::Bool(_) => ValueType::Bool,
        }
    }

    pub fn as_int(self) -> Option<i64> {
        match self {
            Self::Int(value) => Some(value),
            Self::Bool(_) => None,
        }
    }

    pub fn as_bool(self) -> Option<bool> {
        match self {
            Self::Bool(value) => Some(value),
            Self::Int(_) => None,
        }
    }
}

impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Int(value) => write!(f, "{value}"),
            Self::Bool(value) => write!(f, "{value}"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_matches_print_format() {
        assert_eq!(Value::Int(-5).to_string(), "-5");
        assert_eq!(Value::Int(42).to_string(), "42");
        assert_eq!(Value::Bool(true).to_string(), "true");
        assert_eq!(Value::Bool(false).to_string(), "false");
    }

    #[test]
    fn serializes_adjacently_tagged() {
        let json = serde_json::to_value(Value::Int(3)).unwrap();
        assert_eq!(json, serde_json::json!({ "kind": "int", "value": 3 }));
    }

    #[test]
    fn accessors_check_type() {
        assert_eq!(Value::Int(1).as_int(), Some(1));
        assert_eq!(Value::Int(1).as_bool(), None);
        assert_eq!(Value::Bool(true).value_type(), ValueType::Bool);
    }
}
