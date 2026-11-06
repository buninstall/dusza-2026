use crate::syntax::keywords::Command;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum LineRole {
    Statement,
    If,
    Else,
    While,
}

impl LineRole {
    pub fn of(command: Option<Command>) -> Self {
        match command {
            Some(Command::If) => Self::If,
            Some(Command::Else) => Self::Else,
            Some(Command::While) => Self::While,
            Some(Command::Step | Command::Turn | Command::Mine | Command::Print | Command::Set)
            | None => Self::Statement,
        }
    }

    fn opens_block(self) -> bool {
        !matches!(self, Self::Statement)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum IndentFault {
    Toplevel,
    Unexpected {
        block_indent: usize,
    },
    Inconsistent {
        block_indent: usize,
    },
    DedentMismatch {
        nearest: usize,
        open_levels: Vec<usize>,
    },
    ElseWithoutIf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Placement {
    pub depth: usize,
    pub fault: Option<IndentFault>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LastSibling {
    Nothing,
    IfAwaitingElse,
    Other,
}

#[derive(Debug, Clone, Copy)]
struct Level {
    indent: usize,
    last: LastSibling,
}

impl Level {
    fn new(indent: usize) -> Self {
        Self {
            indent,
            last: LastSibling::Nothing,
        }
    }
}

#[derive(Debug, Clone)]
pub(super) struct Layout {
    levels: Vec<Level>,
    after_header: bool,
    started: bool,
}

impl Default for Layout {
    fn default() -> Self {
        Self {
            levels: vec![Level::new(0)],
            after_header: false,
            started: false,
        }
    }
}

impl Layout {
    pub fn place(&mut self, indent: usize, role: LineRole) -> Placement {
        let alignment = self.align(indent);
        let attachment = self.attach_else(role);
        self.remember(role);
        self.after_header = role.opens_block();
        self.started = true;
        Placement {
            depth: self.levels.len().saturating_sub(1),
            fault: alignment.or(attachment),
        }
    }

    fn top_indent(&self) -> usize {
        self.levels.last().map_or(0, |level| level.indent)
    }

    fn align(&mut self, indent: usize) -> Option<IndentFault> {
        let top = self.top_indent();
        if indent > top && self.after_header {
            self.levels.push(Level::new(indent));
            return None;
        }
        if indent > top {
            return Some(self.excess_indent_fault(top));
        }
        if indent < top {
            return self.dedent(indent);
        }
        None
    }

    fn excess_indent_fault(&self, block_indent: usize) -> IndentFault {
        if !self.started {
            IndentFault::Toplevel
        } else if self.levels.len() == 1 {
            IndentFault::Unexpected { block_indent }
        } else {
            IndentFault::Inconsistent { block_indent }
        }
    }

    fn dedent(&mut self, indent: usize) -> Option<IndentFault> {
        let lands_on_open_level = self.levels.iter().any(|level| level.indent == indent);
        let open_levels: Option<Vec<usize>> =
            (!lands_on_open_level).then(|| self.levels.iter().map(|level| level.indent).collect());
        let kept = self
            .levels
            .iter()
            .take_while(|level| level.indent <= indent)
            .count()
            .max(1);
        self.levels.truncate(kept);
        open_levels.map(|open_levels| IndentFault::DedentMismatch {
            nearest: self.top_indent(),
            open_levels,
        })
    }

    fn attach_else(&mut self, role: LineRole) -> Option<IndentFault> {
        if role != LineRole::Else {
            return None;
        }
        match self.levels.last_mut() {
            Some(level) if level.last == LastSibling::IfAwaitingElse => {
                level.last = LastSibling::Other;
                None
            }
            _ => Some(IndentFault::ElseWithoutIf),
        }
    }

    fn remember(&mut self, role: LineRole) {
        if let Some(level) = self.levels.last_mut() {
            level.last = if role == LineRole::If {
                LastSibling::IfAwaitingElse
            } else {
                LastSibling::Other
            };
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn layout_of(lines: &[(usize, LineRole)]) -> Vec<Placement> {
        let mut layout = Layout::default();
        lines
            .iter()
            .map(|(indent, role)| layout.place(*indent, *role))
            .collect()
    }

    fn faults(lines: &[(usize, LineRole)]) -> Vec<Option<IndentFault>> {
        layout_of(lines)
            .into_iter()
            .map(|placement| placement.fault)
            .collect()
    }

    use LineRole::{Else, If, Statement, While};

    #[test]
    fn roles_follow_the_command() {
        assert_eq!(LineRole::of(Some(Command::If)), If);
        assert_eq!(LineRole::of(Some(Command::Else)), Else);
        assert_eq!(LineRole::of(Some(Command::While)), While);
        assert_eq!(LineRole::of(Some(Command::Set)), Statement);
        assert_eq!(LineRole::of(None), Statement);
    }

    #[test]
    fn headers_open_deeper_blocks_and_dedent_closes_them() {
        let depths: Vec<usize> = layout_of(&[
            (0, While),
            (4, If),
            (6, Statement),
            (4, Else),
            (8, Statement),
            (0, Statement),
        ])
        .into_iter()
        .map(|placement| {
            assert_eq!(placement.fault, None);
            placement.depth
        })
        .collect();
        assert_eq!(depths, vec![0, 1, 2, 1, 2, 0]);
    }

    #[test]
    fn a_header_followed_by_the_same_level_has_an_empty_block() {
        assert_eq!(
            faults(&[(0, While), (0, Statement), (0, If), (0, Else)]),
            vec![None, None, None, None]
        );
    }

    #[test]
    fn first_indented_line_is_a_toplevel_fault() {
        assert_eq!(
            faults(&[(2, Statement), (2, Statement)]),
            vec![
                Some(IndentFault::Toplevel),
                Some(IndentFault::Unexpected { block_indent: 0 })
            ]
        );
    }

    #[test]
    fn deeper_line_without_header_is_unexpected_or_inconsistent() {
        assert_eq!(
            faults(&[(0, Statement), (4, Statement)]),
            vec![None, Some(IndentFault::Unexpected { block_indent: 0 })]
        );
        assert_eq!(
            faults(&[(0, While), (4, Statement), (6, Statement)]),
            vec![
                None,
                None,
                Some(IndentFault::Inconsistent { block_indent: 4 })
            ]
        );
    }

    #[test]
    fn dedent_must_land_on_an_open_level() {
        let placements = layout_of(&[(0, While), (4, Statement), (2, Statement)]);
        assert_eq!(
            placements[2].fault,
            Some(IndentFault::DedentMismatch {
                nearest: 0,
                open_levels: vec![0, 4]
            })
        );
        assert_eq!(placements[2].depth, 0);
    }

    #[test]
    fn else_needs_an_if_at_the_same_level() {
        assert_eq!(
            faults(&[(0, Else), (4, Statement)]),
            vec![Some(IndentFault::ElseWithoutIf), None]
        );
        assert_eq!(
            faults(&[(0, While), (4, Statement), (0, Else)]),
            vec![None, None, Some(IndentFault::ElseWithoutIf)]
        );
        assert_eq!(
            faults(&[(0, If), (4, Statement), (4, Else)]),
            vec![None, None, Some(IndentFault::ElseWithoutIf)]
        );
    }

    #[test]
    fn an_if_takes_at_most_one_else() {
        assert_eq!(
            faults(&[
                (0, If),
                (4, Statement),
                (0, Else),
                (4, Statement),
                (0, Else)
            ]),
            vec![None, None, None, None, Some(IndentFault::ElseWithoutIf)]
        );
    }

    #[test]
    fn else_attaches_to_the_outer_if_after_a_nested_block() {
        assert_eq!(
            faults(&[(0, If), (4, If), (8, Statement), (0, Else)]),
            vec![None, None, None, None]
        );
    }

    #[test]
    fn only_one_indentation_fault_per_line() {
        assert_eq!(
            faults(&[(0, Statement), (4, Else)]),
            vec![None, Some(IndentFault::Unexpected { block_indent: 0 })]
        );
    }
}
