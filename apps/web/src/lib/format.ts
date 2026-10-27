export const formatArea = (m2: number) => `${Math.round(m2).toLocaleString("tr-TR")} m²`;
export const formatDate = (d: string | Date) =>
  new Date(d).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export function parcelTitle(s: { ada?: string; parsel?: string; nitelik?: string }) {
  return [s.ada && s.parsel ? `${s.ada} ada ${s.parsel} parsel` : null, s.nitelik].filter(Boolean).join(" · ") || "Parsel";
}
export function parcelPlace(s: { il?: string; ilce?: string; mahalle?: string }) {
  return [s.mahalle, s.ilce, s.il].filter(Boolean).join(", ");
}
export const formatTry = (n: number) => `${n.toLocaleString("tr-TR", { maximumFractionDigits: n !== 0 && Math.abs(n) < 100 ? 2 : 0 })} ₺`;
export const formatInt = (n: number) => n.toLocaleString("tr-TR");
