use minescript_core::ast::Program;
use minescript_core::syntax::token::Token;
use minescript_core::{
    Analysis, CompletionItem, FormatOptions, FormatResult, Hover, Map, MapInfo, MapParseResult,
    ParseResult, RunResult,
};
use ts_rs::{Config, ExportError, TS};

fn export_all() -> Result<(), ExportError> {
    let config = Config::from_env();
    Analysis::export_all(&config)?;
    CompletionItem::export_all(&config)?;
    FormatOptions::export_all(&config)?;
    FormatResult::export_all(&config)?;
    Hover::export_all(&config)?;
    Map::export_all(&config)?;
    MapInfo::export_all(&config)?;
    MapParseResult::export_all(&config)?;
    ParseResult::export_all(&config)?;
    Program::export_all(&config)?;
    RunResult::export_all(&config)?;
    Token::export_all(&config)?;
    Ok(())
}

#[test]
#[ignore = "a just types parancs futtatja"]
fn export_bindings() -> Result<(), ExportError> {
    export_all()
}
