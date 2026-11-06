use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::{Cell, Dir, MAX_DIMENSION, MIN_DIMENSION, Map, Pos, map_info};
use crate::diagnostics::{DiagCode, Diagnostic, has_errors, messages};
use crate::source::{LineIndex, normalize, split_lines};
use crate::span::Span;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct MapParseResult {
    pub map: Option<Map>,
    pub diagnostics: Vec<Diagnostic>,
}

const HEADER_LINE: u32 = 1;
const FIRST_ROW_LINE: u32 = 2;

struct RobotMark {
    pos: Pos,
    dir: Dir,
    span: Span,
}

pub fn parse_map(text: &str) -> MapParseResult {
    let normalized = normalize(text);
    let index = LineIndex::new(&normalized);
    let lines = split_lines(&normalized);
    let Some((header, row_lines)) = lines.split_first() else {
        return MapParseResult {
            map: None,
            diagnostics: vec![Diagnostic::new(DiagCode::MapEmpty, Span::default())],
        };
    };
    let (rows, cols) = match parse_header(header, &index) {
        Ok(size) => size,
        Err(diagnostic) => {
            return MapParseResult {
                map: None,
                diagnostics: vec![diagnostic],
            };
        }
    };

    let mut diagnostics = Vec::new();
    let mut cells = Vec::with_capacity(rows);
    let mut robots = Vec::new();
    for (row, (row_text, line)) in row_lines
        .iter()
        .zip(FIRST_ROW_LINE..)
        .take(rows)
        .enumerate()
    {
        cells.push(parse_row(
            &RowContext {
                index: &index,
                text: row_text,
                line,
                row,
                cols,
            },
            &mut robots,
            &mut diagnostics,
        ));
    }

    if row_lines.len() != rows {
        let span = if row_lines.len() > rows {
            let first_extra = u32::try_from(rows).unwrap_or(u32::MAX) + FIRST_ROW_LINE;
            Span::whole_line(&index, first_extra)
        } else {
            Span::whole_line(&index, HEADER_LINE)
        };
        diagnostics.push(
            Diagnostic::new(DiagCode::MapRowCount, span)
                .with_message(messages::row_count(rows, row_lines.len())),
        );
    }

    let robot = robots.first().map(|mark| (mark.pos, mark.dir));
    if robots.is_empty() {
        diagnostics.push(Diagnostic::new(
            DiagCode::MapNoRobot,
            Span::whole_line(&index, HEADER_LINE),
        ));
    }
    for extra in robots.iter().skip(1) {
        diagnostics.push(Diagnostic::new(DiagCode::MapMultipleRobots, extra.span));
    }

    let (Some((robot, dir)), false) = (robot, has_errors(&diagnostics)) else {
        return MapParseResult {
            map: None,
            diagnostics,
        };
    };

    let map = Map {
        rows,
        cols,
        cells,
        robot,
        dir,
    };
    diagnostics.extend(map_warnings(&map, &index));
    MapParseResult {
        map: Some(map),
        diagnostics,
    }
}

pub fn serialize_map(map: &Map) -> String {
    let mut out = format!("{} {}\n", map.rows, map.cols);
    for row in 0..map.rows {
        for col in 0..map.cols {
            let pos = Pos::new(row, col);
            let symbol = if pos == map.robot {
                map.dir.symbol()
            } else {
                match map.get(pos) {
                    Some(Cell::Gold) => '@',
                    Some(Cell::Wall) => '#',
                    Some(Cell::Empty) | None => '.',
                }
            };
            out.push(symbol);
        }
        out.push('\n');
    }
    out
}

fn parse_header(header: &str, index: &LineIndex<'_>) -> Result<(usize, usize), Diagnostic> {
    let header_error =
        || Diagnostic::new(DiagCode::MapHeader, Span::whole_line(index, HEADER_LINE));
    let (rows_text, cols_text) = header.split_once(' ').ok_or_else(header_error)?;
    let is_number = |text: &str| !text.is_empty() && text.bytes().all(|b| b.is_ascii_digit());
    if !is_number(rows_text) || !is_number(cols_text) {
        return Err(header_error());
    }
    let dimension = |text: &str| {
        text.parse::<usize>()
            .ok()
            .filter(|value| (MIN_DIMENSION..=MAX_DIMENSION).contains(value))
    };
    match (dimension(rows_text), dimension(cols_text)) {
        (Some(rows), Some(cols)) => Ok((rows, cols)),
        _ => Err(
            Diagnostic::new(DiagCode::MapDimRange, Span::whole_line(index, HEADER_LINE))
                .with_message(messages::dim_range(rows_text, cols_text)),
        ),
    }
}

