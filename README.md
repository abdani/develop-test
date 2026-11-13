# develop-test

Information website with an admin panel, built and maintained by **Dani Abdani** ([@abdani](https://github.com/abdani)).

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
