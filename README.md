# n8n-nodes-bluesky

![Status](https://img.shields.io/badge/status-proof--of--concept-yellow)
![Maintenance](https://img.shields.io/badge/maintained-no-red)

**⚠️ Use at your own risk** - Weekend project. Works, but zero guarantees.

Search Bluesky posts from n8n workflows.

## Install

```bash
npm install n8n-nodes-bluesky
```

Restart n8n.

## Setup

1. n8n → **Credentials** → **Bluesky App Password**
2. Add your handle + [app password](https://bsky.app/settings/app-passwords)

## Use

Add **Bluesky Search** node to workflow:
- **Query**: Search terms
- **Limit**: Max results (1-100)
- **Sort**: Latest or Top
- **Filters**: Author, domain, date range, etc.

## Example

```
Schedule → Bluesky Search (query: "n8n") → Email
```

## Test Locally

```bash
git clone <repo>
cd n8n-nodes-bluesky
npm install
npm run build

# Test API
BLUESKY_HANDLE=you.bsky.social BLUESKY_PASSWORD=xxxx npm test

# Run n8n with node
npm run dev  # http://localhost:3000
```

## License

MIT - Do whatever you want, no warranties.
