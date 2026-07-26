import { describe, expect, it } from 'vitest'
import { extractForthLinks, FORTH_BASE_URL } from '../src/lib/forth'
import { dmKeyFor, isAdminHandle, parseScope, scopeKey } from '../src/lib/data'

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
