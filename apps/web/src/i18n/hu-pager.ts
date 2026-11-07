export const pager = {
  label: "Lapozás",
  previous: "Előző",
  next: "Következő",
  page: (page: number) => `${page}. oldal`,
  range: (from: number, to: number, total: number) => `${from}–${to} / ${total}`,
};
