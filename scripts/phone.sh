#!/usr/bin/env bash
# Runs VoxGarden over HTTPS on your Wi-Fi so phones can listen and record.
# Browsers only allow the microphone on secure (https://) pages.
#
# Creates (once) a small local certificate authority in data/certs/. Install its
# ca.crt on each test phone once, and the phone will trust this computer's HTTPS.
# Only plain HTTP on this computer and HTTPS on port 4443 are opened; nothing is
# published to the internet.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v openssl >/dev/null || { echo "openssl not found. Install it (macOS has it; Ubuntu: sudo apt install openssl)."; exit 1; }
[ -f engine/.env ] || { echo "Run 'npm run setup' first."; exit 1; }

# This computer's address on the Wi-Fi (skips Docker and VPN interfaces). Override with VG_LAN_IP=…
IP="${VG_LAN_IP:-$(node -e '
  const nets = require("os").networkInterfaces();
  const skip = /^(docker|br-|veth|virbr|lo|tun|tap|utun|zt|tailscale|wg)/;
  const ips = Object.entries(nets).filter(([n]) => !skip.test(n))
    .flatMap(([, a]) => a).filter((a) => a.family === "IPv4" && !a.internal).map((a) => a.address);
  console.log(ips.find((ip) => /^(192\.168|10\.)/.test(ip)) || ips[0] || "");')}"
[ -n "$IP" ] || { echo "Could not find this computer's Wi-Fi address. Set it: VG_LAN_IP=192.168.x.x npm run phone"; exit 1; }

DIR=data/certs
mkdir -p "$DIR"
chmod 700 "$DIR"

# 1. Local certificate authority (created once, so phones only install it once).
if [ ! -f "$DIR/ca.key" ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 825 \
    -keyout "$DIR/ca.key" -out "$DIR/ca.crt" -subj "/CN=VoxGarden Local Testing CA ($(hostname))" \
    -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null
  chmod 600 "$DIR/ca.key"
  echo "Created a local certificate authority: $DIR/ca.crt (install this on test phones)"
fi

# 2. Server certificate for this computer's current address (re-made each run, since Wi-Fi addresses change).
cat > "$DIR/server.ext" <<EXT
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$IP
EXT
openssl req -newkey rsa:2048 -nodes -keyout "$DIR/server.key" -out "$DIR/server.csr" -subj "/CN=$IP" 2>/dev/null
openssl x509 -req -in "$DIR/server.csr" -CA "$DIR/ca.crt" -CAkey "$DIR/ca.key" -CAcreateserial \
  -out "$DIR/server.crt" -days 397 -sha256 -extfile "$DIR/server.ext" 2>/dev/null
chmod 600 "$DIR/server.key"
rm -f "$DIR/server.csr"

URL="https://$IP:4443"
cat <<MSG

  VoxGarden phone testing
  -----------------------
  On this computer: http://localhost:4000
  On a phone (same Wi-Fi): $URL

  First time on each phone, install the testing certificate:
    1. Open $URL/ca.crt on the phone. The browser warns the page isn't
       private: tap Advanced, then Proceed. The file downloads.
    2. Android: Settings > Security > Encryption & credentials > Install a
       certificate > CA certificate > pick voxgarden-local-ca.crt.
       iPhone: Settings > Profile Downloaded > Install, then Settings >
       General > About > Certificate Trust Settings > turn it on.
    3. Open $URL again. No warning means it worked.

  Remove the certificate from the phone when testing is over.

MSG

docker compose -f engine/docker-compose.yml --progress quiet up -d
VG_HOST=127.0.0.1 VG_HTTPS_HOST=0.0.0.0 VG_HTTPS_PORT=4443 VG_PUBLIC_BASE="$URL" exec node apps/control/src/server.ts
