use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::map::{Cell, Dir, Map, Pos};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RobotState {
    pub pos: Pos,
    pub dir: Dir,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StepResult {
    pub state: RobotState,
    pub path: Vec<Pos>,
    pub blocked: bool,
}

impl RobotState {
    pub fn start_of(map: &Map) -> Self {
        Self {
            pos: map.robot,
            dir: map.dir,
        }
    }

    #[must_use]
    pub fn turned_left(self, quarter_turns: u64) -> Self {
        Self {
            dir: self.dir.turn_left_by(quarter_turns),
            ..self
        }
    }

    pub fn step_forward(self, map: &Map, count: u64) -> StepResult {
        let mut state = self;
        let mut path = Vec::new();
        for _ in 0..count {
            let next = map
                .forward_of(state.pos, state.dir)
                .filter(|pos| map.get(*pos) != Some(Cell::Wall));
            let Some(next) = next else {
                return StepResult {
                    state,
                    path,
                    blocked: true,
                };
            };
            state.pos = next;
            path.push(next);
        }
        StepResult {
            state,
            path,
            blocked: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::map::parse_map;

    fn map(text: &str) -> Map {
        parse_map(text).map.unwrap()
    }

    #[test]
    fn steps_until_wall_and_keeps_last_valid_cell() {
        let map = map("1 3\n>.#");
        let result = RobotState::start_of(&map).step_forward(&map, 2);
        assert!(result.blocked);
        assert_eq!(result.state.pos, Pos::new(0, 1));
        assert_eq!(result.path, vec![Pos::new(0, 1)]);
    }

    #[test]
    fn leaving_the_map_is_blocked() {
        let map = map("1 2\n.<");
        let result = RobotState::start_of(&map).step_forward(&map, 2);
        assert!(result.blocked);
        assert_eq!(result.state.pos, Pos::new(0, 0));
    }

    #[test]
    fn zero_steps_do_not_move() {
        let map = map("1 1\n>");
        let result = RobotState::start_of(&map).step_forward(&map, 0);
        assert!(!result.blocked);
        assert!(result.path.is_empty());
    }

    #[test]
    fn huge_step_count_terminates() {
        let map = map("1 3\n>..");
        let result = RobotState::start_of(&map).step_forward(&map, u64::MAX);
        assert!(result.blocked);
        assert_eq!(result.state.pos, Pos::new(0, 2));
    }

    #[test]
    fn walks_over_gold_without_mining() {
        let map = map("1 3\n>@.");
        let result = RobotState::start_of(&map).step_forward(&map, 2);
        assert!(!result.blocked);
        assert_eq!(result.path, vec![Pos::new(0, 1), Pos::new(0, 2)]);
        assert_eq!(map.get(Pos::new(0, 1)), Some(Cell::Gold));
    }

    #[test]
    fn turning_keeps_position() {
        let map = map("1 1\n>");
        let turned = RobotState::start_of(&map).turned_left(5);
        assert_eq!(turned.dir, Dir::North);
        assert_eq!(turned.pos, Pos::new(0, 0));
    }
}
