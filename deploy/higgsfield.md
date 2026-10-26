# Higgsfield CLI (sunucu)

"Sunuculu ev turu" şablonu görsel ve videoları `higgsfield` CLI ile, plan kredisinden üretir
(`packages/providers/src/higgsfield.ts`). Worker CLI'ı `www` kullanıcısı olarak çalıştırır; oturum o kullanıcının
`/home/www/.config/higgsfield/credentials.json` dosyasında durur ve kendiliğinden yenilenir.

## Kurulum (bir kez)

```bash
ssh etic-vps 'curl -fsSL https://raw.githubusercontent.com/higgsfield-ai/cli/main/install.sh | sh'
```

`/usr/local/bin/higgsfield` olarak kurulur. `.env`'e ekleyin:

```
HIGGSFIELD_BIN=/usr/local/bin/higgsfield
HIGGSFIELD_CONCURRENCY=4
```

## Oturum açma

Giriş tarayıcıyla (OAuth) yapılır ve geri dönüş sunucunun yerel portuna gelir. Portu SSH ile kendi bilgisayarınıza
yönlendirin; sunucuya ayrı oturum açılır (Mac'teki oturum dosyasını kopyalamayın: iki makine aynı yenileme anahtarını
kullanırsa biri düşer).

```bash
ssh -L 8765:127.0.0.1:8765 etic-vps
su -s /bin/bash www -c 'HOME=/home/www higgsfield auth login --port 8765'
```

Çıkan linki kendi tarayıcınızda açıp info@eticajans.com ile giriş yapın. Doğrulama:

```bash
su -s /bin/bash www -c 'HOME=/home/www higgsfield account status'
```

## Notlar

- Plus planı aynı anda en fazla 8 iş kabul eder. Worker bundan fazlasını göndermez (`HIGGSFIELD_CONCURRENCY`),
  sınıra takılan iş bekleyip yeniden denenir.
- Oda başına ~7,5 kredi (Seedream 5.0 Pro kare 2,5 + Kling 4.0 10 sn klip 5). Kredi bitince işler hata verir.
- Oturum düşerse (`Session expired`) işler hata verir; yukarıdaki giriş adımını tekrarlayın.
