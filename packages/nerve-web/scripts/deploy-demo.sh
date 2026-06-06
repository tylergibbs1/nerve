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
# One app, two aliases: deploy the same build to both Vercel projects so
# nerve-demo.vercel.app and nerve-site.vercel.app serve the same SPA.
vercel link --yes --project nerve-demo > /dev/null
vercel deploy --yes --prod
rm -rf .vercel
vercel link --yes --project nerve-site > /dev/null
vercel deploy --yes --prod
