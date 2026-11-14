#!/bin/sh
# End-to-end smoke test of the server: shows, media, render, feed, backup. Needs ffmpeg + curl.
set -e
cd "$(dirname "$0")/.."
T=$(mktemp -d); export IPRPS_PODCAST_DATA=$T/data IPRPS_PODCAST_CONFIG=$T/cfg
P=${PORT:-18765}; B=http://127.0.0.1:$P
python3 server/studio.py --port $P --guest-port $((P+1)) >$T/log 2>&1 & PID=$!
trap 'kill $PID 2>/dev/null; rm -rf $T' EXIT
sleep 1
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1]))" "$1"; }
ffmpeg -v error -f lavfi -i "sine=frequency=440:duration=6" -f lavfi -i "testsrc=size=640x360:rate=30:duration=6" -c:v libvpx -b:v 600k -c:a libopus $T/a.webm
ffmpeg -v error -f lavfi -i "sine=frequency=660:duration=4" $T/b.mp3
ffmpeg -v error -f lavfi -i "color=c=purple:s=1400x1400:d=1" -frames:v 1 $T/cover.png
SID=$(curl -sf -X POST $B/api/shows -d '{"title":"Smoke Show","description":"A show used by the automated smoke test.","author":"Tester","ownerEmail":"t@example.com"}' | j "d['id']")
curl -sf -X POST "$B/api/shows/$SID/assets?name=cover.png&role=coverAsset" --data-binary @$T/cover.png >/dev/null
EID=$(curl -sf -X POST $B/api/shows/$SID/episodes -d '{"title":"Pilot"}' | j "d['id']")
M1=$(curl -sf -X POST "$B/api/shows/$SID/episodes/$EID/media?name=a.webm" --data-binary @$T/a.webm | j "d['id']")
M2=$(curl -sf -X POST "$B/api/shows/$SID/episodes/$EID/media?name=b.mp3" --data-binary @$T/b.mp3 | j "d['id']")
curl -sf -X POST $B/api/shows/$SID/episodes/$EID/place -d "{\"mediaId\":\"$M1\",\"track\":\"Host\",\"start\":0}" >/dev/null
curl -sf -X POST $B/api/shows/$SID/episodes/$EID/place -d "{\"mediaId\":\"$M2\",\"track\":\"Guest\",\"start\":3}" >/dev/null
curl -sf -X POST $B/api/shows/$SID/episodes/$EID/append -d '{"field":"chapters","item":{"t":2,"title":"Second bit"}}' >/dev/null
for F in mp3 mp4 audiogram m4a; do
  JID=$(curl -sf -X POST $B/api/shows/$SID/episodes/$EID/render -d "{\"format\":\"$F\",\"resolution\":\"480p\"}" | j "d['id']")
  while :; do S=$(curl -sf $B/api/jobs/$JID | j "d['status']+' '+d.get('error','')"); case "$S" in running*) sleep 0.5;; *) break;; esac; done
  echo "render $F: $S"; case "$S" in done*) ;; *) exit 1;; esac
done
curl -sf $B/api/shows/$SID/episodes/$EID | j "[(x['format'],round(x['duration'],1),x['size']) for x in d['exports']]"
curl -sf -X PUT $B/api/shows/$SID/episodes/$EID -d '{"published":true,"pubDate":1760000000000}' >/dev/null
curl -sf -X PUT $B/api/shows/$SID -d "{\"feed\":{\"publicBaseUrl\":\"https://example.com/pod\",\"deployMode\":\"folder\",\"deployFolder\":\"$T/www\"}}" >/dev/null
curl -sf -X POST $B/api/shows/$SID/publish | j "d['log']"
python3 -c "import xml.dom.minidom,sys; xml.dom.minidom.parse('$T/www/feed.xml'); print('feed.xml well-formed;', open('$T/www/feed.xml').read().count('<item>'), 'item')"
ls $T/www $T/www/media
curl -sf $B/api/shows/$SID/feed | j "[c['msg'] for c in d['checks'] if not c['ok']]"
BK=$(curl -sf -X POST $B/api/shows/$SID/backup -d '{}' | j "d['name']")
curl -sf -X POST "$B/api/backups/$BK/restore" | j "'restored as: '+d['title']"
curl -s -o /dev/null -w "host API via guest port: %{http_code}\n" -k https://127.0.0.1:$((P+1))/api/shows
curl -s -o /dev/null -w "bad invite: %{http_code}\n" -k "https://127.0.0.1:$((P+1))/g/info?sid=$SID&eid=$EID&t=nope"
curl -s -o /dev/null -w "cross-site: %{http_code}\n" -H "Origin: https://evil.example" $B/api/shows
echo OK
