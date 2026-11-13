# develop-test

Information website with an admin panel, built and maintained by **Dani Abdani** ([@abdani](https://github.com/abdani)).

A fully **serverless** web app on **Cloudflare Workers**: static pages served from the edge, a small JavaScript API Worker, and **Workers KV** for storage. No servers to manage, no frameworks, no build step.

## Highlights

- Serverless architecture on the Cloudflare tier (Workers + Workers KV)
- Vanilla JavaScript, HTML and CSS with zero dependencies
- Responsive from 320 px phones to desktop, with a web app manifest for home-screen install
- Strict Content Security Policy and hardened security headers
- Admin panel with roles, session control and an activity log
- Accessibility checked with axe-core (WCAG 2.1 AA)

## Structure

Every path is deployed as-is to its own Cloudflare Worker.

| Path | Deploy to | Contents |
|---|---|---|
| `UNTUK-UPLOAD/` | Public site | Pages, shared logic, styles, icons, fonts, security headers |
| `UNTUK-UPLOAD-ADMIN/` | Admin site | Admin panel with the same shared files |
| `worker-api.js` | API | Worker script backed by Workers KV |

## Deployment

1. Upload each folder (the folder itself, not its contents) to its Worker as static files.
2. Paste `worker-api.js` into the API Worker editor.
3. The API Worker needs a KV namespace binding and a write-token secret, set in the Cloudflare dashboard. Never commit the token.

This repository is not connected to Cloudflare; deployments are manual.
