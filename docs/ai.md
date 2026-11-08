# AI-használat – 13. csapat, MineScript

Már az elején eldöntöttük, hogy a fejlesztést AI-ügynökökkel végezzük, mi pedig irányítunk, döntünk és ellenőrzünk. A kód gépelését az AI végezte, a felelősség a miénk maradt. Ezért az ellenőrzésre ugyanannyi energiát fordítottunk, mint az építésre.

A verseny kérése szerint ez a fájl a szerver home könyvtárában is megtalálható (`~/ai.md`, csapat13). A repóban ugyanez a tartalom van, és a [README](../README.md) is innen hivatkozik rá.

## Eszközök és modellek

| Eszköz                                                                                    | Verzió              | Mire                                                                    |
| ----------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------- |
| Claude Code (Anthropic), parancssor és asztali alkalmazás (Code fül)                      | 2.1.319             | minden fejlesztési munka mindhárom gépen                                |
| Claude Opus 5.5 (`claude-opus-5-5`)                                                       | –                   | fő modell: tervezés, kód, tesztek, dokumentáció, hibakeresés            |
| Claude Haiku 5.5 (`claude-haiku-5-5`)                                                     | –                   | gyors alügynökök: kódkeresés, feltérképezés                             |
| Claude Code alügynökök (code-reviewer, security-reviewer, e2e-runner, párhuzamos átnézők) | a fenti modellekkel | független átnézés: kódminőség, biztonság, tesztek, dokumentáció-egyezés |
| Claude beépített böngészője és Playwright                                                 | –                   | a futó felület kipróbálása, képernyőképek több szélességben             |

Más AI-eszközt (Copilot, ChatGPT stb.) nem használtunk. A csapat minden gépe ugyanazt a beállítást kapta: közös `CLAUDE.md` szabályfájl, szerepenkénti fájltulajdonlás (`.claude/roles/`), saját git-ág minden tagnak, automatikus commit és push.

## Mire használtuk, és mekkora részben

- **Specifikáció-elemzés:** a kiírás mondatonkénti feldolgozása, a nyitott kérdések összegyűjtése, értelmezési döntések javaslata (`docs/dontesek.md`, D1–D27).
- **Tervezés:** architektúra (egy Rust-motor, ami WASM-ként a böngészőben és a szerveren is fut), ütemterv.
- **Kód:** a Rust-motor (szintaxis, futtató, formázó, linter, szerkesztő-támogatás), a WASM-kötés, a Bun/Hono szerver MySQL-lel, a React-felület, a CLI és a lámpafény-mód.
- **Tesztek:** conformance-esetek, egy független referencia-interpreter, property- és differenciális tesztek, Playwright + axe végponttól végpontig tesztek, és a kiírás mondatonkénti ellenőrzése (`docs/megfeleles.md`).
- **Dokumentáció:** a megfelelőségi táblázat, a döntésnapló, a telepítési leírás, a README és ez a fájl.
- **Üzemeltetés:** telepítőszkript, a verseny szerver beállítása, `minescriptctl` vezérlő, CI.

A kód szinte egészét (becslésünk szerint 95% fölött) AI írta. Ami a miénk: a kiírás értelmezésével kapcsolatos döntések jóváhagyása (`docs/dontesek.md`), a prioritások, a munka irányítása és visszautasítása, a kézi tesztelés és a végső elfogadás.

## Hogyan ellenőriztük és javítottuk

