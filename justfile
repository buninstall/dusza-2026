set windows-shell := ["powershell.exe", "-NoLogo", "-Command"]

default:
    @just --list

setup *flags:
    bun scripts/setup.ts {{flags}}

wasm:
    bun scripts/build-wasm.ts

types:
    bun scripts/gen-types.ts

dev:
    bun scripts/dev.ts

db-up:
    docker compose up -d --wait mysql

db-down:
    docker compose down

db-setup *flags:
    bun scripts/db-setup.ts {{flags}}

test:
    cargo test --workspace
    bun run --filter '@minescript/engine' test
    bun run --filter '@minescript/reference' test
    bun run --filter '@minescript/server' test
    bun run --filter '@minescript/web' test

conformance:
    bun scripts/conformance.ts

lint:
    cargo fmt --all --check
    cargo clippy --workspace --all-targets -- -D warnings
    bunx biome ci .
    bun run --filter '*' typecheck

fmt:
    cargo fmt --all
    bunx biome check --write .

build: wasm
    bun run --filter '@minescript/web' build
    bun scripts/gen-static-manifest.ts
    bun scripts/gen-migrations.ts

release: build
    bun scripts/release.ts

start:
    bun run --filter '@minescript/server' start

smoke:
    bun scripts/smoke.ts

deploy *flags:
    bun scripts/remote.ts deploy {{flags}}

remote +args:
    bun scripts/remote.ts {{args}}

e2e: build
    bun run --filter '@minescript/e2e' e2e

ci: lint test build e2e

clean:
    cargo clean
    bun scripts/clean.ts
