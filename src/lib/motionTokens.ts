/** Shared motion tokens — opacity/transform only (see motion-ui skill). */
export const motionTokens = {
  duration: {
    fast: 0.18,
    normal: 0.35,
  },
  easing: {
    smooth: [0.22, 1, 0.36, 1] as [number, number, number, number],
    sharp: [0.4, 0, 0.2, 1] as [number, number, number, number],
  },
  distance: {
    sm: 8,
    md: 16,
  },
}
