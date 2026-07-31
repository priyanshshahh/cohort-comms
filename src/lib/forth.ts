/**
 * Forth is the cohort's project management platform (Project 1 winner).
 * Comms links out to it, and renders pasted Forth URLs as ticket cards so a
 * conversation about a ticket carries the ticket with it.
 *
 * Forth's outbound ship webhook is owned by Forth; this app is the receiver
 * plus link-level cards and an embedded board. No shared auth or database.
 *
 * Important: Forth is a single-route SPA (`/`). Client views (board, today,
 * proof, settings) are React state — paths like `/board` return 404 on the
 * host. Deep-link cards therefore open the live root with an allowlisted hash
 * (`/#board`, `/#proof`) so members land on a view that works.
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
 * Human labels for Forth's in-app views. Keys match path segments and hash
 * routes people paste (or that Forth's webhook delivers).
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
 * Forth only serves `/`. Rewrite view-ish paths to the working origin and
 * preserve allowlisted hashes (`#proof`, `#board`) instead of collapsing to
 * the bare root — Calvin's ship webhook sends `/#proof` on purpose.
 */
export function normalizeForthUrl(raw: string): ForthLink | null {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.host !== FORTH_HOST) return null

  const pathSegment = parsed.pathname.split('/').filter(Boolean)[0] ?? ''
  const hashSegment = parsed.hash.replace(/^#/, '').split(/[/?]/)[0] ?? ''
  const view = pathSegment || hashSegment
  const label =
    VIEW_LABELS[view] ?? (view ? `Forth · ${view}` : 'Forth')

  if (view && view in VIEW_LABELS && view !== '') {
    return { url: `${FORTH_BASE_URL}/#${view}`, label }
  }

  return { url: `${FORTH_BASE_URL}/`, label: 'Forth' }
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
