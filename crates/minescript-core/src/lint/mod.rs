use crate::diagnostics::Diagnostic;
use crate::syntax::ast::Program;

pub fn lint(program: &Program) -> Vec<Diagnostic> {
    let _ = program;
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_program_has_no_warnings() {
        assert!(lint(&Program::default()).is_empty());
    }
}
