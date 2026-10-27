#!/usr/bin/env bash
# Stops every station's playout process and the shared Icecast server.
# Your data (accounts, stations, audio) stays in data/ and engine/media/.
set -euo pipefail
cd "$(dirname "$0")/.."

ids=$(docker ps -aq --filter label=voxgarden.station)
if [ -n "$ids" ]; then
  docker rm -f $ids >/dev/null
  echo "Stopped $(echo "$ids" | wc -l | tr -d ' ') station process(es)"
fi
docker compose -f engine/docker-compose.yml down >/dev/null
echo "Stopped Icecast. Run 'npm start' again later; stations come back on their own."
