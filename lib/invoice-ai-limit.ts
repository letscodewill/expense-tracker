// Local burst protection only. Configure provider project spend limits as well:
// this state is not shared between serverless instances and resets on restart.
const attempts = new Map<string, { count: number; start: number; busy: boolean }>()
export function reserveInvoiceAnalysis(userId: string, now = Date.now()) {
  for (const [id, entry] of attempts) if (now - entry.start >= 3600000 && !entry.busy) attempts.delete(id)
  const entry = attempts.get(userId) ?? { count: 0, start: now, busy: false }
  if (entry.busy || entry.count >= 10 || attempts.size >= 10000) return null
  entry.count++
  entry.busy = true
  attempts.set(userId, entry)
  return () => { entry.busy = false }
}
