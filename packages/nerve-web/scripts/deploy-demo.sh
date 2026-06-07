#!/usr/bin/env bash
# Build and deploy the editor demo to the nerve-demo Vercel project.
# vite build wipes dist/, so the project link is restored every run.
set -euo pipefail
cd "$(dirname "$0")/.."
bun run build
cat > dist/vercel.json <<'JSON'
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Link", "value": "</llms.txt>; rel=\"llms-txt\", </llms-full.txt>; rel=\"llms-full-txt\"" },
        { "key": "X-Llms-Txt", "value": "/llms.txt" }
      ]
    },
    {
      "source": "/docs/(.*).md",
      "headers": [
        { "key": "X-Robots-Tag", "value": "noindex, nofollow" },
        { "key": "Content-Type", "value": "text/markdown; charset=utf-8" }
      ]
    },
    {
      "source": "/llms(.*).txt",
      "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }]
    },
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
JSON
cd dist
# One app, two aliases: deploy the same build to both Vercel projects so
# nerve-demo.vercel.app and nerve-site.vercel.app serve the same SPA.
vercel link --yes --project nerve-demo > /dev/null
vercel deploy --yes --prod
rm -rf .vercel
vercel link --yes --project nerve-site > /dev/null
vercel deploy --yes --prod
