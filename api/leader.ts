import { handleLeader } from '../server/handler'

/** Vercel serverless entry. The key lives in the platform env, never in the bundle. */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }
  const ip = String(req.headers['x-forwarded-for'] ?? 'unknown').split(',')[0].trim()
  const result = await handleLeader(req.body, ip, {
    FEATHERLESS_API_KEY: process.env.FEATHERLESS_API_KEY,
    FEATHERLESS_MODEL: process.env.FEATHERLESS_MODEL,
  })
  res.status(result.status).json(result.body)
}
