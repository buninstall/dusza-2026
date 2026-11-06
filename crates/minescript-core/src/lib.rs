pub mod diagnostics;
pub mod format;
pub mod ide;
pub mod lint;
pub mod map;
pub mod runtime;
pub mod source;
pub mod span;
pub mod syntax;

pub use diagnostics::{DiagCategory, DiagCode, Diagnostic, Fix, Severity, TextEdit};
pub use format::{FormatOptions, FormatResult, format};
pub use ide::{
    Analysis, CompletionItem, CompletionKind, FoldRange, Hover, SemanticToken, SemanticTokenKind,
    Symbol, analyze, complete, hover,
};
pub use lint::lint;
pub use map::{Cell, Dir, Map, MapInfo, MapParseResult, Pos, map_info, parse_map, serialize_map};
pub use runtime::{
    Assignment, Event, INT_LIMIT, MAX_STEPS, Outcome, RobotState, RunResult, RuntimeErrorCode,
    Value, ValueType, run, run_program, run_with_map_text,
};
pub use span::Span;
pub use syntax::{ParseResult, ast, parse};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
