#!/usr/bin/env bash
# Build and deploy the editor demo to the nerve-demo Vercel project.
# vite build wipes dist/, so the project link is restored every run.
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm build
cat > dist/vercel.json <<'JSON'
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
JSON
cd dist
vercel link --yes --project nerve-demo > /dev/null
vercel deploy --yes --prod
