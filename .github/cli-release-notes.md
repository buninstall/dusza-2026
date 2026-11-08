A MineScript-interpreter önálló parancssori program: ugyanaz a Rust-motor fut benne, mint a webes játékban és a szerveren, így a futás eredménye (arany, feldolgozott sorok, hibakód, hibás sor) bájtra megegyezik a ranglistáéval. Internet és telepítés nem kell hozzá.

## Letöltés

| Rendszer              | Fájl                             |
| --------------------- | -------------------------------- |
| Windows (x64)         | `minescript-cli-windows-x64.exe` |
| Linux (x64)           | `minescript-cli-linux-x64`       |
| macOS (Apple Silicon) | `minescript-cli-macos-arm64`     |
| macOS (Intel)         | `minescript-cli-macos-x64`       |

Az ellenőrzőösszegek a `SHA256SUMS.txt` fájlban vannak. Linuxon és macOS-en előbb futtathatóvá kell tenni: `chmod +x minescript-cli-*`. macOS-en az első indításkor a Finderben jobb gomb, majd Megnyitás. A lenti példák kedvéért érdemes a letöltött fájlt `minescript`-re (Windowson `minescript.exe`-re) átnevezni.

## Használat

| Parancs                                             | Mit csinál                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `minescript run --map palya.txt program.ms`         | lefuttatja a programot a térképen, kiírja a konzol kimenetét, az aranyat és a feldolgozott sorok számát |
| `minescript run --map palya.txt program.ms --trace` | minden feldolgozott sort kiír a robot helyzetével                                                       |
| `minescript run --map palya.txt program.ms --json`  | a teljes eredmény JSON-ként                                                                             |
| `minescript check program.ms`                       | szintaktikai ellenőrzés, a hibás sorok megjelölésével                                                   |
| `minescript lint program.ms`                        | ellenőrzés és figyelmeztetések                                                                          |
| `minescript fmt program.ms --write`                 | formázás a fájlba visszaírva                                                                            |
| `minescript map-check palya.txt`                    | térképfájl ellenőrzése                                                                                  |

A kilépési kód 0, ha minden rendben van, 1 szintaktikai vagy futásidejű hibánál, 2 hibás parancssornál vagy olvashatatlan fájlnál. A nyelv és a fájlformátumok leírása a repó `docs/feladat.md` és `docs/dontesek.md` fájljában, a játékon belül pedig a Kézikönyvben olvasható.
