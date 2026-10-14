export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} ortam değişkeni eksik (.env dosyasına bakın)`);
  return v;
}

export const intEnv = (name: string, fallback: number) => {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : Number.parseInt(v, 10);
};
