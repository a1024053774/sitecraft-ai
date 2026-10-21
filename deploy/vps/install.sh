#!/usr/bin/env bash
# T-207: install or update the SiteCraft product page and the static workspace demo on the owner's
# VPS. Run as root on the VPS, from a checkout of the ref to deploy:
#   git clone -b family-kit-assembly https://github.com/a1024053774/sitecraft-ai.git /tmp/sitecraft-deploy
#   bash /tmp/sitecraft-deploy/deploy/vps/install.sh
# Idempotent. Touches only /opt/sitecraft/landing, /opt/sitecraft/demo,
# /etc/nginx/conf.d/sitecraft.conf and the sitecraft-app unit (stop and disable only). It never edits
# the xray/x-ui proxy, starts no Node or Chrome, and never stores a model key.
#
# The builder that T-204 installed (/opt/sitecraft/app, node, chrome, /etc/apparmor.d/sitecraft-chrome,
# the swap file) stays on disk but no longer runs; installing it is the T-204 version of this script
# (git show dadc130:deploy/vps/install.sh).
set -euo pipefail
ROOT=/opt/sitecraft
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=$(cd "$HERE/../.." && pwd)
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }
step() { echo; echo "== $*"; }

step "source"
git -c safe.directory="$SRC" -C "$SRC" log --oneline -1 2>/dev/null || echo "$SRC is not a git checkout (copied tree)"
[ -f "$SRC/landing/index.html" ] && [ -f "$SRC/demo/index.html" ] || { echo "landing/ or demo/ missing in $SRC"; exit 1; }

# Copy into a new folder and swap it in, so nginx never serves a half-copied tree.
publish() {
  local from=$1 name=$2
  rm -rf "$ROOT/$name.new" && cp -R "$from" "$ROOT/$name.new"
  [ -z "${3:-}" ] || sed -i "s#BUILDER_URL#$3#g" "$ROOT/$name.new/index.html"
  if grep -rq BUILDER_URL "$ROOT/$name.new"; then echo "BUILDER_URL left in $name"; exit 1; fi
  rm -rf "$ROOT/$name.old" && { [ -d "$ROOT/$name" ] && mv "$ROOT/$name" "$ROOT/$name.old" || true; } && mv "$ROOT/$name.new" "$ROOT/$name"
  chmod -R a+rX "$ROOT/$name"
}
mkdir -p $ROOT
step "product page: landing/ with the demo address filled in"
publish "$SRC/landing" landing https://sitecraftapp.luckye.online
step "workspace demo: demo/"
publish "$SRC/demo" demo

step "builder: stop and disable sitecraft-app, keep it installed"
if [ -f /etc/systemd/system/sitecraft-app.service ]; then
  install -m 644 $HERE/sitecraft-app.service /etc/systemd/system/sitecraft-app.service
  systemctl daemon-reload
  systemctl disable --now -q sitecraft-app
fi
echo "sitecraft-app: $(systemctl is-active sitecraft-app || true), $(systemctl is-enabled sitecraft-app 2>/dev/null || true)"

step "nginx: add sitecraft.conf only, test, reload"
install -m 644 $HERE/nginx-sitecraft.conf /etc/nginx/conf.d/sitecraft.conf
# A failing test removes our file again, so the owner's nginx is never left with a broken config.
nginx -t || { rm -f /etc/nginx/conf.d/sitecraft.conf; echo 'nginx -t failed; sitecraft.conf removed, nothing reloaded'; exit 1; }
nginx_pid=$(systemctl show --value -p MainPID nginx)
old_workers=$(pgrep -P "$nginx_pid" -f '^nginx: worker process') || { echo 'nginx has no worker before reload'; exit 1; }
systemctl reload nginx
# systemctl returns when the reload signal is sent. Old workers can still serve the previous
# proxy configuration until their graceful shutdown finishes; check only after they exit.
deadline=$((SECONDS + 15))
for worker in $old_workers; do
  while kill -0 "$worker" 2>/dev/null; do
    [ "$SECONDS" -lt "$deadline" ] || { echo "nginx old worker $worker did not exit after reload"; exit 1; }
    sleep 0.1
  done
done

step "smoke checks through nginx (as the tunnel would call it)"
curl -fs -o /dev/null -w "landing %{http_code}\n" -H 'Host: sitecraft.luckye.online' http://127.0.0.1/
curl -fs -o /dev/null -w "demo %{http_code}\n" -H 'Host: sitecraftapp.luckye.online' http://127.0.0.1/
curl -fs -o /dev/null -w "demo steps %{http_code}\n" -H 'Host: sitecraftapp.luckye.online' http://127.0.0.1/steps.json
curl -fs -o /dev/null -w "demo site package %{http_code}\n" -H 'Host: sitecraftapp.luckye.online' http://127.0.0.1/files/hexiang-xiaoguan-site.zip
api_status=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: sitecraftapp.luckye.online' http://127.0.0.1/api/health)
echo "builder api (expect 404) $api_status"
[ "$api_status" = 404 ] || { echo 'builder API is still reachable'; exit 1; }
unknown_exit=0
unknown_status=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: other.example' http://127.0.0.1/) || unknown_exit=$?
echo "unknown host (expect 000, empty reply) $unknown_status, curl exit $unknown_exit"
[ "$unknown_status" = 000 ] && [ "$unknown_exit" = 52 ] || { echo 'unknown host was not dropped by nginx'; exit 1; }
free -m
