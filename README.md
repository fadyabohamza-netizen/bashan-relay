# bashan-relay

Stateless relay for the ichancy cashier API (`core/getData`, `User/*`, ...), used when Cloudflare Workers are blocked by the cashier WAF.

- Forwards the bot's own cookie / bearer token upstream. It stores nothing.
- Requires env `RELAY_KEY`; every POST must send header `x-cashier-proxy-key`.
- `GET /health` — liveness.
- `GET /whoami` — egress IP/country (diagnostics only).
- Optional env `CASHIER_BASE` (default `https://agents.ichancy100.com/global/api/`).

Deploy: any Docker host. `PORT` defaults to 8080.

This repository contains no secrets.