struct RowContext<'a, 'b> {
    index: &'a LineIndex<'b>,
    text: &'a str,
    line: u32,
    row: usize,
    cols: usize,
}

fn parse_row(
    context: &RowContext<'_, '_>,
    robots: &mut Vec<RobotMark>,
    diagnostics: &mut Vec<Diagnostic>,
) -> Vec<Cell> {
    let length = context.text.chars().count();
    if length != context.cols {
        diagnostics.push(
            Diagnostic::new(
                DiagCode::MapRowLength,
                Span::whole_line(context.index, context.line),
            )
            .with_message(messages::row_length(context.cols, length)),
        );
    }
    let mut cells = Vec::with_capacity(context.cols);
    for (col, (byte, symbol)) in context.text.char_indices().enumerate() {
        let span = Span::in_line(context.index, context.line, byte, byte + symbol.len_utf8());
        let cell = match symbol {
            '.' => Cell::Empty,
            '@' => Cell::Gold,
            '#' => Cell::Wall,
            other => {
                if let Some(dir) = Dir::from_symbol(other) {
                    robots.push(RobotMark {
                        pos: Pos::new(context.row, col),
                        dir,
                        span,
                    });
                } else {
                    diagnostics.push(
                        Diagnostic::new(DiagCode::MapBadSymbol, span)
                            .with_message(messages::bad_symbol(other)),
                    );
                }
                Cell::Empty
            }
        };
        cells.push(cell);
    }
    cells
}

fn cell_span(index: &LineIndex<'_>, pos: Pos) -> Span {
    let line = u32::try_from(pos.row)
        .unwrap_or(u32::MAX)
        .saturating_add(FIRST_ROW_LINE);
    Span::in_line(index, line, pos.col, pos.col + 1)
}

