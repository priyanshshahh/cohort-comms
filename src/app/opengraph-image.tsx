import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Cohort Comms — chat beside the Forth board'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Discord/Slack unfurl card for the landing and shared links. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: 'linear-gradient(135deg, #071210 0%, #0c1a17 50%, #14302b 100%)',
          color: '#e7f2ef',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: '#2dd4bf',
            fontWeight: 700,
          }}
        >
          Hult Cohort · Week 2
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2 }}>
            Cohort Comms
          </div>
          <div style={{ fontSize: 32, color: '#8aa8a1', maxWidth: 900 }}>
            Chat next to Forth — live ship webhook, threads, @mentions.
            No signup demo.
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            color: '#fbbf24',
            fontWeight: 600,
          }}
        >
          cohort-comms-phi.vercel.app/demo
        </div>
      </div>
    ),
    { ...size }
  )
}
