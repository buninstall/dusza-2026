# conformance/

- Az elvárt értékeket kizárólag a specből (`docs/feladat.md`) és a D-döntésekből (`docs/dontesek.md`) szabad levezetni, soha nem a Rust implementáció kimenetéből. Ha egy eset piros, előbb a specet és a döntést ellenőrizd, és csak utána a kódot.
- Új D-döntés csak a csapat egyetértésével kerülhet be; az esetet a döntés azonosítójával jelöld (`decisions`).
- A fájlok bájtpontosak. Ne futtass rajtuk formázót; a CRLF-es esetek neve tartalmazza a `crlf` szót.
- Új eset: új könyvtár a következő sorszámmal, frissítsd a `docs/tesztterv.md` mátrixát.
- A formátum leírása: `conformance/README.md`.
- Nulla komment (lásd a gyökér `CLAUDE.md`).
