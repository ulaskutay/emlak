#!/usr/bin/env bash
# Arsa Video'yu etic-vps'e (aaPanel, /www/wwwroot/arsa-video) yükler: commit'lenmiş kod → kur → derle → migrasyon → yeniden başlat.
# Sunucudaki .env, .cache ve acme klasörlerine dokunulmaz.
#   ./deploy/etic-vps.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git diff --quiet HEAD || echo "Uyarı: commit'lenmemiş değişiklikler yüklenmez (yalnız HEAD gider)."
git archive --format=tar HEAD | ssh etic-vps 'cd /www/wwwroot/arsa-video && tar -xf - && chown -R www:www .'
ssh etic-vps 'su -s /bin/bash www -c "export PATH=/www/server/nodejs/v22.22.3/bin:/usr/bin:/bin HOME=/home/www NEXT_TELEMETRY_DISABLED=1
  cd /www/wwwroot/arsa-video && pnpm install --frozen-lockfile && pnpm --filter @arsa/web build && pnpm db:migrate" \
  && systemctl restart arsa-video-web arsa-video-worker && sleep 5 && systemctl is-active arsa-video-web arsa-video-worker \
  && curl -s -o /dev/null -w "site %{http_code}\n" http://127.0.0.1:3050/'
