// Relay بسيط لطلبات كاشير ichancy، يُشغَّل على VPS أو أي منصة استضافة.
// نسخة النشر: مطابقة لـ tools/cashier-relay.mjs + مسار تشخيص /whoami فقط.
import http from 'node:http'

const PORT = Number(process.env.PORT || 8080)
const RELAY_KEY = String(process.env.RELAY_KEY || '').trim()
const CASHIER_BASE = String(process.env.CASHIER_BASE || 'https://agents.ichancy100.com/global/api/').replace(/\/+$/, '') + '/'
const ALLOWED = /^(core|User|UserApi|Agent|Player|Statistics)\/[A-Za-z]+$/
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

if (!RELAY_KEY) {
  console.error('RELAY_KEY is required')
  process.exit(1)
}

const server = http.createServer(async (req, res) => {
  const started = Date.now()
  try {
    if (req.method === 'GET' && (req.url === '/health' || req.url === '/' || req.url === '/healthz')) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, service: 'cashier-relay', uptime: Math.round(process.uptime()) }))
      return
    }
    // تشخيص فقط: عنوان الخروج الذي يراه العالم (لا يمس الكاشير ولا يكشف أسراراً).
    if (req.method === 'GET' && req.url === '/whoami') {
      try {
        const r = await fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(10000) })
        const txt = await r.text()
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(txt)
      } catch (e) {
        res.writeHead(502, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'whoami_failed', message: String(e?.message || e) }))
      }
      return
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'method_not_allowed' }))
      return
    }
    if (String(req.headers['x-cashier-proxy-key'] || '') !== RELAY_KEY) {
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'unauthorized' }))
      return
    }
    const path = new URL(req.url || '/', 'http://relay').pathname.replace(/^\/+/, '')
    if (!ALLOWED.test(path)) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'path_not_allowed' }))
      return
    }

    const chunks = []
    for await (const c of req) chunks.push(c)
    const body = Buffer.concat(chunks)

    const upstream = await fetch(CASHIER_BASE + path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/plain, */*',
        'accept-language': 'ar,en-US;q=0.9,en;q=0.8',
        origin: 'https://agents.ichancy100.com',
        referer: 'https://agents.ichancy100.com/',
        'user-agent': UA,
        ...(req.headers.cookie ? { cookie: String(req.headers.cookie) } : {}),
        ...(req.headers.authorization ? { authorization: String(req.headers.authorization) } : {})
      },
      body,
      signal: AbortSignal.timeout(45000)
    })

    const buf = Buffer.from(await upstream.arrayBuffer())
    const headers = { 'content-type': upstream.headers.get('content-type') || 'application/json' }
    const setCookie = upstream.headers.getSetCookie?.() || []
    if (setCookie.length) headers['set-cookie'] = setCookie
    res.writeHead(upstream.status, headers)
    res.end(buf)
    console.log(`${path} ${upstream.status} ${Date.now() - started}ms ${buf.length}b`)
  } catch (e) {
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'relay_failed', message: String(e?.message || e) }))
  }
})

server.listen(PORT, '0.0.0.0', () => console.log(`cashier relay listening on :${PORT}`))
