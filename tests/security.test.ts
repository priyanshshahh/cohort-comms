import { describe, expect, it } from 'vitest'
import {
  extractForthLinks,
  FORTH_BASE_URL,
  stripNonForthUrls,
} from '../src/lib/forth'
import {
  assertThreadRootReadable,
  dmKeyFor,
  ForbiddenError,
  isAdminHandle,
  parseScope,
  scopeKey,
} from '../src/lib/data'

/**
 * Adversarial tests, named by the attack they prevent rather than by the
 * function they call. Each corresponds to a boundary verified by hand against
 * production; encoding them here stops a refactor from silently reopening it.
 */

describe('Forth link handling', () => {
  it('renders a card for a genuine Forth URL', () => {
    const links = extractForthLinks(`See ${FORTH_BASE_URL}/chronicle`)
    expect(links).toHaveLength(1)
    expect(links[0].label).toContain('Chronicle')
    // Forth is a SPA — only `/` is live; view paths are rewritten.
    expect(links[0].url).toBe(`${FORTH_BASE_URL}/#chronicle`)
  })

  it('rewrites /board (404 on Forth) to the live root with a hash hint', () => {
    const links = extractForthLinks(`${FORTH_BASE_URL}/board`)
    expect(links).toHaveLength(1)
    expect(links[0].label).toContain('Realm Map')
    expect(links[0].url).toBe(`${FORTH_BASE_URL}/#board`)
  })

  it('refuses to card a lookalike domain', () => {
    // forth-bice.vercel.app.evil.com must not be treated as Forth.
    expect(extractForthLinks('https://forth-bice.vercel.app.evil.com/x')).toHaveLength(0)
  })

  it('refuses to card an unrelated host', () => {
    expect(extractForthLinks('https://evil.example.com/phish')).toHaveLength(0)
  })

  it('does not card a non-http scheme', () => {
    expect(extractForthLinks('javascript:alert(1)')).toHaveLength(0)
  })

  it('deduplicates a URL repeated in one message', () => {
    const body = `${FORTH_BASE_URL}/board and again ${FORTH_BASE_URL}/board`
    expect(extractForthLinks(body)).toHaveLength(1)
  })
})

describe('admin gating for #announcements', () => {
  it('grants only configured handles', () => {
    process.env.ADMIN_HANDLES = 'admin,priyanshshahh'
    expect(isAdminHandle('priyanshshahh')).toBe(true)
    expect(isAdminHandle('PriyanshShahh')).toBe(true) // case-insensitive
    expect(isAdminHandle('someone-else')).toBe(false)
  })

  it('denies empty, null, and whitespace handles', () => {
    process.env.ADMIN_HANDLES = 'admin'
    expect(isAdminHandle(null)).toBe(false)
    expect(isAdminHandle(undefined)).toBe(false)
    expect(isAdminHandle('')).toBe(false)
    expect(isAdminHandle('   ')).toBe(false)
  })

  it('does not grant admin by prefix or substring', () => {
    process.env.ADMIN_HANDLES = 'admin'
    expect(isAdminHandle('admin2')).toBe(false)
    expect(isAdminHandle('notadmin')).toBe(false)
  })
})

describe('conversation scoping', () => {
  it('derives the same DM key regardless of participant order', () => {
    expect(dmKeyFor('user_b', 'user_a')).toBe(dmKeyFor('user_a', 'user_b'))
  })

  it('rejects malformed and hostile scope strings', () => {
    expect(parseScope(null)).toBeNull()
    expect(parseScope('')).toBeNull()
    expect(parseScope('channel:')).toBeNull()
    expect(parseScope('bogus:general')).toBeNull()
    // A thread id must be a positive integer, never SQL or a float.
    expect(parseScope('thread:abc')).toBeNull()
    expect(parseScope('thread:-1')).toBeNull()
    expect(parseScope('thread:1;DROP TABLE messages')).toBeNull()
  })

  it('parses the three legitimate scopes', () => {
    expect(parseScope('channel:general')).toEqual({
      kind: 'channel',
      slug: 'general',
    })
    expect(parseScope('dm:user_123')).toEqual({
      kind: 'dm',
      otherUserId: 'user_123',
    })
    expect(parseScope('thread:42')).toEqual({ kind: 'thread', rootId: 42 })
  })

  it('keys a DM read-cursor to the pair, so it cannot collide across users', () => {
    const a = scopeKey({ kind: 'dm', otherUserId: 'user_b' }, 'user_a')
    const b = scopeKey({ kind: 'dm', otherUserId: 'user_a' }, 'user_b')
    expect(a).toBe(b)
    expect(a).not.toBe(scopeKey({ kind: 'dm', otherUserId: 'user_c' }, 'user_a'))
  })
})

