#!/usr/bin/env bash
# T-204: install or update SiteCraft on the owner's VPS. Run as root on the VPS:
#   bash install.sh <git-ref>          e.g. bash install.sh family-kit-assembly
# Idempotent. Touches only /opt/sitecraft, the sitecraft user, an extra swap file,
# /etc/nginx/conf.d/sitecraft.conf and the sitecraft-app unit. It never edits the
# xray/x-ui proxy, and never stores a model key.
set -euo pipefail
REF=${1:?usage: install.sh <git-ref>}
REPO=https://github.com/a1024053774/sitecraft-ai.git
ROOT=/opt/sitecraft
HERE=$(cd "$(dirname "$0")" && pwd)
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }
step() { echo; echo "== $*"; }

step "swap: make sure there are at least 2 GB"
SWAP_MB=$(free -m | awk '/^Swap:/ {print $2}')
if [ "$SWAP_MB" -lt 1900 ] && [ ! -f /swapfile-sitecraft ]; then
  fallocate -l $((2048 - SWAP_MB))M /swapfile-sitecraft && chmod 600 /swapfile-sitecraft
  mkswap /swapfile-sitecraft && swapon /swapfile-sitecraft
  grep -q swapfile-sitecraft /etc/fstab || echo '/swapfile-sitecraft none swap sw 0 0' >> /etc/fstab
fi
free -m | awk '/^Swap:/ {print "swap total MB:", $2}'

step "system packages: git, headless Chrome libraries, CJK fonts (layout checks measure Chinese text)"
apt-get update -qq
apt-get install -y -qq git curl xz-utils unzip ca-certificates fonts-noto-cjk fonts-noto-color-emoji \
  libnss3 libatk-bridge2.0-0t64 libatk1.0-0t64 libgbm1 libasound2t64 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxrandr2 libpango-1.0-0 libcairo2 libcups2t64 libdrm2 libxfixes3 >/dev/null

step "Node 22 LTS under $ROOT/node (checked against the official SHASUMS256)"
mkdir -p $ROOT
if ! [ -x $ROOT/node/bin/node ] || ! $ROOT/node/bin/node -v | grep -q '^v22\.'; then
  BASE=https://nodejs.org/dist/latest-v22.x
  NAME=$(curl -fsSL $BASE/SHASUMS256.txt | awk '/linux-x64\.tar\.xz$/ {print $2}')
  curl -fsSL -o /tmp/$NAME $BASE/$NAME
  (cd /tmp && curl -fsSL $BASE/SHASUMS256.txt | grep " $NAME\$" | sha256sum -c -)
  rm -rf $ROOT/node && mkdir -p $ROOT/node && tar -xJf /tmp/$NAME -C $ROOT/node --strip-components=1 && rm /tmp/$NAME
fi
export PATH=$ROOT/node/bin:$PATH
node -v

step "service user and source at $REF"
id sitecraft >/dev/null 2>&1 || useradd --system --home $ROOT --shell /usr/sbin/nologin sitecraft
if [ -d $ROOT/app/.git ]; then git -C $ROOT/app fetch -q origin; else git clone -q $REPO $ROOT/app; fi
git -C $ROOT/app checkout -q --detach "origin/$REF" 2>/dev/null || git -C $ROOT/app checkout -q --detach "$REF"
git -C $ROOT/app log --oneline -1
[ ! -e $ROOT/app/.env.local ] || { echo "refusing: $ROOT/app/.env.local exists; the server must not hold a model key"; exit 1; }

step "headless Chrome for the commit checks"
if ! [ -x $ROOT/chrome/chrome-headless-shell ]; then
  # A failed extraction leaves an empty version folder that the installer refuses to reuse.
  rm -rf $ROOT/chrome-dl
  (cd /tmp && npx -y @puppeteer/browsers install chrome-headless-shell@stable --path $ROOT/chrome-dl >/dev/null)
  BIN=$(find $ROOT/chrome-dl -type f -name chrome-headless-shell -perm -u+x | head -1)
  [ -n "$BIN" ] || { echo "chrome-headless-shell not found under $ROOT/chrome-dl"; exit 1; }
  mkdir -p $ROOT/chrome && ln -sf "$BIN" $ROOT/chrome/chrome-headless-shell
  chmod -R a+rX $ROOT/chrome-dl
fi
$ROOT/chrome/chrome-headless-shell --version

step "install dependencies and build (SITE_STORE=browser; swap carries the build on 1 GB)"
cd $ROOT/app
npm ci --no-audit --no-fund
SITE_STORE=browser NODE_OPTIONS=--max-old-space-size=1536 npm run build
chown -R sitecraft:sitecraft $ROOT/app

step "product page: landing/ with the builder address filled in"
rm -rf $ROOT/landing.new && cp -R $ROOT/app/landing $ROOT/landing.new
sed -i 's#BUILDER_URL#https://sitecraftapp.luckye.online#g' $ROOT/landing.new/index.html
if grep -q BUILDER_URL $ROOT/landing.new/index.html; then echo 'BUILDER_URL left in landing'; exit 1; fi
rm -rf $ROOT/landing.old && { [ -d $ROOT/landing ] && mv $ROOT/landing $ROOT/landing.old || true; } && mv $ROOT/landing.new $ROOT/landing
chmod -R a+rX $ROOT/landing

step "nginx: add sitecraft.conf only, test, reload"
install -m 644 $HERE/nginx-sitecraft.conf /etc/nginx/conf.d/sitecraft.conf
# A failing test removes our file again, so the owner's nginx is never left with a broken config.
nginx -t || { rm -f /etc/nginx/conf.d/sitecraft.conf; echo 'nginx -t failed; sitecraft.conf removed, nothing reloaded'; exit 1; }
systemctl reload nginx

step "app service"
install -m 644 $HERE/sitecraft-app.service /etc/systemd/system/sitecraft-app.service
systemctl daemon-reload
systemctl enable -q sitecraft-app
systemctl restart sitecraft-app
for i in $(seq 1 60); do curl -fs -o /dev/null http://127.0.0.1:3100/ && break; sleep 2; done

step "smoke checks through nginx (as the tunnel would call it)"
curl -fs -o /dev/null -w "landing %{http_code}\n" -H 'Host: sitecraft.luckye.online' http://127.0.0.1/
curl -fs -o /dev/null -w "app %{http_code}\n" -H 'Host: sitecraftapp.luckye.online' http://127.0.0.1/
curl -s -o /dev/null -w "published (expect 404) %{http_code}\n" -H 'Host: sitecraftapp.luckye.online' http://127.0.0.1/published/x
curl -s -o /dev/null -w "unknown host (expect 000, dropped) %{http_code}\n" -H 'Host: other.example' http://127.0.0.1/ || true
free -m
