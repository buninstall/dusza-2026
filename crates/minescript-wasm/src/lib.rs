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
        Err(diagnostics) => {
            let details = diagnostics
                .iter()
                .map(|diagnostic| format!("{}. sor: {}", diagnostic.span.line, diagnostic.message))
                .collect::<Vec<_>>()
                .join("; ");
            Err(JsError::new(&format!("A térkép hibás: {details}")))
        }
    }
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
