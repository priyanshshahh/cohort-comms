/**
 * Forth is the cohort's project management platform (Project 1 winner).
 * Comms links out to it, and renders pasted Forth URLs as ticket cards so a
 * conversation about a ticket carries the ticket with it.
 *
 * Forth exposes no public REST API or webhooks, so the integration is
 * link-level plus shared GitHub identity rather than server-to-server.
 */
export const FORTH_BASE_URL = 'https://forth-bice.vercel.app'
export const FORTH_REPO_URL = 'https://github.com/CodingWCal/forth'

const FORTH_HOST = 'forth-bice.vercel.app'

export type ForthLink = {
  url: string
  /** The Forth view being linked to, e.g. "Realm Map", when recognisable. */
  label: string
}

/** Human labels for Forth's named views, so a card says what it points at. */
const VIEW_LABELS: Record<string, string> = {
  '': 'Forth',
  today: 'Quest Log (Today)',
  board: 'Realm Map (Board)',
  chronicle: 'Chronicle (Proof ledger)',
  guild: 'Guild Hall',
  hall: 'Guild Hall',
}

/**
 * Pull every Forth URL out of a message body, for rendering ticket cards
 * beneath the message text.
 */
export function extractForthLinks(body: string): ForthLink[] {
  const found: ForthLink[] = []
  const seen = new Set<string>()

  for (const match of body.matchAll(/https?:\/\/[^\s<>()]+/g)) {
    const raw = match[0].replace(/[.,;:]+$/, '')
    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      continue
    }
    if (parsed.host !== FORTH_HOST) continue
    if (seen.has(parsed.href)) continue
    seen.add(parsed.href)

    const segment = parsed.pathname.split('/').filter(Boolean)[0] ?? ''
    found.push({
      url: parsed.href,
      label: VIEW_LABELS[segment] ?? `Forth · ${segment}`,
    })
  }

  return found
}
