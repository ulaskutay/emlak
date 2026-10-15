import { ElevenLabsClient, type VoiceOption } from "@arsa/providers";
import { NextResponse } from "next/server";
import { apiUser, unauthorized } from "@/lib/api";

let cache: { at: number; voices: VoiceOption[] } | null = null;

/** Türkçe sesler (10 dk önbellekli): önce ana dili Türkçe olanlar. */
export async function GET() {
  if (!(await apiUser())) return unauthorized();
  if (!cache || Date.now() - cache.at > 10 * 60_000) {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) return NextResponse.json({ voices: [] });
    cache = { at: Date.now(), voices: await new ElevenLabsClient({ apiKey: key }).turkishVoices() };
  }
  return NextResponse.json({ voices: cache.voices });
}
