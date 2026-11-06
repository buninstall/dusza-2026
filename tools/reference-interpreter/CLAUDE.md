# tools/reference-interpreter

- Az elvárt viselkedést kizárólag a specből (`docs/feladat.md`) és a D-döntésekből (`docs/dontesek.md`) szabad levezetni, soha nem a Rust implementáció kimenetéből vagy forrásából.
- Új D-döntés csak a csapat egyetértésével kerülhet be; amíg nincs döntés, az eltérést jelezd a csapatnak, ne „javítsd” a referenciát a Rust-motorhoz.
- A típusok a `@minescript/engine` generált típusai; saját, párhuzamos típusdefiníciót ne írj.
- Minden generált eset seedből reprodukálható legyen; a hibajelentésben mindig szerepeljen a seed.
- Nulla komment (lásd a gyökér `CLAUDE.md`).
