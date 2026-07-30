import { describe, expect, it } from 'vitest'
import {
  LIMITS,
  WINDOW_MS,
  slidingCount,
  windowStart,
} from '@/lib/rateLimit'

describe('windowStart', () => {
  it('aligns to the window size', () => {
    expect(windowStart(0)).toBe(0)
    expect(windowStart(WINDOW_MS - 1)).toBe(0)
    expect(windowStart(WINDOW_MS)).toBe(WINDOW_MS)
    expect(windowStart(WINDOW_MS * 3 + 12_345)).toBe(WINDOW_MS * 3)
  })
})

describe('slidingCount', () => {
  it('counts the previous window fully at the boundary', () => {
    expect(slidingCount(30, 0, 0)).toBe(30)
  })

  it('ignores the previous window once the rolling minute has left it', () => {
    expect(slidingCount(30, 5, WINDOW_MS)).toBe(5)
  })

  it('weights the previous window by remaining overlap', () => {
    // Half the window elapsed: half the previous count still applies.
    expect(slidingCount(30, 10, WINDOW_MS / 2)).toBe(25)
  })

  it('stops a boundary burst a fixed window would allow', () => {
    // A client that used a full messages budget late in the previous window
    // cannot immediately spend a second full budget: early in the new window
    // the weighted previous count still occupies most of the limit.
    const limit = LIMITS.messages
    const justIntoNewWindow = slidingCount(limit, limit, WINDOW_MS / 10)
    expect(justIntoNewWindow).toBeGreaterThan(limit)
  })
})

describe('LIMITS', () => {
  it('keeps the documented ordering: typing loosest, upload tightest', () => {
    expect(LIMITS.typing).toBeGreaterThan(LIMITS.reactions)
    expect(LIMITS.reactions).toBeGreaterThan(LIMITS.messages)
    expect(LIMITS.messages).toBeGreaterThan(LIMITS.upload)
  })
})
