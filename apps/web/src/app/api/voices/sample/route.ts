import { createHash } from "node:crypto";
import { ElevenLabsClient } from "@arsa/providers";
import { NextResponse } from "next/server";
import { apiUser, badRequest, unauthorized } from "@/lib/api";
import { r2 } from "@/lib/r2";

/**
 * Ses örneği: parselin kanca cümlesini seçilen sesle okur. R2'de (ses + metin) özetiyle önbelleklenir,
 * aynı örnek ikinci kez ElevenLabs kredisi harcamaz. Metin kısa tutulur (kötüye kullanım sınırı).
 */
export async function POST(req: Request) {
  if (!(await apiUser())) return unauthorized();
  const { voiceId, text } = (await req.json().catch(() => ({}))) as { voiceId?: string; text?: string };
  if (!voiceId || !/^[A-Za-z0-9]{10,40}$/.test(voiceId)) return badRequest("Geçersiz ses");
  if (!text || text.length > 180) return badRequest("Örnek metin 180 karakteri geçemez");
  const model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
  const key = `voice-samples/${createHash("sha1").update(`${voiceId}|${model}|${text}`).digest("hex").slice(0, 16)}.mp3`;
  const store = r2();
  if (!(await store.exists(key))) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return badRequest("Seslendirme ayarlı değil");
    const sp = await new ElevenLabsClient({ apiKey, voiceId, model }).speak(text);
    await store.put(key, sp.audio, "audio/mpeg");
  }
  return NextResponse.json({ url: await store.url(key, 3600) });
}
