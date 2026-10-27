/** Girişten sonra dönülecek yer (?sonra=): yalnız panel içi yollar, dış adrese yönlendirme olmasın. */
export function safeNext(v: string | string[] | undefined) {
  return typeof v === "string" && /^\/panel(\/[\w-]+)*$/.test(v) ? v : undefined;
}
