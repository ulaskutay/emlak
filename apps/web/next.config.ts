import { resolve } from "node:path";
import type { NextConfig } from "next";

// Geliştirmede ortak .env depo kökünde; üretimde değişkenler Coolify'dan gelir.
try {
  process.loadEnvFile(resolve(import.meta.dirname, "../../.env"));
} catch {}

const config: NextConfig = {
  // Tarayıcıdaki harita (yakın nokta seçimi): Maps JavaScript anahtarı zaten istemci anahtarıdır (alan adı kısıtlı).
  env: { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY ?? "" },
  // Coolify/Docker: bağımsız çalışan sunucu çıktısı
  output: "standalone",
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  // Depo içi paketler TypeScript kaynağı olarak gelir
  transpilePackages: ["@arsa/db", "@arsa/shared", "@arsa/geo", "@arsa/providers", "@arsa/drone-studio"],
  serverExternalPackages: ["postgres", "bullmq", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
  // Depo paketleri Node standardıyla "./x.js" yazıp .ts dosyasını içe aktarır (tsx ile aynı).
  // Turbopack bu eşlemeyi yapmadığı için webpack kullanılır (next dev/build --webpack).
  webpack(cfg) {
    cfg.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return cfg;
  },
};
export default config;
