/**
 * Cloudflare R2 (S3 uyumlu): üretilen videolar ve ses örnekleri. Bucket gizli; okuma imzalı linkle.
 */
import { readFile } from "node:fs/promises";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Bucket'a bağlı genel alan adı varsa imzasız link (ör. https://cdn.ornek.com). */
  publicBaseUrl?: string;
}

export function r2FromEnv(env: NodeJS.ProcessEnv = process.env): R2 | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  return new R2({
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    publicBaseUrl: R2_PUBLIC_BASE_URL || undefined,
  });
}

export class R2 {
  private readonly s3: S3Client;

  constructor(private readonly c: R2Config) {
    this.s3 = new S3Client({
      region: "auto",
      endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    });
  }

  async put(key: string, body: Buffer | string, contentType: string): Promise<void> {
    await this.s3.send(new PutObjectCommand({ Bucket: this.c.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async putFile(key: string, path: string, contentType: string): Promise<void> {
    await this.put(key, await readFile(path), contentType);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.c.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  /** Okuma linki: genel alan adı varsa doğrudan, yoksa imzalı (varsayılan 1 saat). */
  async url(key: string, expiresInSec = 3600, downloadName?: string): Promise<string> {
    if (this.c.publicBaseUrl && !downloadName) return `${this.c.publicBaseUrl.replace(/\/$/, "")}/${key}`;
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.c.bucket,
        Key: key,
        ...(downloadName ? { ResponseContentDisposition: `attachment; filename="${downloadName}"` } : {}),
      }),
      { expiresIn: expiresInSec },
    );
  }
}