/**
 * Reported independently by @gge513 (#5) and @zukhriddingit (#7): the thread
 * branch of `listMessages` selected by message id with no participation check,
 * so any signed-in account could enumerate the serial primary key and read
 * every DM in the cohort. The write path had the guard; the read path did not.
 *
 * Three users, as the review asked for: `alice` and `bob` share a DM, `mallory`
 * is a signed-in stranger.
 */
describe('DM thread read authorization', () => {
  const alice = 'user_alice'
  const bob = 'user_bob'
  const mallory = 'user_mallory'
  const dmRoot = { parentId: null, dmKey: dmKeyFor(alice, bob) }

  it('lets each participant read their own DM thread', () => {
    expect(() => assertThreadRootReadable(dmRoot, alice)).not.toThrow()
    expect(() => assertThreadRootReadable(dmRoot, bob)).not.toThrow()
  })

  it('refuses a non-participant reading a DM root by id', () => {
    expect(() => assertThreadRootReadable(dmRoot, mallory)).toThrow(
      ForbiddenError
    )
  })

  it('refuses a reply id, which would leak the whole sibling set', () => {
    const reply = { parentId: 41, dmKey: dmKeyFor(alice, bob) }
    expect(() => assertThreadRootReadable(reply, alice)).toThrow(ForbiddenError)
  })

  it('refuses an id that matches no message', () => {
    expect(() => assertThreadRootReadable(null, alice)).toThrow(ForbiddenError)
    expect(() => assertThreadRootReadable(undefined, alice)).toThrow(
      ForbiddenError
    )
  })

  it('still allows any member into a channel thread', () => {
    // Channel threads carry no dmKey; they are cohort-wide by design.
    expect(() =>
      assertThreadRootReadable({ parentId: null, dmKey: null }, mallory)
    ).not.toThrow()
  })

  it('does not grant access by handle substring inside the dm key', () => {
    // `user_alice` must not unlock a thread belonging to `user_alice2`.
    const other = { parentId: null, dmKey: dmKeyFor('user_alice2', bob) }
    expect(() => assertThreadRootReadable(other, alice)).toThrow(ForbiddenError)
  })
})

/**
 * Reported by @gge513 (#5): only `ticket.url` went through the Forth URL
 * policy. `ticket.title` (and, unreported, `status` and `assignee`) are
 * interpolated into the body, and the renderer auto-links bare URLs, so a
 * hostile link parked in a text field rendered as a live link wearing the
 * Forth bot's identity.
 */
describe('webhook free-text URL sanitization', () => {
  it('defangs a hostile URL hidden in a ticket title', () => {
    const out = stripNonForthUrls('Fix login https://evil.example.com/phish')
    expect(out).not.toContain('evil.example.com')
    expect(out).toContain('[link removed]')
  })

  it('defangs a lookalike Forth domain', () => {
    expect(
      stripNonForthUrls('https://forth-bice.vercel.app.evil.com/x')
    ).not.toContain('evil.com/x')
  })

  it('keeps a genuine Forth link intact', () => {
    expect(stripNonForthUrls(`See ${FORTH_BASE_URL}/board`)).toContain(
      FORTH_BASE_URL
    )
  })

  it('leaves text with no URLs untouched', () => {
    expect(stripNonForthUrls('Shipped the login fix')).toBe(
      'Shipped the login fix'
    )
  })
})