fn map_warnings(map: &Map, index: &LineIndex<'_>) -> Vec<Diagnostic> {
    let info = map_info(map);
    let mut warnings = Vec::new();
    if info.gold_total == 0 {
        warnings.push(Diagnostic::new(
            DiagCode::MapNoGold,
            Span::whole_line(index, HEADER_LINE),
        ));
    }
    warnings.extend(
        info.unreachable
            .iter()
            .map(|pos| Diagnostic::new(DiagCode::MapUnreachableGold, cell_span(index, *pos))),
    );
    warnings
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    const SPEC_EXAMPLE: &str = "3 15\n....@..........\n.#############.\n.......@...>...\n";

    fn codes(result: &MapParseResult) -> Vec<(DiagCode, u32)> {
        result
            .diagnostics
            .iter()
            .map(|diagnostic| (diagnostic.code, diagnostic.span.line))
            .collect()
    }

    #[test]
    fn parses_spec_example() {
        let result = parse_map(SPEC_EXAMPLE);
        let map = result.map.expect("valid map");
        assert!(result.diagnostics.is_empty());
        assert_eq!((map.rows, map.cols), (3, 15));
        assert_eq!(map.robot, Pos::new(2, 11));
        assert_eq!(map.dir, Dir::East);
        assert_eq!(map.get(Pos::new(0, 4)), Some(Cell::Gold));
        assert_eq!(map.get(Pos::new(1, 1)), Some(Cell::Wall));
        assert_eq!(map.get(map.robot), Some(Cell::Empty));
    }

    #[test]
    fn accepts_crlf_and_bom() {
        let crlf = format!("\u{feff}{}", SPEC_EXAMPLE.replace('\n', "\r\n"));
        assert_eq!(parse_map(&crlf).map, parse_map(SPEC_EXAMPLE).map);
    }

    #[test]
    fn accepts_missing_trailing_newline() {
        assert!(parse_map("1 1\n>").map.is_some());
    }

    #[test]
    fn empty_file_is_an_error() {
        let result = parse_map("");
        assert!(result.map.is_none());
        assert_eq!(result.diagnostics[0].code, DiagCode::MapEmpty);
    }

    #[test]
    fn reports_missing_robot() {
        assert_eq!(codes(&parse_map("1 1\n.")), vec![(DiagCode::MapNoRobot, 1)]);
    }

    #[test]
    fn reports_extra_robots() {
        assert_eq!(
            codes(&parse_map("1 2\n><")),
            vec![(DiagCode::MapMultipleRobots, 2)]
        );
    }

    #[test]
    fn reports_short_row_on_its_line() {
        assert_eq!(
            codes(&parse_map("2 3\n>..\n..")),
            vec![(DiagCode::MapRowLength, 3)]
        );
    }

    #[test]
    fn reports_dimension_range() {
        assert_eq!(codes(&parse_map("0 1\n")), vec![(DiagCode::MapDimRange, 1)]);
        assert_eq!(
            codes(&parse_map("1 16\n>...............")),
            vec![(DiagCode::MapDimRange, 1)]
        );
        assert_eq!(
            codes(&parse_map("99999999999999999999999 1\n>")),
            vec![(DiagCode::MapDimRange, 1)]
        );
    }

    #[test]
    fn reports_bad_symbol_with_column() {
        let result = parse_map("1 2\n>x");
        assert_eq!(codes(&result), vec![(DiagCode::MapBadSymbol, 2)]);
        assert_eq!(result.diagnostics[0].span.col_start, 2);
    }

    #[test]
    fn reports_malformed_header() {
        assert_eq!(
            codes(&parse_map("1  2\n>.")),
            vec![(DiagCode::MapHeader, 1)]
        );
        assert_eq!(codes(&parse_map("1x2\n>.")), vec![(DiagCode::MapHeader, 1)]);
        assert_eq!(
            codes(&parse_map("1 2 \n>.")),
            vec![(DiagCode::MapHeader, 1)]
        );
    }

    #[test]
    fn reports_row_count() {
        assert_eq!(
            codes(&parse_map("2 2\n>.\n..\n..")),
            vec![(DiagCode::MapRowCount, 4)]
        );
        assert_eq!(
            codes(&parse_map("2 2\n>.")),
            vec![(DiagCode::MapRowCount, 1)]
        );
    }

    #[test]
    fn lone_carriage_return_is_a_bad_symbol() {
        assert_eq!(
            codes(&parse_map("1 2\n>\r")),
            vec![(DiagCode::MapBadSymbol, 2)]
        );
    }

    #[test]
    fn unreachable_gold_is_only_a_warning() {
        let result = parse_map("1 3\n>#@");
        assert!(result.map.is_some());
        assert_eq!(codes(&result), vec![(DiagCode::MapUnreachableGold, 2)]);
        assert!(!has_errors(&result.diagnostics));
    }

    #[test]
    fn map_without_gold_is_only_a_warning() {
        let result = parse_map("1 1\n>");
        assert!(result.map.is_some());
        assert_eq!(codes(&result), vec![(DiagCode::MapNoGold, 1)]);
    }

    #[test]
    fn serializes_spec_example_back() {
        let map = parse_map(SPEC_EXAMPLE).map.unwrap();
        assert_eq!(serialize_map(&map), SPEC_EXAMPLE);
    }

    fn arb_cell() -> impl Strategy<Value = Cell> {
        prop_oneof![Just(Cell::Empty), Just(Cell::Gold), Just(Cell::Wall)]
    }

    fn arb_dir() -> impl Strategy<Value = Dir> {
        prop_oneof![
            Just(Dir::North),
            Just(Dir::East),
            Just(Dir::South),
            Just(Dir::West)
        ]
    }

    fn arb_map() -> impl Strategy<Value = Map> {
        (1usize..=15, 1usize..=15)
            .prop_flat_map(|(rows, cols)| {
                (
                    Just(rows),
                    Just(cols),
                    proptest::collection::vec(proptest::collection::vec(arb_cell(), cols), rows),
                    0..rows,
                    0..cols,
                    arb_dir(),
                )
            })
            .prop_map(|(rows, cols, mut cells, robot_row, robot_col, dir)| {
                cells[robot_row][robot_col] = Cell::Empty;
                Map {
                    rows,
                    cols,
                    cells,
                    robot: Pos::new(robot_row, robot_col),
                    dir,
                }
            })
    }

    proptest! {
        #[test]
        fn serialize_then_parse_round_trips(map in arb_map()) {
            let text = serialize_map(&map);
            let parsed = parse_map(&text);
            prop_assert_eq!(parsed.map, Some(map));
        }

        #[test]
        fn parse_map_never_panics(text in "\\PC*") {
            let _ = parse_map(&text);
        }
    }
}
