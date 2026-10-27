#!/usr/bin/env bash
# Arsa Video'yu etic-vps'e (aaPanel, /www/wwwroot/arsa-video) yükler: commit'lenmiş kod → kur → derle → migrasyon → yeniden başlat.
# Sunucudaki .env, .cache ve acme klasörlerine dokunulmaz.
#   ./deploy/etic-vps.sh
#
# Sunucuda son yüklenen commit .deployed-commit dosyasında durur. tar yalnız dosya eklediği için, o commit'ten beri
# git'te silinen (ya da taşınan) dosyalar sunucudan ayrıca silinir; yoksa eski kopyalar kalır ve derlemeyi bozabilir
# (2026-10-27: (galeri) → (site) taşınınca iki sayfa aynı adrese düştü).
set -euo pipefail
cd "$(dirname "$0")/.."
DIR=/www/wwwroot/arsa-video
git diff --quiet HEAD || echo "Uyarı: commit'lenmemiş değişiklikler yüklenmez (yalnız HEAD gider)."

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
ssh etic-vps 'su -s /bin/bash www -c "export PATH=/www/server/nodejs/v22.22.3/bin:/usr/bin:/bin HOME=/home/www NEXT_TELEMETRY_DISABLED=1
  cd /www/wwwroot/arsa-video && pnpm install --frozen-lockfile && pnpm --filter @arsa/web build && pnpm db:migrate" \
  && systemctl restart arsa-video-web arsa-video-worker && sleep 5 && systemctl is-active arsa-video-web arsa-video-worker \
  && curl -s -o /dev/null -w "site %{http_code}\n" http://127.0.0.1:3050/'
# Yalnız başarılı yüklemeden sonra: bir sonraki yükleme silinenleri bu commit'e göre bulur.
git rev-parse HEAD | ssh etic-vps "cat > $DIR/.deployed-commit && chown www:www $DIR/.deployed-commit"
