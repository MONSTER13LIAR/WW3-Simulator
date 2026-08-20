import { defineConfig, loadEnv, type Plugin } from 'vite'
import { handleLeader } from './server/handler'

/** Mounts the same /api/leader handler in dev that Vercel runs in production. */
function apiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'ww3-api',
    configureServer(server) {
      server.middlewares.use('/api/leader', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'method_not_allowed' }))
          return
        }
        let raw = ''
        req.on('data', c => { raw += c })
        req.on('end', async () => {
          let parsed: unknown = null
          try { parsed = JSON.parse(raw || '{}') } catch { /* handled below */ }
          const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'local')
          const result = await handleLeader(parsed, ip, {
            FEATHERLESS_API_KEY: env.FEATHERLESS_API_KEY,
            FEATHERLESS_MODEL: env.FEATHERLESS_MODEL,
          })
          res.statusCode = result.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result.body))
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // '' prefix loads every var, not just VITE_ — these stay server-side only.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [apiPlugin(env)],
    server: { port: 3000, strictPort: true, open: false },
  }
})
