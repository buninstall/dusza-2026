#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::hint::black_box;

use criterion::{BenchmarkId, Criterion, Throughput, criterion_group, criterion_main};
use minescript_bench::{
    Case, deep, large_broken, large_valid, messy, recipes, runtime_cases, unicode,
};
use minescript_core::{
    FormatOptions, analyze, complete, format, hover, lint, parse, parse_map, run, run_with_map_text,
};

fn sources() -> Vec<(&'static str, String)> {
    vec![
        ("spec-loop", recipes().swap_remove(1).source),
        ("nagy-banya", recipes().swap_remove(8).source),
        ("valid-2k", large_valid(2_000)),
        ("valid-20k", large_valid(20_000)),
        ("broken-2k", large_broken(2_000)),
        ("messy-2k", messy(2_000)),
        ("deep-1k", deep(1_000)),
        ("unicode-2k", unicode(1_000)),
    ]
}

fn bench_runtime(c: &mut Criterion) {
    let mut group = c.benchmark_group("run");
    let cases: Vec<Case> = recipes().into_iter().chain(runtime_cases()).collect();
    for case in &cases {
        group.bench_with_input(BenchmarkId::from_parameter(case.name), case, |b, case| {
            b.iter(|| run_with_map_text(black_box(&case.source), black_box(&case.map)));
        });
    }
    group.finish();

    let mut group = c.benchmark_group("run-prepared");
    for case in &cases {
        let map = parse_map(&case.map).map.expect("map");
        let program = parse(&case.source).program.expect("program");
        group.bench_with_input(BenchmarkId::from_parameter(case.name), &(), |b, ()| {
            b.iter(|| minescript_core::run_program(black_box(&program), black_box(&map)));
        });
    }
    group.finish();

    let mut group = c.benchmark_group("run-json");
    for case in &cases {
        let map = parse_map(&case.map).map.expect("map");
        group.bench_with_input(BenchmarkId::from_parameter(case.name), case, |b, case| {
            b.iter(|| serde_json::to_string(&run(black_box(&case.source), &map)).expect("json"));
        });
    }
    group.finish();
}

fn bench_source<F, R>(c: &mut Criterion, name: &str, work: F)
where
    F: Fn(&str) -> R,
{
    let mut group = c.benchmark_group(name);
    for (label, source) in sources() {
        group.throughput(Throughput::Bytes(source.len() as u64));
        group.bench_with_input(BenchmarkId::from_parameter(label), &source, |b, source| {
            b.iter(|| work(black_box(source)));
        });
    }
    group.finish();
}

fn bench_language(c: &mut Criterion) {
    bench_source(c, "parse", parse);
    bench_source(c, "lint", |src| match parse(src).program {
        Some(program) => lint(&program, src),
        None => Vec::new(),
    });
    bench_source(c, "analyze", analyze);
    bench_source(c, "format", |src| format(src, &FormatOptions::default()));
    bench_source(c, "complete", |src| {
        complete(src, u32::try_from(src.len() / 2).unwrap_or(0))
    });
    bench_source(c, "hover", |src| {
        hover(src, u32::try_from(src.len() / 2).unwrap_or(0))
    });
}

fn bench_maps(c: &mut Criterion) {
    let mut group = c.benchmark_group("parse-map");
    for case in recipes()
        .iter()
        .take(9)
        .skip(8)
        .chain(&runtime_cases()[..1])
    {
        group.bench_with_input(BenchmarkId::from_parameter(case.name), case, |b, case| {
            b.iter(|| parse_map(black_box(&case.map)));
        });
    }
    group.finish();
}

criterion_group!(benches, bench_runtime, bench_language, bench_maps);
criterion_main!(benches);
