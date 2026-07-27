/**
 * Forth is the cohort's project management platform (Project 1 winner).
 * Comms links out to it, and renders pasted Forth URLs as ticket cards so a
 * conversation about a ticket carries the ticket with it.
 *
 * Forth exposes no public REST API or webhooks, so the integration is
 * link-level plus shared GitHub identity rather than server-to-server.
 *
 * Important: Forth is a single-route SPA (`/`). Client views (board, today,
 * proof, settings) are React state — paths like `/board` return 404 on the
 * host. Deep-link cards therefore open the live root and label the intended
 * view so members land somewhere that works.
 */
export const FORTH_BASE_URL = 'https://forth-bice.vercel.app'
export const FORTH_REPO_URL = 'https://github.com/CodingWCal/forth'

const FORTH_HOST = 'forth-bice.vercel.app'

export type ForthLink = {
  url: string
  /** The Forth view being linked to, e.g. "Realm Map", when recognisable. */
  label: string
}

/**
 * Human labels for Forth's in-app views. Keys match path segments people
 * paste (or that we seed in demos); the live app does not route them.
 */
const VIEW_LABELS: Record<string, string> = {
  '': 'Forth',
  today: 'Quest Log (Today)',
  board: 'Realm Map (Board)',
  chronicle: 'Chronicle (Proof ledger)',
  proof: 'Chronicle (Proof ledger)',
  guild: 'Guild Hall',
  hall: 'Guild Hall',
  settings: 'Guild Hall',
}

/**
 * Forth only serves `/`. Rewrite view-ish paths to the working origin, keep a
 * hash hint (`#board`) for humans / future hash routing, and preserve label.
 */
export function normalizeForthUrl(raw: string): ForthLink | null {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.host !== FORTH_HOST) return null

  const segment = parsed.pathname.split('/').filter(Boolean)[0] ?? ''
  const label = VIEW_LABELS[segment] ?? (segment ? `Forth · ${segment}` : 'Forth')

  // Always open the live app root — `/board` etc. are 404 on production Forth.
  const url =
    segment && segment in VIEW_LABELS && segment !== ''
      ? `${FORTH_BASE_URL}/#${segment}`
      : `${FORTH_BASE_URL}/`

  return { url, label }
}

/**
 * Defang every non-Forth URL in a string, keeping genuine Forth links.
 *
 * Webhook payloads carry free text (title, status, assignee) that we
 * interpolate into a message body, and the renderer auto-links any bare URL it
 * finds. Sanitizing only `ticket.url` therefore left a hole: a sender holding
 * the shared secret could park a phishing link in `ticket.title` and have it
 * render as a live link wearing the Forth bot's identity. Anything that is not
 * Forth is replaced rather than dropped, so the message still reads honestly.
 */
export function stripNonForthUrls(text: string): string {
  return text.replace(/https?:\/\/[^\s<>()]+/g, (raw) => {
    const trailing = raw.match(/[.,;:]+$/)?.[0] ?? ''
    const bare = trailing ? raw.slice(0, -trailing.length) : raw
    const link = normalizeForthUrl(bare)
    return (link ? link.url : '[link removed]') + trailing
  })
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
    const link = normalizeForthUrl(raw)
    if (!link) continue
    if (seen.has(link.url + link.label)) continue
    seen.add(link.url + link.label)
    found.push(link)
  }

  return found
}
