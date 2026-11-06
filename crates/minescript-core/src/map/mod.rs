mod info;
mod parse;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub use info::{MapInfo, map_info};
pub use parse::{MapParseResult, parse_map, serialize_map};

pub const MIN_DIMENSION: usize = 1;
pub const MAX_DIMENSION: usize = 15;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum Cell {
    Empty,
    Gold,
    Wall,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum Dir {
    North,
    East,
    South,
    West,
}

impl Dir {
    pub const ALL: [Self; 4] = [Self::North, Self::East, Self::South, Self::West];

    #[must_use]
    pub fn turn_left(self) -> Self {
        match self {
            Self::East => Self::North,
            Self::North => Self::West,
            Self::West => Self::South,
            Self::South => Self::East,
        }
    }

    #[must_use]
    pub fn turn_left_by(self, quarter_turns: u64) -> Self {
        (0..quarter_turns % 4).fold(self, |dir, _| dir.turn_left())
    }

    pub fn delta(self) -> (i64, i64) {
        match self {
            Self::North => (-1, 0),
            Self::East => (0, 1),
            Self::South => (1, 0),
            Self::West => (0, -1),
        }
    }

    pub fn symbol(self) -> char {
        match self {
            Self::North => '^',
            Self::East => '>',
            Self::South => 'v',
            Self::West => '<',
        }
    }

    pub fn from_symbol(symbol: char) -> Option<Self> {
        Self::ALL.into_iter().find(|dir| dir.symbol() == symbol)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Pos {
    pub row: usize,
    pub col: usize,
}

impl Pos {
    pub fn new(row: usize, col: usize) -> Self {
        Self { row, col }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "MineMap")]
pub struct Map {
    pub rows: usize,
    pub cols: usize,
    pub cells: Vec<Vec<Cell>>,
    pub robot: Pos,
    pub dir: Dir,
}

impl Map {
    pub fn get(&self, pos: Pos) -> Option<Cell> {
        self.cells.get(pos.row)?.get(pos.col).copied()
    }

    pub fn set(&mut self, pos: Pos, cell: Cell) -> bool {
        match self
            .cells
            .get_mut(pos.row)
            .and_then(|row| row.get_mut(pos.col))
        {
            Some(slot) => {
                *slot = cell;
                true
            }
            None => false,
        }
    }

    pub fn in_bounds(&self, row: i64, col: i64) -> bool {
        let rows = i64::try_from(self.rows).unwrap_or(i64::MAX);
        let cols = i64::try_from(self.cols).unwrap_or(i64::MAX);
        (0..rows).contains(&row) && (0..cols).contains(&col)
    }

    pub fn forward_of(&self, pos: Pos, dir: Dir) -> Option<Pos> {
        let (delta_row, delta_col) = dir.delta();
        let row = i64::try_from(pos.row).ok()? + delta_row;
        let col = i64::try_from(pos.col).ok()? + delta_col;
        if !self.in_bounds(row, col) {
            return None;
        }
        Some(Pos::new(
            usize::try_from(row).ok()?,
            usize::try_from(col).ok()?,
        ))
    }

    pub fn is_consistent(&self) -> bool {
        (MIN_DIMENSION..=MAX_DIMENSION).contains(&self.rows)
            && (MIN_DIMENSION..=MAX_DIMENSION).contains(&self.cols)
            && self.cells.len() == self.rows
            && self.cells.iter().all(|row| row.len() == self.cols)
            && self.get(self.robot) == Some(Cell::Empty)
    }

    pub fn positions(&self) -> impl Iterator<Item = Pos> + '_ {
        (0..self.rows).flat_map(move |row| (0..self.cols).map(move |col| Pos::new(row, col)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn turning_left_goes_counter_clockwise() {
        assert_eq!(Dir::East.turn_left(), Dir::North);
        assert_eq!(Dir::North.turn_left(), Dir::West);
        assert_eq!(Dir::West.turn_left(), Dir::South);
        assert_eq!(Dir::South.turn_left(), Dir::East);
    }

    #[test]
    fn turn_left_by_uses_modulo_four() {
        assert_eq!(Dir::East.turn_left_by(0), Dir::East);
        assert_eq!(Dir::East.turn_left_by(5), Dir::North);
        assert_eq!(Dir::East.turn_left_by(u64::MAX), Dir::South);
    }

    #[test]
    fn symbols_round_trip() {
        for dir in Dir::ALL {
            assert_eq!(Dir::from_symbol(dir.symbol()), Some(dir));
        }
        assert_eq!(Dir::from_symbol('x'), None);
    }

    #[test]
    fn forward_of_stops_at_edges() {
        let map = Map {
            rows: 1,
            cols: 2,
            cells: vec![vec![Cell::Empty, Cell::Empty]],
            robot: Pos::new(0, 0),
            dir: Dir::East,
        };
        assert_eq!(
            map.forward_of(Pos::new(0, 0), Dir::East),
            Some(Pos::new(0, 1))
        );
        assert_eq!(map.forward_of(Pos::new(0, 1), Dir::East), None);
        assert_eq!(map.forward_of(Pos::new(0, 0), Dir::North), None);
        assert_eq!(map.forward_of(Pos::new(0, 0), Dir::West), None);
        assert!(map.is_consistent());
    }

    #[test]
    fn inconsistent_maps_are_detected() {
        let map = Map {
            rows: 2,
            cols: 2,
            cells: vec![vec![Cell::Empty, Cell::Empty]],
            robot: Pos::new(0, 0),
            dir: Dir::East,
        };
        assert!(!map.is_consistent());
    }
}