1. **Szabályok előre, nem utólag.** A `CLAUDE.md` minden munkamenetben betöltődik. Rögzíti, amit az AI magától nem tartana be: a core-ban nincs `unwrap`/`panic`, és semmilyen bemenetre nem pánikol; minden felhasználói szöveg magyar; React Aria komponensek és látható fókusz; nincs CDN; verziószámot nem írhat fejből; mindenki csak a saját területét szerkesztheti; a kódban nincs komment.
2. **Előbb döntés, utána kód.** Ahol a kiírás nem egyértelmű, az AI nem dönthetett csendben. Javaslatot tett, mi elfogadtuk vagy átírtuk, a döntés azonosítót kapott, és tesztesetek kötik a kódhoz. A `docs/megfeleles.md` a kiírás minden mondatához megmutatja, hol és melyik teszttel teljesül.
3. **A teszt nem ugyanabból a fejből jön.** Ugyanazt a viselkedést három implementáció futtatja: a Rust-motor, a WASM-build és egy, csak a specifikációból írt TypeScript referencia-interpreter. Ezeket conformance-esetek és seedelt véletlen programok veti össze.
4. **Gépi kapu push előtt.** `just ci`: rustfmt, clippy `-D warnings`, Biome, typecheck, minden unit- és property-teszt, build, Playwright e2e akadálymentességi (axe) ellenőrzéssel. Ugyanez fut GitHub Actionsben is.
5. **Független átnézés.** A kész részeket párhuzamos, csak olvasó átnézőügynökök vizsgálták: frontend hibák és akadálymentesség, szerver és biztonság, a Rust-motor a kiírás ellen, a dokumentáció pontossága, a tesztek valódi lefedettsége. Minden talált hibát a gazdája javított, és regressziós teszt került mellé.
6. **Kézi ellenőrzés.** Minden pályán végigjátszottuk a kész programokat (`docs/receptek/`), valódi böngészőben és telefonon is, 320 px-től asztali szélességig. A diffeket átolvastuk, a rossz irányt visszadobtuk, és a hibát új tesztesetként rögzítettük, hogy ne jöhessen vissza.
7. **Éles üzem.** A telepítés health checkkel és automatikus visszaállással megy. Ha az AI által írt új verzió nem indul el, az élő oldal érintetlen marad.

## Öt eset, ami a legtöbbet számított

1. **Független referencia-interpreter (siker).** Az AI-val írattunk egy második interpretert TypeScriptben, kizárólag a kiírásból és a döntésekből, úgy, hogy a Rust-forrásba nem nézhetett bele. A differenciális teszt eltéréseiből több olyan pont derült ki, amit a kiírás és a döntéseink nyitva hagytak (D24), és ezek a Rust-motor valódi hibáit is felszínre hozták, például rossz térképsor-számozást és hibás hibakódot.
2. **Rekurzió a mélyen beágyazott programokon (az AI első megoldása hibás volt).** A szintaxisfát építő, lintelő és felszabadító kód rekurzív volt. Egy kb. 3000 szint mély program túlcsordította a WASM 1 MiB-os veremét, és utána minden motorhívás hibát adott az oldal újratöltéséig. A property-tesztek fogták meg; a javítás explicit veremre írta át a kritikus helyeket, és a teszt azóta is őrzi.
3. **Kétértelmű kiírás (siker, de kellett hozzá a fegyelem).** Az AI hajlamos volt egy értelmezést csendben választani és következetesen végigvinni. Ezért kértük a mondatonkénti megfelelőségi táblázatot és a döntésnaplót. A döntések D1-től D27-ig számozva vannak, és a zsűrinek szóló kérdéslista (`docs/zsuri-kerdesek.md`) ebből készült, így minden eltérés követhető.
4. **A szerver bemenetkezelése és párhuzamossága (az AI első megoldása hibás volt).** Az első szerververzióban a hibás JSON és egy magányos UTF-16 helyettesítő karakter 500-as hibát adott, tíz párhuzamos mentés pedig tíz térképverziót hozott létre egy helyett. Egy célzottan erre indított ellenőrző AI-ügynök és az általa írt tesztek mutatták meg. A javítás: méretkorlát, magyar mezőhibák, a verzióváltás egy tranzakcióban, zárolt sorokon.
5. **Reklámblokkoló (az AI hibáját csak a kézi teszt fogta meg).** Az AI úgy nevezte el a játékképernyő aranyszámlálójának modulját, hogy a reklámblokkolók szűrőlistái reklámnak vélték. A böngésző nem töltötte be (`ERR_BLOCKED_BY_CLIENT`), és ezzel az egész játékképernyő elhasalt. A gépi tesztek bővítmény nélküli böngészőben zöldek voltak, a hiba a saját böngészőnkben, kézi kipróbálásnál derült ki. Átneveztük, és azóta a kézi tesztet valódi, bővítményekkel teli böngészőben is elvégezzük.

## Amit az AI-használatról gondolunk

Az AI annyit ér, amennyit a mögötte álló ember ért: nem bemásolt chatpromptokkal, hanem ügynöki szinten dolgoztunk vele (szabályfájl, szerepek, alügynökök, gépi kapu), de minden döntést nekünk kellett megértenünk és vállalnunk, mert csak így lesz belőle gyorsítás, nem veszteség. Pozitív irányba úgy lehet terelni, ha az alapokat nem az AI helyett, hanem mellette tanuljuk meg, és minden hibából szabály vagy teszt lesz, így a rendszer munkamenetről munkamenetre jobb döntéseket hoz.
