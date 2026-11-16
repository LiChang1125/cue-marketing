#!/usr/bin/env bash
set -euo pipefail
umask 077
children=()
app_pid=""
cleanup() {
  # Let Chromium flush its login profile while the X display is still alive.
  if [ -n "$app_pid" ]; then
    kill -TERM "$app_pid" 2>/dev/null || true
    wait "$app_pid" 2>/dev/null || true
  fi
  for pid in "${children[@]}"; do kill -TERM "$pid" 2>/dev/null || true; done
  wait || true
}
trap cleanup EXIT
trap 'exit 0' TERM INT
Xvfb :99 -screen 0 1440x1000x24 -nolisten tcp & children+=("$!")
for attempt in $(seq 1 30); do [ -S /tmp/.X11-unix/X99 ] && break; sleep 0.2; done
openbox >/tmp/cue-window-manager.log 2>&1 & children+=("$!")
if [ -n "${VNC_PASSWORD:-}" ]; then
  x11vnc -storepasswd "$VNC_PASSWORD" /tmp/cue-vnc-pass >/dev/null
  x11vnc -display :99 -localhost -rfbport 5900 -rfbauth /tmp/cue-vnc-pass -forever -shared >/tmp/cue-vnc.log 2>&1 & children+=("$!")
  websockify --web=/usr/share/novnc/ 6080 127.0.0.1:5900 >/tmp/cue-novnc.log 2>&1 & children+=("$!")
fi
node --env-file-if-exists=.env server/index.js & app_pid="$!"; children+=("$app_pid")
# Restart the container if its app or display fails, rather than leaving a
# reachable but permanently stalled collector.
wait -n "${children[@]}"
exit 1
