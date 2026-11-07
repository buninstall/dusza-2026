export const browse = {
  scopeFavorites: "Kedvencek",
  searchLabel: "Keresés a pályák között",
  searchPlaceholder: "Cím, készítő vagy leírás",
  searchClear: "Keresés törlése",
  popular: "Népszerű",
  emptyFavorites: "Még nincs kedvenc pályád. A szív gombbal teheted el, amit újra játszanál.",
  noSearchMatch: (q: string) =>
    `Nincs pálya erre: „${q}”. Próbálj rövidebb szót, vagy nézd meg az összes pályát.`,
  pageLabel: (page: number, pageCount: number) => `Oldal: ${page} / ${pageCount}`,
  range: (from: number, to: number, total: number) => `${from}–${to} / ${total} pálya`,
  loading: "Töltöm a következő pályákat…",
  pageAnnounce: (page: number, pageCount: number, total: number) =>
    `${page}. oldal, összesen ${pageCount} oldal és ${total} pálya.`,
  favorite: "Kedvenc",
  favoriteAdd: (title: string) => `Kedvencekhez: ${title}`,
  favoriteRemove: (title: string) => `Levétel a kedvencek közül: ${title}`,
  favoriteCount: (count: number) => `${count} kedvenc`,
  favoriteAdded: (title: string) => `${title} a kedvencek közé került.`,
  favoriteRemoved: (title: string) => `${title} lekerült a kedvencek közül.`,
  favoriteFailed: "A kedvencet nem sikerült menteni. Próbáld újra.",
};

export const library = {
  searchLabel: "Keresés a programok között",
  searchPlaceholder: "Cím vagy programsor",
  sortLabel: "Rendezés",
  sorts: { recent: "Legutóbb módosított", title: "Cím szerint" },
  lines: (lines: number) => `${lines} sor`,
  noMatch: (q: string) => `Nincs program erre: „${q}”.`,
  quota: (used: number, limit: number) => `${used} / ${limit} program a tárban`,
  range: (from: number, to: number, total: number) => `${from}–${to} / ${total} program`,
  listLabel: "Mentett programok",
};
