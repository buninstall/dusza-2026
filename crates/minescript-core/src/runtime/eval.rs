use super::error::RuntimeErrorCode;
use super::trace::INT_LIMIT;
use super::value::{Value, ValueType};
use crate::syntax::ast::BinOp;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Operands {
    Integers,
    Booleans,
    SameType,
}

impl Operands {
    fn of(op: BinOp) -> Self {
        match op {
            BinOp::Add
            | BinOp::Sub
            | BinOp::Mul
            | BinOp::Lt
            | BinOp::Le
            | BinOp::Gt
            | BinOp::Ge => Self::Integers,
            BinOp::And | BinOp::Or => Self::Booleans,
            BinOp::Eq | BinOp::Ne => Self::SameType,
        }
    }

    fn required(self) -> Option<ValueType> {
        match self {
            Self::Integers => Some(ValueType::Int),
            Self::Booleans => Some(ValueType::Bool),
            Self::SameType => None,
        }
    }
}

pub(super) fn check_left(op: BinOp, left: Value) -> Result<(), RuntimeErrorCode> {
    expect_type(Operands::of(op).required(), left)
}

pub(super) fn check_right(op: BinOp, left: Value, right: Value) -> Result<(), RuntimeErrorCode> {
    let required = Operands::of(op)
        .required()
        .unwrap_or_else(|| left.value_type());
    expect_type(Some(required), right)
}

fn expect_type(required: Option<ValueType>, value: Value) -> Result<(), RuntimeErrorCode> {
    match required {
        Some(value_type) if value_type != value.value_type() => Err(RuntimeErrorCode::EBadOperand),
        _ => Ok(()),
    }
}

pub(super) fn negate(operand: Value) -> Result<Value, RuntimeErrorCode> {
    operand
        .as_bool()
        .map(|value| Value::Bool(!value))
        .ok_or(RuntimeErrorCode::EBadOperand)
}

pub(super) fn apply(op: BinOp, left: Value, right: Value) -> Result<Value, RuntimeErrorCode> {
    use Value::{Bool, Int};
    match (op, left, right) {
        (BinOp::Add, Int(a), Int(b)) => integer(a.checked_add(b)),
        (BinOp::Sub, Int(a), Int(b)) => integer(a.checked_sub(b)),
        (BinOp::Mul, Int(a), Int(b)) => integer(a.checked_mul(b)),
        (BinOp::Lt, Int(a), Int(b)) => Ok(Bool(a < b)),
        (BinOp::Le, Int(a), Int(b)) => Ok(Bool(a <= b)),
        (BinOp::Gt, Int(a), Int(b)) => Ok(Bool(a > b)),
        (BinOp::Ge, Int(a), Int(b)) => Ok(Bool(a >= b)),
        (BinOp::And, Bool(a), Bool(b)) => Ok(Bool(a && b)),
        (BinOp::Or, Bool(a), Bool(b)) => Ok(Bool(a || b)),
        (BinOp::Eq, a, b) if a.value_type() == b.value_type() => Ok(Bool(a == b)),
        (BinOp::Ne, a, b) if a.value_type() == b.value_type() => Ok(Bool(a != b)),
        _ => Err(RuntimeErrorCode::EBadOperand),
    }
}

fn integer(result: Option<i64>) -> Result<Value, RuntimeErrorCode> {
    result
        .filter(|value| (-INT_LIMIT..=INT_LIMIT).contains(value))
        .map(Value::Int)
        .ok_or(RuntimeErrorCode::EIntOverflow)
}

#[cfg(test)]
mod tests {
    use super::*;
    use RuntimeErrorCode::{EBadOperand, EIntOverflow};
    use Value::{Bool, Int};

    #[test]
    fn arithmetic_and_comparison_need_integers() {
        assert_eq!(apply(BinOp::Add, Int(2), Int(3)), Ok(Int(5)));
        assert_eq!(apply(BinOp::Sub, Int(2), Int(3)), Ok(Int(-1)));
        assert_eq!(apply(BinOp::Mul, Int(4), Int(3)), Ok(Int(12)));
        assert_eq!(apply(BinOp::Lt, Int(2), Int(3)), Ok(Bool(true)));
        assert_eq!(apply(BinOp::Le, Int(3), Int(3)), Ok(Bool(true)));
        assert_eq!(apply(BinOp::Gt, Int(2), Int(3)), Ok(Bool(false)));
        assert_eq!(apply(BinOp::Ge, Int(2), Int(3)), Ok(Bool(false)));
        assert_eq!(check_left(BinOp::Add, Bool(true)), Err(EBadOperand));
        assert_eq!(check_right(BinOp::Lt, Int(1), Bool(true)), Err(EBadOperand));
        assert_eq!(apply(BinOp::Add, Bool(true), Int(1)), Err(EBadOperand));
    }

    #[test]
    fn logic_needs_booleans_without_short_circuit_semantics() {
        assert_eq!(apply(BinOp::And, Bool(true), Bool(false)), Ok(Bool(false)));
        assert_eq!(apply(BinOp::Or, Bool(true), Bool(false)), Ok(Bool(true)));
        assert_eq!(check_left(BinOp::And, Int(5)), Err(EBadOperand));
        assert_eq!(check_right(BinOp::Or, Bool(true), Int(1)), Err(EBadOperand));
        assert_eq!(negate(Bool(true)), Ok(Bool(false)));
        assert_eq!(negate(Int(0)), Err(EBadOperand));
    }

    #[test]
    fn equality_accepts_any_first_operand_but_matching_second() {
        assert_eq!(check_left(BinOp::Eq, Int(1)), Ok(()));
        assert_eq!(check_left(BinOp::Ne, Bool(true)), Ok(()));
        assert_eq!(check_right(BinOp::Eq, Int(1), Bool(true)), Err(EBadOperand));
        assert_eq!(check_right(BinOp::Ne, Bool(true), Bool(false)), Ok(()));
        assert_eq!(apply(BinOp::Eq, Int(1), Int(1)), Ok(Bool(true)));
        assert_eq!(apply(BinOp::Ne, Bool(true), Bool(false)), Ok(Bool(true)));
        assert_eq!(apply(BinOp::Eq, Int(1), Bool(true)), Err(EBadOperand));
    }

    #[test]
    fn results_beyond_the_safe_integer_range_overflow() {
        assert_eq!(
            apply(BinOp::Add, Int(INT_LIMIT), Int(0)),
            Ok(Int(INT_LIMIT))
        );
        assert_eq!(apply(BinOp::Add, Int(INT_LIMIT), Int(1)), Err(EIntOverflow));
        assert_eq!(
            apply(BinOp::Sub, Int(-INT_LIMIT), Int(1)),
            Err(EIntOverflow)
        );
        assert_eq!(
            apply(BinOp::Mul, Int(INT_LIMIT), Int(INT_LIMIT)),
            Err(EIntOverflow)
        );
        assert_eq!(apply(BinOp::Mul, Int(i64::MAX), Int(2)), Err(EIntOverflow));
    }
}
