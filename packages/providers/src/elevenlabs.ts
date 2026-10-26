/**
 * ElevenLabs: seslendirme (kelime zamanlarıyla), müzik ve ses efekti.
 *
 * Seslendirme sahne sahne üretilir; her sahnenin süresi ve kelime zamanları videonun kurgusunu belirler
 * (uçuş anlatım kadar sürer, altyazı kelime kelime vurgulanır).
 */
const API = "https://api.elevenlabs.io";

export interface Word {
  word: string;
  /** Klip başına göre saniye. */
  start: number;
  end: number;
}

export interface Speech {
  audio: Buffer; // mp3
  duration: number;
  words: Word[];
}

/** Panelde gösterilecek ses kartı. */
export interface VoiceOption {
  id: string;
  name: string;
  gender?: string;
  description?: string;
  /** ElevenLabs'in hazır örnek kaydı (çoğunlukla İngilizce); Türkçe örnek için speak() kullanılır. */
  previewUrl?: string;
  /** Türkçe ana dilli (İstanbul aksanı / yalnız Türkçe) ses: listede önce gelir. */
  native: boolean;
}

export interface ElevenLabsOptions {
  apiKey: string;
  voiceId?: string;
  model?: string;
}

/** Karakter zamanlamasından kelime zamanları (boşlukta bölünür, noktalama kelimede kalır). */
function wordsFromAlignment(a: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }): Word[] {
  const words: Word[] = [];
  let cur: Word | null = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) words.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { word: "", start: a.character_start_times_seconds[i]!, end: 0 };
    cur.word += ch;
    cur.end = a.character_end_times_seconds[i]!;
  });
  if (cur) words.push(cur);
  return words;
}

export class ElevenLabsClient {
  private voiceId?: string;
  private readonly model: string;

  constructor(private readonly o: ElevenLabsOptions) {
    this.voiceId = o.voiceId || undefined;
    this.model = o.model || "eleven_multilingual_v2";
  }

  private async post(path: string, body: unknown): Promise<Response> {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "xi-api-key": this.o.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${path.split("?")[0]} ${res.status}: ${(await res.text()).slice(0, 400)}`);
    return res;
  }

  /** Hesaptaki sesler (ad, dil etiketleri). */
  async voices(): Promise<{ voice_id: string; name: string; category?: string; labels?: Record<string, string>; verified_languages?: { language: string }[] }[]> {
    const res = await fetch(`${API}/v2/voices?page_size=100`, { headers: { "xi-api-key": this.o.apiKey } });
    if (!res.ok) throw new Error(`ElevenLabs voices ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return ((await res.json()) as { voices: any[] }).voices;
  }

  /** Türkçe konuşabilen sesler: önce ana dili Türkçe olanlar, sonra Türkçe doğrulanmış diğerleri. */
  async turkishVoices(): Promise<VoiceOption[]> {
    const voices = (await this.voices()) as any[];
    return voices
      .filter((v) => v.verified_languages?.some((l: any) => l.language === "tr"))
      .map((v) => {
        const langs = new Set((v.verified_languages ?? []).map((l: any) => l.language));
        const trLang = v.verified_languages.find((l: any) => l.language === "tr");
        const native = v.labels?.accent === "istanbul" || /turkish|türk/i.test(`${v.name} ${trLang?.accent ?? ""}`) || (langs.size === 1 && langs.has("tr"));
        return {
          id: v.voice_id,
          name: String(v.name).split(/ [-–|] /)[0]!.trim(),
          gender: v.labels?.gender,
          description: v.description?.slice(0, 160) || v.labels?.descriptive,
          previewUrl: trLang?.preview_url ?? v.preview_url,
          native,
        };
      })
      .sort((a, b) => Number(b.native) - Number(a.native));
  }

  /** Ses seçilmemişse: Türkçe ana dilli ilk ses, yoksa hesaptaki ilk ses (multilingual model Türkçe konuşur). */
  async resolveVoice(): Promise<string> {
    if (this.voiceId) return this.voiceId;
    const pick = (await this.turkishVoices())[0]?.id ?? (await this.voices())[0]?.voice_id;
    if (!pick) throw new Error("ElevenLabs hesabında ses yok");
    this.voiceId = pick;
    return pick;
  }

  /**
   * Metni seslendirir ve kelime zamanlarını döndürür.
   * previous/next: komşu sahnelerin metni, sahneler arasında tonlama doğal kalsın diye.
   */
  async speak(text: string, ctx: { previous?: string; next?: string } = {}): Promise<Speech> {
    const voice = await this.resolveVoice();
    const res = await this.post(`/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
      text,
      model_id: this.model,
      // Dil sabit Türkçe: v3 özel adları ("Ezine") zaman zaman İngilizce okuyor.
      language_code: "tr",
      // eleven_v3 komşu metin bağlamını desteklemiyor (istek reddediliyor).
      ...(this.model === "eleven_v3" ? {} : { previous_text: ctx.previous, next_text: ctx.next }),
      // Reklam anlatımı: canlı ama tutarlı; hız 0,9: sayılar ("on bir") yutulmadan, net söylenir.
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true, speed: 0.9 },
    });
    const data = (await res.json()) as {
      audio_base64: string;
      alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };
    };
    const words = wordsFromAlignment(data.alignment);
    const ends = data.alignment.character_end_times_seconds;
    return { audio: Buffer.from(data.audio_base64, "base64"), duration: ends[ends.length - 1] ?? 0, words };
  }

  /** Konuşmayı yazıya çevirir (Scribe): seslendirmenin metni doğru okuyup okumadığını denetlemek için. */
  async transcribe(audio: Buffer, languageCode = "tr"): Promise<string> {
    return (await this.transcribeWords(audio, languageCode)).text;
  }

  /** Konuşmayı kelime zamanlarıyla yazıya çevirir (Scribe): hazır videonun sesine altyazı için. */
  async transcribeWords(audio: Buffer, languageCode = "tr"): Promise<{ text: string; words: Word[] }> {
    const fd = new FormData();
    fd.append("model_id", "scribe_v1");
    fd.append("language_code", languageCode);
    fd.append("timestamps_granularity", "word");
    fd.append("file", new Blob([new Uint8Array(audio)]), "speech.mp3");
    const res = await fetch(`${API}/v1/speech-to-text`, { method: "POST", headers: { "xi-api-key": this.o.apiKey }, body: fd });
    if (!res.ok) throw new Error(`ElevenLabs speech-to-text ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { text: string; words?: { text: string; start: number; end: number; type?: string }[] };
    const words = (data.words ?? []).filter((w) => (w.type ?? "word") === "word").map((w) => ({ word: w.text.trim(), start: w.start, end: w.end }));
    return { text: data.text, words };
  }

  /** Enstrümantal fon müziği (Eleven Music). */
  async music(prompt: string, seconds: number): Promise<Buffer> {
    const res = await this.post(`/v1/music?output_format=mp3_44100_128`, {
      prompt,
      music_length_ms: Math.round(seconds * 1000),
      force_instrumental: true,
    });
    return Buffer.from(await res.arrayBuffer());
  }

  /** Kısa ses efekti (geçiş "whoosh"u gibi). */
  async soundEffect(text: string, seconds: number): Promise<Buffer> {
    const res = await this.post(`/v1/sound-generation?output_format=mp3_44100_128`, {
      text,
      duration_seconds: seconds,
      prompt_influence: 0.5,
    });
    return Buffer.from(await res.arrayBuffer());
  }
}
