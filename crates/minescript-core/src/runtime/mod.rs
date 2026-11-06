mod error;
mod robot;
mod trace;
mod value;
mod vm;

pub use error::{RuntimeError, RuntimeErrorCode};
pub use robot::{RobotState, StepResult};
pub use trace::{Assignment, Event, INT_LIMIT, MAX_STEPS, Outcome, RunResult};
pub use value::{Value, ValueType};
pub use vm::{run, run_with_map_text};
