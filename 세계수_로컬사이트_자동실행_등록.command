#!/bin/zsh
set -e

label="com.ahbbang.world-tree-local"
plist="$HOME/Library/LaunchAgents/$label.plist"
domain="gui/$(id -u)"

pkill -f 'python3 -m http.server 4173 --bind 127.0.0.1' 2>/dev/null || true
launchctl bootout "$domain/$label" 2>/dev/null || true
launchctl bootstrap "$domain" "$plist"
launchctl kickstart -k "$domain/$label"

for attempt in 1 2 3 4 5; do
  if curl -fsS --max-time 2 http://127.0.0.1:4173/ >/dev/null; then
    open http://127.0.0.1:4173/
    echo "세계수 로컬 사이트 자동 실행 등록이 완료되었습니다."
    read -k 1 '?이 창을 닫으려면 아무 키나 누르세요.'
    exit 0
  fi
  sleep 1
done

echo "자동 실행 항목은 등록되었지만 서버 응답을 확인하지 못했습니다."
read -k 1 '?이 창을 닫으려면 아무 키나 누르세요.'
exit 1
