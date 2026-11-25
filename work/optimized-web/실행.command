#!/bin/zsh
set -eu
cd -- "${0:A:h}"
site_url='http://127.0.0.1:4173/'
if curl -fsS --max-time 1 "$site_url" 2>/dev/null | grep -q '<title>세계수 봉헌의식</title>'; then
  exec open "$site_url"
fi
exec python3 - <<'PY'
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import subprocess
from threading import Timer

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

url = "http://127.0.0.1:4173/"
with ThreadingHTTPServer(("127.0.0.1", 4173), Handler) as server:
    print(f"세계수 봉헌의식 · {url}", flush=True)
    Timer(.3, lambda: subprocess.run(["open", url], check=False)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
PY
