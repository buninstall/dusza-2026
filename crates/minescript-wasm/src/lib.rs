use std::collections::BTreeMap;

use minescript_core::{FormatOptions, Map};
use serde::Serialize;
use serde::de::DeserializeOwned;
use wasm_bindgen::prelude::*;

fn to_js<T: Serialize>(value: &T) -> Result<JsValue, JsError> {
    value
        .serialize(&serde_wasm_bindgen::Serializer::json_compatible())
        .map_err(|error| JsError::new(&format!("Az eredmény nem alakítható át: {error}")))
}

fn from_js<T: DeserializeOwned>(value: JsValue, what: &str) -> Result<T, JsError> {
    serde_wasm_bindgen::from_value(value)
        .map_err(|error| JsError::new(&format!("Hibás bemenet ({what}): {error}")))
}

fn consistent_map(value: JsValue) -> Result<Map, JsError> {
    let map: Map = from_js(value, "térkép")?;
    if map.is_consistent() {
        Ok(map)
    } else {
        Err(JsError::new(
            "Hibás bemenet (térkép): a méretek, a cellák vagy a robot helyzete nem egyezik.",
        ))
    }
}

#[wasm_bindgen(start)]
pub fn start() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn version() -> String {
    minescript_core::VERSION.to_owned()
}

#[wasm_bindgen]
pub fn keywords() -> Vec<String> {
    minescript_core::syntax::keywords::KEYWORDS
        .iter()
        .map(|keyword| (*keyword).to_owned())
        .collect()
}

#[wasm_bindgen]
pub fn analyze(src: &str) -> Result<JsValue, JsError> {
    to_js(&minescript_core::analyze(src))
}

#[wasm_bindgen]
pub fn format(src: &str, options: JsValue) -> Result<JsValue, JsError> {
    let options: FormatOptions = if options.is_undefined() || options.is_null() {
        FormatOptions::default()
    } else {
        from_js(options, "formázási beállítások")?
    };
    to_js(&minescript_core::format(src, &options))
}

#[wasm_bindgen]
pub fn complete(src: &str, offset: u32) -> Result<JsValue, JsError> {
    to_js(&minescript_core::complete(src, offset))
}

#[wasm_bindgen]
pub fn hover(src: &str, offset: u32) -> Result<JsValue, JsError> {
    match minescript_core::hover(src, offset) {
        Some(hover) => to_js(&hover),
        None => Ok(JsValue::UNDEFINED),
    }
}

#[wasm_bindgen(js_name = parseMap)]
pub fn parse_map(text: &str) -> Result<JsValue, JsError> {
    to_js(&minescript_core::parse_map(text))
}

#[wasm_bindgen(js_name = serializeMap)]
pub fn serialize_map(map: JsValue) -> Result<String, JsError> {
    Ok(minescript_core::serialize_map(&consistent_map(map)?))
}

#[wasm_bindgen(js_name = mapInfo)]
pub fn map_info(map: JsValue) -> Result<JsValue, JsError> {
    to_js(&minescript_core::map_info(&consistent_map(map)?))
}

#[wasm_bindgen]
pub fn run(src: &str, map_text: &str) -> Result<JsValue, JsError> {
    match minescript_core::run_with_map_text(src, map_text) {
        Ok(result) => to_js(&result),
        Err(diagnostics) => Err(map_error(&diagnostics)),
    }
}

fn map_error(diagnostics: &[minescript_core::Diagnostic]) -> JsError {
    let details = diagnostics
        .iter()
        .map(|diagnostic| format!("{}. sor: {}", diagnostic.span.line, diagnostic.message))
        .collect::<Vec<_>>()
        .join("; ");
    JsError::new(&format!("A térkép hibás: {details}"))
}

#[wasm_bindgen(js_name = astDump)]
pub fn ast_dump(src: &str) -> Result<String, JsError> {
    let parsed = minescript_core::parse(src);
    let value = serde_json_compatible(&parsed)?;
    Ok(value)
}

fn serde_json_compatible<T: Serialize>(value: &T) -> Result<String, JsError> {
    let js = to_js(value)?;
    js_sys_stringify(&js)
}

fn js_sys_stringify(value: &JsValue) -> Result<String, JsError> {
    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen(js_namespace = JSON, js_name = stringify, catch)]
        fn json_stringify(
            value: &JsValue,
            replacer: &JsValue,
            space: u32,
        ) -> Result<JsValue, JsValue>;
    }
    json_stringify(value, &JsValue::NULL, 2)
        .ok()
        .and_then(|text| text.as_string())
        .ok_or_else(|| JsError::new("Az AST nem alakítható szöveggé."))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RunSummary<'a> {
    outcome: &'a minescript_core::Outcome,
    gold: u32,
    steps: u32,
    console: &'a [String],
    final_robot: &'a minescript_core::RobotState,
    discovered: &'a [minescript_core::Pos],
    names: Vec<&'a str>,
}

#[wasm_bindgen]
pub struct PackedRun {
    summary: JsValue,
    events: Vec<f64>,
}

#[wasm_bindgen]
impl PackedRun {
    #[wasm_bindgen(getter)]
    pub fn summary(&self) -> JsValue {
        self.summary.clone()
    }

