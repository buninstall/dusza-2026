use std::collections::VecDeque;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::{Cell, Dir, Map, Pos};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct MapInfo {
    pub gold_total: u32,
    pub reachable_gold: u32,
    pub unreachable: Vec<Pos>,
}

pub fn map_info(map: &Map) -> MapInfo {
    let reachable = reachable_cells(map);
    let gold: Vec<Pos> = map
        .positions()
        .filter(|pos| map.get(*pos) == Some(Cell::Gold))
        .collect();
    let unreachable: Vec<Pos> = gold
        .iter()
        .copied()
        .filter(|pos| !is_marked(&reachable, *pos))
        .collect();
    let gold_total = u32::try_from(gold.len()).unwrap_or(u32::MAX);
    let unreachable_count = u32::try_from(unreachable.len()).unwrap_or(u32::MAX);
    MapInfo {
        gold_total,
        reachable_gold: gold_total.saturating_sub(unreachable_count),
        unreachable,
    }
}

fn is_marked(marks: &[Vec<bool>], pos: Pos) -> bool {
    marks
        .get(pos.row)
        .and_then(|row| row.get(pos.col))
        .copied()
        .unwrap_or(false)
}

fn mark(marks: &mut [Vec<bool>], pos: Pos) -> bool {
    match marks.get_mut(pos.row).and_then(|row| row.get_mut(pos.col)) {
        Some(slot) if !*slot => {
            *slot = true;
            true
        }
        _ => false,
    }
}

fn reachable_cells(map: &Map) -> Vec<Vec<bool>> {
    let mut marks = vec![vec![false; map.cols]; map.rows];
    let mut queue = VecDeque::new();
    if map.get(map.robot).is_some_and(|cell| cell != Cell::Wall) && mark(&mut marks, map.robot) {
        queue.push_back(map.robot);
    }
    while let Some(pos) = queue.pop_front() {
        for dir in Dir::ALL {
            let Some(next) = map.forward_of(pos, dir) else {
                continue;
            };
            if map.get(next) != Some(Cell::Wall) && mark(&mut marks, next) {
                queue.push_back(next);
            }
        }
    }
    marks
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::map::parse_map;

    #[test]
    fn spec_example_has_two_reachable_gold() {
        let map = parse_map("3 15\n....@..........\n.#############.\n.......@...>...\n")
            .map
            .unwrap();
        let info = map_info(&map);
        assert_eq!(info.gold_total, 2);
        assert_eq!(info.reachable_gold, 2);
        assert!(info.unreachable.is_empty());
    }

    #[test]
    fn walled_gold_is_unreachable() {
        let map = parse_map("1 3\n>#@\n").map.unwrap();
        let info = map_info(&map);
        assert_eq!(info.gold_total, 1);
        assert_eq!(info.reachable_gold, 0);
        assert_eq!(info.unreachable, vec![Pos::new(0, 2)]);
    }
}
