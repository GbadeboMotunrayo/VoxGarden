#!/usr/bin/env bash
# One-time (and safe to re-run) local setup for VoxGarden.
# Checks tools, creates engine secrets, starts Icecast, downloads the playout image.
set -euo pipefail
cd "$(dirname "$0")/.."

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }

echo "VoxGarden setup"

# 1. Tools
command -v node >/dev/null || fail "Node.js not found. Install Node 24 or newer: https://nodejs.org"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 24 ] || fail "Node $NODE_MAJOR found, but VoxGarden needs Node 24 or newer (built-in SQLite and TypeScript)."
ok "Node $(node -v)"

command -v docker >/dev/null || fail "Docker not found. Install Docker Desktop (Mac/Windows) or Docker Engine (Linux)."
docker info >/dev/null 2>&1 || fail "Docker is installed but not running. Start Docker Desktop, then run this again."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 not found (the 'docker compose' command)."
ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null)"

# 2. Engine secrets (git-ignored). Kept if they already exist.
if [ ! -f engine/.env ]; then
  node -e '
    const r = () => require("crypto").randomBytes(15).toString("base64url");
    require("fs").writeFileSync("engine/.env", `ICECAST_SOURCE_PASSWORD=${r()}\nICECAST_ADMIN_PASSWORD=${r()}\n`, { mode: 0o600 });'
  ok "Created engine/.env with new random passwords"
else
  ok "engine/.env already exists (kept)"
fi
mkdir -p data engine/media engine/generated

# 3. Shared Icecast server
docker compose -f engine/docker-compose.yml --progress quiet up -d --remove-orphans
ok "Icecast running on http://localhost:8000"

# 4. Playout image (about 1 GB, first time only). Pulled now so the first upload isn't slow.
LIQ_IMAGE=$(node -p 'require("fs").readFileSync("apps/control/src/engine.ts","utf8").match(/IMAGE = .([^\x27]+)/)[1]')
if docker image inspect "$LIQ_IMAGE" >/dev/null 2>&1; then
  ok "Playout image $LIQ_IMAGE already downloaded"
else
  echo "  … downloading $LIQ_IMAGE (about 1 GB, one time)"
  docker pull "$LIQ_IMAGE" >/dev/null
  ok "Downloaded $LIQ_IMAGE"
fi

echo
echo "Setup done. Start VoxGarden with:  npm start"
echo "Then open http://localhost:4000"
