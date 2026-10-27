# Site planı — Arsa Video

Tarih: 2026-10-18 · Tasarım tokenları: [design-dna.json](design-dna.json)

## 1. Rakip ve benchmark incelemesi

| Site | Ne yapıyor | Bizim için ders |
|---|---|---|
| **Land id** (id.land) | Parsel verisi, sınır, 3D sanal tur (ABD) | En yakın rakip. Ürün ekranı hero'nun hemen altında; "Watch" + "örnek gör" iki CTA. Beyaz zemin, ağır grotesk. |
| **Pedra** (pedra.ai) | Emlak AI: staging, video, 360° tur | En iyi dönüşüm kurgusu: hero'da fiyat (29€/ay) ve süre ("15 dakikada"), "Eski yol" karşılaştırması, sayılı gerçek sonuçlar (67→34 gün), uzun SSS. |
| **Reelsy / AutoReel** | Ürün videosu | Video kartları galerisi; ikili başlık (grotesk + italik serif) — taklit etmeyeceğiz. |
| **Runway** | AI video | Tam genişlik video hero: çıktının kendisi en güçlü görsel. |
| **Synthesia** | AI video | Kayıtsız deneme kancası: "Videonuzu birkaç dakikada e-postayla alın". |
| **Revid / Higgsfield** | Sosyal video | Koyu + neon + kalabalık rozetler. **Kaçınılacak yön** — bizim panelin şu anki hali (siyah + #00e5ff) buna yakın. |
| **VirtualStagingAI** | Staging | Önce/sonra sürgüsü emlakçıya anında anlatıyor. |

**Ortak doğrular:** (1) çıktının kendisi hero'da, (2) süre + fiyat ilk ekranda, (3) önce/sonra, (4) gerçek müşteri sonuçları, (5) kayıtsız deneme.
**Boşluk:** Türkiye'de ada/parsel numarasından otomatik drone videosu üreten bir ürün yok; rakiplerin hiçbiri arsaya (bina yokken) odaklanmıyor. Konumlandırma: **"Drone uçurmadan arsanızın drone videosu."**

## 2. Tasarım yönü: "Pafta"

Kadastro paftası + drone vizörü. Açık, yeşilimsi-gri harita kâğıdı zemin; koyu bantlarda gerçek uçuş videoları; tek vurgu rengi videodaki parsel konturunun sarısı.

| Token | Hex | Rol |
|---|---|---|
| Pafta | `#EDEFE8` | Sayfa zemini |
| Kâğıt | `#F7F8F3` | Kart / form zemini |
| Mürekkep | `#1E2A23` | Metin, ikincil buton |
| Zeytin | `#5B6B3A` | İkincil bilgi, bağlantı |
| Parsel sarısı | `#FFC24D` | Birincil CTA dolgusu, parsel çizgisi (render ile aynı renk) |
| Gece | `#121A16` | Video bantları |

- **Yazı:** Bricolage Grotesque (başlık) + Instrument Sans (gövde). İkisi de Türkçe karakter destekli. Ada/parsel, m², mesafe → tabular rakam.
- **İmza an:** sayfa açılışında gerçek bir parselin sarı sınırı bir kez çizilir; "Nasıl çalışır"da scroll'la kamera parselden havalanır (kendi render motorumuzla üretilmiş kare dizisi). Başka animasyon yok.
- **Kaçınılanlar:** siyah+neon, kart kiti, tümü büyük harf etiketler, stok fotoğraf, oklu buton metinleri.
- **Panel de bu sisteme geçer** (şu an Inter + siyah + cyan). Panel koyu kalabilir ama aynı tokenlarla: Gece zemin, sarı vurgu.

Öneri, gözden geçirme notu: ilk aklıma gelen "koyu zemin + neon cyan" idi — hem mevcut panel hem Revid/Higgsfield böyle, yani varsayılan. Emlakçının dünyası tapu, pafta, harita; bu yüzden açık harita zemine ve render'daki sarı çizgiye döndüm.

## 3. Site haritası

| Yol | Sayfa | Faz |
|---|---|---|
| `/` | Ana sayfa | A |
| `/ornekler` | Gerçek videolar galerisi (il/ilçe filtreli) | B |
| `/fiyatlar` | Kredi paketleri | C |
| `/sss` | Sık sorulanlar (ana sayfada da kısa hali) | B |
| `/iletisim` | Form + WhatsApp | A |
| `/kvkk`, `/gizlilik`, `/cerez`, `/kullanim-kosullari` | Yasal | A |
| `/mesafeli-satis`, `/on-bilgilendirme`, `/iade` | Satış için zorunlu yasal metinler | C |
| `/giris`, `/kayit`, `/panel/*` | Mevcut | var |
| `/parsel-onizleme` | Kayıtsız ücretsiz önizleme aracı | D |
| `/blog/*` | İçerik / SEO | D |
| `/arsa-videosu/[il]/[ilce]` | Programatik SEO sayfaları | D |

## 4. Ana sayfa akışı

```
┌──────────────────────────────────────────────────────────┐
│ logo        Örnekler  Fiyatlar  SSS      Giriş [Ücretsiz dene] │
├──────────────────────────────────────────────────────────┤
│ Drone uçurmadan                     ┌────────┐            │
│ arsanızın drone videosu.            │ 9:16   │  ← gerçek  │
│ TKGM'den indirdiğiniz parseli       │ reels  │    çıktı,  │
│ yükleyin; 5 dakikada seslendirmeli  │ sarı   │    sarı    │
│ Reels videosu hazır.                │ kontur │    kontur  │
│ [Parselinizi yükleyin] [Örnek izle] └────────┘   çizilir  │
│ İlk video ücretsiz · Ezine 230 ada 3 parsel              │
├──────── koyu bant ───────────────────────────────────────┤
│ Eski yol ↔ Arsa Video  (drone çekimi ~3–5 bin TL, 2–3 gün │
│  vs. 5 dk, video başı ₺…)  — önce/sonra sürgüsü: ilandaki  │
│  tek fotoğraf ↔ video                                      │
├──────────────────────────────────────────────────────────┤
│ Nasıl çalışır (gerçek sıra, numaralı):                     │
│ 1 Parsel   KML / ada-parsel   ─┐ scroll'la kamera         │
│ 2 Çevre    okul, hastane, deniz│ havalanır, çevre          │
│ 3 Video    ses, altyazı, müzik ┘ noktaları belirir        │
├──────────────────────────────────────────────────────────┤
│ Parsel künyesi örneği: il/ilçe/mahalle · ada/parsel · m²  │
│ · nitelik · "Okula 650 m"  → videoda ne çıkacağını gösterir│
├──────── koyu bant ───────────────────────────────────────┤
│ Örnekler: 3–6 telefon çerçevesi, farklı illerden          │
├──────────────────────────────────────────────────────────┤
│ Formatlar: Instagram Reels · YouTube 16:9 · sahibinden    │
│ Fiyat özeti · SSS (6 soru) · Son CTA                       │
└──────────────────────────────────────────────────────────┘
```

Metin tonu: "siz", emlakçı dili (ada/parsel, nitelik, imar). Butonlar ne olacağını söyler: "Parselinizi yükleyin", "Videoyu oluşturun".

## 5. Aşamalı canlıya alma

### Faz A — Yayında bir yüz (1. hafta)
- Next.js içinde `(site)` route grubu: pazarlama sayfaları statik, panel aynı uygulamada (`/panel`). `/` artık panele yönlendirmez.
- Ana sayfa (sade sürüm) + **bekleme listesi / erken erişim formu** (DB'de `waitlist` tablosu), iletişim, KVKK/gizlilik/çerez.
- Tasarım tokenlarının `globals.css`'e taşınması, fontlar, logo.
- Hero videosu ve posterleri kendi hattımızla üretilip R2/CDN'de.
- Barındırma: web + kuyruk worker'ı sürekli çalışan süreç ister → Vercel yerine Hetzner/Coolify veya Railway (Postgres + Redis aynı yerde). Alan adı, SSL, Cloudflare.
- Ölçüm: Plausible/Umami (çerezsiz → banner yükü az), Google Search Console, `sitemap.xml`, `robots.txt`, OG görselleri.

### Faz B — Kapalı beta (2–3. hafta)
- Davet koduyla kayıt, kullanıcı başı ücretsiz kredi (ör. 3 video).
- `/ornekler` galerisi (beta kullanıcılarının izinli videolarıyla), `/sss`.
- Panel yeni tasarım sistemine geçer; e-posta bildirimi ("Videonuz hazır").
- Hata izleme (Sentry), maliyet takibi (video başına GPU + ElevenLabs + Google karo).

### Faz C — Açık lansman ve ödeme (4–5. hafta)
- Kredi sistemi (DB: `credits`, `orders`) ve paketler. Ödeme: **iyzico** veya **PayTR** (Stripe Türkiye şirketlerine açık değil).
- Zorunlular: mesafeli satış sözleşmesi, ön bilgilendirme formu, iade koşulları, ETBİS kaydı, e-fatura/e-arşiv (Paraşüt veya benzeri entegrasyon).
- `/fiyatlar`, Turnstile ile kayıt koruması, kötüye kullanım sınırları.

### Faz D — Büyüme
- **Parsel önizleme aracı** (kayıtsız): il/ilçe/ada/parsel yazılır → sarı sınırla 10 sn'lik filigranlı önizleme e-postayla gelir (Synthesia kancası). Google 3D karo maliyeti için hız sınırı.
- Programatik SEO: `/arsa-videosu/canakkale/ezine` gibi sayfalar, blog ("Arsa nasıl hızlı satılır", "İmar durumu nasıl öğrenilir").
- Ofis hesapları (ekip), logo/marka şablonu, referans programı, Meta reklamları için video kreatifleri.

## 6. Netleşmesi gerekenler
1. Marka adı ve alan adı ("Arsa Video" çalışma adı mı?).
2. Fiyatlama: video başı kredi mi, aylık paket mi? Hedef birim fiyat?
3. Örnek galeride kullanılabilecek gerçek parseller / müşteri izinleri.
4. Barındırma tercihi (mevcut Postgres/Redis nerede çalışıyor?).

## 7. Güncelleme (2026-10-18): şablon yapısı
Higgsfield tarzı yapıya geçildi: kullanıcı şablonu seçer, şablon kendi formunu açar.
- Şablon tanımları: `packages/shared/src/templates.ts` (ad, örnek video, istenenler, aşamalar, sipariş şeması).
- Üretim hatları: `apps/worker/src/templates/` (arsa-drone, ilan-videosu, bitmis-hali); worker işi `videos.template`'e göre dağıtır.
- Site açık (Pafta); `/sablonlar` galerisi ve panel koyu (Gece).
- Bekleme listesi kaldırıldı; butonlar doğrudan kayda gider.
- Yeni şablon eklemek: tanım + sipariş şeması + worker hattı + panel formu.

## 8. Güncelleme (2026-10-27): Gökyüzü paleti ve vizör dili
"Pafta" yönü bırakıldı; site, panel ve yönetim açık **Gökyüzü** paletinde (tokenlar: `apps/web/src/app/globals.css`, ayrıntı: [design-dna.json](design-dna.json)).

| Token | Hex | Rol |
|---|---|---|
| Zemin | `#F5F8FD` | Sayfa zemini |
| Lacivert | `#0D1B3E` | Metin; hero ve son çağrı bantları |
| Gök | `#2B6CFF` | Açık zeminde birincil buton ve bağlantı |
| Güneş (parsel sarısı) | `#FFC93C` | Koyu zeminde CTA; vizör köşeleri |
| Gri | `#56627A` | İkincil metin |
| Ayraç | `#E2E8F3` | Künye çizgileri, kenarlıklar |

**İmza dil — drone vizörü** (sanaldrone.com analizinden sonra, bkz. [design-dna-sanaldrone.json](design-dna-sanaldrone.json)):
- **Hero** (`HeroVizor.tsx`): lacivert bant; sağda sarı köşeli vizörde şablonun gerçek çıktısı oynar, sekmeler (Arsa, Sunuculu ev, Eşya döşeme, İnşaat) videoyu değiştirir; yanında videodan okunan künye.
- **Anlatım bölümleri** (`AnlatimBolumu.tsx`): çizim vizör köşeleri içinde; üstte düz mavi tek satır; adımlar künye satırları gibi.
- **Karşılaştırma**: "Aynı ilan, iki yol" — aynı dört konu iki künyede yan yana; Arsa Video tarafı vizörde.
- Ortak bileşen: `VizorCercevesi.tsx`.

**Ana sayfa sırası:** hero → örnek video şeridi → arsa / konut / proje anlatımları → şablon kataloğu → üç adım → karşılaştırma → son çağrı.

**Kaçınılanlar:** emojili hap etiketler, başlıkta tek kelimeyi renklendirme, bulanık renk lekeleri, uydurma müşteri yorumu ve logo.

## 9. Güncelleme (2026-10-27, akşam): ana sayfa baştan — "Uçuş"
Bölüm 8'deki vizör rötuşu yetersiz bulundu; ana sayfa sıfırdan kuruldu. Ayrıntı: [design-dna.json](design-dna.json).

- **Sayfa baştan sona koyu** (lacivert `#0D1B3E`, değişimli bantlar `#070E22`); tek vurgu parsel sarısı `#FFC93C`. Gök mavisi yalnız alt sayfa gövdelerinde ve panelde.
- **Hero** (`HeroVizor.tsx`, 2026-10-28'de geri getirildi): lacivert bant, zeminde seçili şablonun bulanık kapağı; sağda sarı köşeli vizörde gerçek çıktı oynar, sekmeler (Arsa, Sunuculu ev, Eşya döşeme, İnşaat) videoyu değiştirir, yanında videodan okunan künye. Tam ekran video denemesi (HeroUcus) kullanıcı isteğiyle geri alındı.
- **Film şeridi** (`FilmSeridi.tsx`): altı şablonun gerçek çıktıları ekran boyu dikey, snap kaydırmalı; görünen video sessiz oynar.
- **Üç anlatım, üçü de gerçek malzemeyle:** arsa (parsel sınırlı kare + künye), konut (`OnceSonra.tsx`: boş/döşenmiş oda sürgüsü), proje (dört inşaat karesi).
- Karşılaştırma, üç adım ve son çağrı koyu dilde; **menü koyu cam hap**, tüm sayfalarda.
- **Yazı tipi:** her yerde Plus Jakarta Sans. Bricolage Grotesque denemesi aynı akşam geri alındı.
- **Hareket:** yalnız videolar ve kullanıcının sürüklediği sürgü; giriş animasyonu, kaydırma tetikli belirme yok.
- Eski çizim bileşenleri (DroneCizim, KonutCizim, ProjeCizim, AnlatimBolumu) ana sayfada kullanılmıyor; dosyalar duruyor.
