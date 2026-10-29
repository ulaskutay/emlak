#!/usr/bin/env bash
# Arsa Video'yu etic-vps'e (aaPanel, /www/wwwroot/arsa-video) yükler: commit'lenmiş kod → kur → derle → migrasyon → yeniden başlat.
# Sunucudaki .env, .cache ve acme klasörlerine dokunulmaz.
#   ./deploy/etic-vps.sh
#
# Sunucuda son yüklenen commit .deployed-commit dosyasında durur. tar yalnız dosya eklediği için, o commit'ten beri
# git'te silinen (ya da taşınan) dosyalar sunucudan ayrıca silinir; yoksa eski kopyalar kalır ve derlemeyi bozabilir
# (2026-10-27: (galeri) → (site) taşınınca iki sayfa aynı adrese düştü).
#
# Kesintisiz derleme: site, çalışırken kendi derleme klasörü değişirse 500 verir (2026-10-27: kullanıcı detay sayfası,
# "client reference manifest does not exist"). Bu yüzden derleme boştaki klasöre yapılır (.next-a / .next-b, NEXT_DIST_DIR),
# bitince web servisi .next-active.env ile yeni klasöre çevrilip yeniden başlatılır. Önceki klasör geri dönüş için kalır.
# Aynı anda iki yükleme çalışmasın diye sunucuda .deploy-lock kilidi tutulur.
set -euo pipefail
cd "$(dirname "$0")/.."
DIR=/www/wwwroot/arsa-video
git diff --quiet HEAD || echo "Uyarı: commit'lenmemiş değişiklikler yüklenmez (yalnız HEAD gider)."

if ! ssh etic-vps "mkdir $DIR/.deploy-lock 2>/dev/null"; then
  echo "Sunucuda başka bir yükleme sürüyor ($DIR/.deploy-lock). Yarım kalmış bir yüklemeden kaldıysa silip yeniden deneyin:" >&2
  echo "  ssh etic-vps rmdir $DIR/.deploy-lock" >&2
  exit 1
fi
trap 'ssh etic-vps "rmdir $DIR/.deploy-lock" || true' EXIT

PREV=$(ssh etic-vps "cat $DIR/.deployed-commit 2>/dev/null" || true)
if [ -n "$PREV" ] && git cat-file -e "$PREV^{commit}" 2>/dev/null; then
  DELETED=$(git diff --name-only --no-renames --diff-filter=D "$PREV" HEAD)
  if [ -n "$DELETED" ]; then
    echo "Sunucudan silinecek ($(echo "$DELETED" | wc -l | tr -d ' ') dosya, ${PREV:0:7} → $(git rev-parse --short HEAD)):"
    echo "$DELETED" | sed 's/^/  /'
    # Dosya silinir, boşalan üst klasörler de kaldırılır (dolu olan klasörde rmdir durur).
    git diff --name-only --no-renames --diff-filter=D -z "$PREV" HEAD | ssh etic-vps "cd $DIR && while IFS= read -r -d '' f; do
      rm -f -- \"\$f\"; rmdir -p --ignore-fail-on-non-empty -- \"\$(dirname -- \"\$f\")\" 2>/dev/null || true; done"
  fi
else
  echo "Uyarı: sunucudaki son commit bilinmiyor (.deployed-commit yok ya da bu depoda değil); silinen dosyalar temizlenmedi."
fi

git archive --format=tar HEAD | ssh etic-vps "cd $DIR && tar -xf - && chown -R www:www ."
ssh etic-vps bash -s <<'REMOTE'
set -euo pipefail
DIR=/www/wwwroot/arsa-video
WEB=$DIR/apps/web
ACTIVE_ENV=$DIR/.next-active.env

# Web servisi derleme klasörünü bu dosyadan okur (bir kez kurulur).
DROPIN=/etc/systemd/system/arsa-video-web.service.d/dist.conf
if [ ! -f "$DROPIN" ]; then
  mkdir -p "$(dirname "$DROPIN")"
  printf '[Service]\nEnvironmentFile=-%s\n' "$ACTIVE_ENV" > "$DROPIN"
  systemctl daemon-reload
fi

ACTIVE=$(sed -n 's/^NEXT_DIST_DIR=//p' "$ACTIVE_ENV" 2>/dev/null || true)
ACTIVE=${ACTIVE:-.next}
NEXT=$([ "$ACTIVE" = .next-a ] && echo .next-b || echo .next-a)
echo "Çalışan derleme $ACTIVE; yeni derleme $NEXT klasörüne."
rm -rf "$WEB/$NEXT"
# tsconfig .next/types'ı tip denetimine katar; eski düzenden kalan tipler silinmiş sayfaları arayıp derlemeyi bozar.
# Çalışan site bunları kullanmaz.
# .next artık aktif derlemeye bağlantı; yalnız gerçek klasörse (eski düzen) içinden silinir.
[ -L "$WEB/.next" ] || rm -rf "$WEB/.next/types" "$WEB/.next/dev"
# tsconfig'in **/*.ts deseni çalışan derlemenin klasörünü de kapsar: onun eski tipleri silinmiş bir rotayı arayıp
# derlemeyi bozar (2026-10-30: /api/parcel/prepare). Tipler yalnız derlemede kullanılır, çalışan site etkilenmez.
rm -rf "$WEB/$ACTIVE/types" "$WEB/$ACTIVE/dev/types"

# İlan videosu Remotion ile render edilir: Chrome Headless Shell'in sistemde eksik kalan kütüphanesi (bir kez kurulur).
dpkg -s libnss3 >/dev/null 2>&1 || DEBIAN_FRONTEND=noninteractive apt-get install -y -q libnss3

# Drone stüdyosu panel derlemesi (apps/web/public/studio): inşaat videosunun yaklaşma çekimi kullanıcının tarayıcısında çizilir.
su -s /bin/bash www -c "export PATH=/www/server/nodejs/v22.22.3/bin:/usr/bin:/bin HOME=/home/www NEXT_TELEMETRY_DISABLED=1 NEXT_DIST_DIR=$NEXT
  cd $DIR && pnpm install --frozen-lockfile && pnpm --filter @arsa/drone-studio build:web && pnpm --filter @arsa/web build && pnpm db:migrate &&
  cd apps/worker && node --input-type=module -e \"import { ensureBrowser } from '@remotion/renderer'; await ensureBrowser();\""

echo "NEXT_DIST_DIR=$NEXT" > "$ACTIVE_ENV" && chown www:www "$ACTIVE_ENV"
# nginx /_next/static'i apps/web/.next/static'ten verir (2026-10-27: .next silinince CSS/JS 404, site stilsiz açıldı).
# .next her zaman aktif derlemeye bağlantı olur.
[ -L "$WEB/.next" ] || rm -rf "$WEB/.next"
ln -sfn "$NEXT" "$WEB/.next" && chown -h www:www "$WEB/.next"
systemctl restart arsa-video-web arsa-video-worker
sleep 5
systemctl is-active arsa-video-web arsa-video-worker
curl -s -o /dev/null -w "site %{http_code}\n" http://127.0.0.1:3050/
REMOTE
# Yalnız başarılı yüklemeden sonra: bir sonraki yükleme silinenleri bu commit'e göre bulur.
git rev-parse HEAD | ssh etic-vps "cat > $DIR/.deployed-commit && chown www:www $DIR/.deployed-commit"