    #[wasm_bindgen(js_name = takeEvents)]
    pub fn take_events(&mut self) -> Vec<f64> {
        std::mem::take(&mut self.events)
    }
}

const MINED: u8 = 1;
const PRINTED: u8 = 2;
const ASSIGNED: u8 = 4;

fn dir_code(dir: minescript_core::Dir) -> f64 {
    match dir {
        minescript_core::Dir::North => 0.0,
        minescript_core::Dir::East => 1.0,
        minescript_core::Dir::South => 2.0,
        minescript_core::Dir::West => 3.0,
    }
}

#[allow(clippy::cast_precision_loss)]
fn number(value: usize) -> f64 {
    value as f64
}

#[allow(clippy::cast_precision_loss)]
fn value_parts(value: minescript_core::Value) -> (f64, f64) {
    match value {
        minescript_core::Value::Int(int) => (0.0, int as f64),
        minescript_core::Value::Bool(flag) => (1.0, f64::from(u8::from(flag))),
    }
}

fn push_positions(out: &mut Vec<f64>, cells: &[minescript_core::Pos]) {
    out.push(number(cells.len()));
    for cell in cells {
        out.push(number(cell.row));
        out.push(number(cell.col));
    }
}

fn pack_run(result: &minescript_core::RunResult) -> Result<PackedRun, JsError> {
    let mut names: Vec<&str> = Vec::new();
    let mut slots: BTreeMap<&str, usize> = BTreeMap::new();
    let mut events = Vec::with_capacity(result.events.len() * 12);
    for event in &result.events {
        let flags = [
            (event.mined.is_some(), MINED),
            (event.print.is_some(), PRINTED),
            (event.assigned.is_some(), ASSIGNED),
        ]
        .into_iter()
        .filter(|(present, _)| *present)
        .fold(0, |flags, (_, bit)| flags | bit);
        events.extend([
            f64::from(event.index),
            f64::from(event.line),
            number(event.robot.pos.row),
            number(event.robot.pos.col),
            dir_code(event.robot.dir),
            f64::from(event.gold),
            f64::from(event.steps),
            f64::from(flags),
        ]);
        push_positions(&mut events, &event.path);
        push_positions(&mut events, &event.discovered);
        if let Some(mined) = event.mined {
            events.extend([number(mined.row), number(mined.col)]);
        }
        if let Some(assigned) = &event.assigned {
            let name = assigned.name.as_str();
            let next = names.len();
            let slot = *slots.entry(name).or_insert(next);
            if slot == next {
                names.push(name);
            }
            let (kind, value) = value_parts(assigned.value);
            events.extend([number(slot), kind, value]);
        }
    }
    let summary = to_js(&RunSummary {
        outcome: &result.outcome,
        gold: result.gold,
        steps: result.steps,
        console: &result.console,
        final_robot: &result.final_robot,
        discovered: &result.discovered,
        names,
    })?;
    Ok(PackedRun { summary, events })
}

#[wasm_bindgen(js_name = runPacked)]
pub fn run_packed(src: &str, map_text: &str) -> Result<PackedRun, JsError> {
    match minescript_core::run_with_map_text(src, map_text) {
        Ok(result) => pack_run(&result),
        Err(diagnostics) => Err(map_error(&diagnostics)),
    }
}

#[derive(Serialize)]
struct AnalysisSummary<'a> {
    diagnostics: &'a [minescript_core::Diagnostic],
    folds: &'a [minescript_core::FoldRange],
    symbols: &'a [minescript_core::Symbol],
}

#[wasm_bindgen]
pub struct PackedAnalysis {
    summary: JsValue,
    tokens: Vec<u32>,
}

#[wasm_bindgen]
impl PackedAnalysis {
    #[wasm_bindgen(getter)]
    pub fn summary(&self) -> JsValue {
        self.summary.clone()
    }

    #[wasm_bindgen(js_name = takeTokens)]
    pub fn take_tokens(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.tokens)
    }
}

fn token_kind_code(kind: minescript_core::SemanticTokenKind) -> u32 {
    match kind {
        minescript_core::SemanticTokenKind::Keyword => 0,
        minescript_core::SemanticTokenKind::Number => 1,
        minescript_core::SemanticTokenKind::Bool => 2,
        minescript_core::SemanticTokenKind::Operator => 3,
        minescript_core::SemanticTokenKind::Variable => 4,
        minescript_core::SemanticTokenKind::Invalid => 5,
    }
}

#[wasm_bindgen(js_name = analyzePacked)]
pub fn analyze_packed(src: &str) -> Result<PackedAnalysis, JsError> {
    let analysis = minescript_core::analyze(src);
    let mut tokens = Vec::with_capacity(analysis.tokens.len() * 3);
    for token in &analysis.tokens {
        tokens.extend([token.from, token.to, token_kind_code(token.kind)]);
    }
    let summary = to_js(&AnalysisSummary {
        diagnostics: &analysis.diagnostics,
        folds: &analysis.folds,
        symbols: &analysis.symbols,
    })?;
    Ok(PackedAnalysis { summary, tokens })
}
