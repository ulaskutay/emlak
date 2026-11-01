/**
 * Ada / parsel numaraları. Birden çok parselde TKGM alanları virgülle birleşir:
 * aynı adada Ada "230", ParselNo "3, 4"; farklı adalarda ikisi de aynı uzunlukta sıralı liste ("230, 231" / "3, 7").
 */
export function parcelPairs(ada?: string, parsel?: string): { ada: string; parsel: string }[] {
  const split = (v?: string) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const adas = split(ada);
  const parsels = split(parsel);
  if (!adas.length || !parsels.length) return [];
  if (adas.length === 1) return parsels.map((p) => ({ ada: adas[0]!, parsel: p }));
  return parsels.map((p, i) => ({ ada: adas[i] ?? adas[adas.length - 1]!, parsel: p }));
}

/** "a, b ve c" */
export const joinAnd = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} ve ${xs[xs.length - 1]}`);

/** "230 ada 3 parsel", "230 ada 3 ve 4 parsel", "230 ada 3 ve 231 ada 7 parsel"; numara yoksa null. */
export function parcelNoText(ada?: string, parsel?: string, num: (v: string) => string = (v) => v): string | null {
  const pairs = parcelPairs(ada, parsel);
  if (!pairs.length) return null;
  const adas = [...new Set(pairs.map((p) => p.ada))];
  if (adas.length === 1) return `${num(adas[0]!)} ada ${joinAnd(pairs.map((p) => num(p.parsel)))} parsel`;
  return `${joinAnd(pairs.map((p) => `${num(p.ada)} ada ${num(p.parsel)}`))} parsel`;
}

/** Kısa gösterim (özellik kutucuğu): "230 / 3", "230 / 3, 4", "230/3, 231/7". */
export function parcelNoShort(ada?: string, parsel?: string): string | null {
  const pairs = parcelPairs(ada, parsel);
  if (!pairs.length) return null;
  const adas = [...new Set(pairs.map((p) => p.ada))];
  if (adas.length === 1) return `${adas[0]} / ${pairs.map((p) => p.parsel).join(", ")}`;
  return pairs.map((p) => `${p.ada}/${p.parsel}`).join(", ");
}
