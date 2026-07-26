import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Cohort Comms live demo — no signup'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function DemoOpenGraphImage() {
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
          background: 'linear-gradient(135deg, #071210 0%, #0f766e 120%)',
          color: '#e7f2ef',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 28,
            fontWeight: 700,
            color: '#04211d',
            background: '#2dd4bf',
            padding: '10px 20px',
            borderRadius: 12,
            width: 'fit-content',
          }}
        >
          LIVE DEMO · NO SIGNUP
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 64, fontWeight: 700 }}>Try it in 60 seconds</div>
          <div style={{ fontSize: 30, color: '#ccfbf1', maxWidth: 950, lineHeight: 1.35 }}>
            1. Spot the WEBHOOK message · 2. Open a thread · 3. Post something ·
            4. Open the Forth board beside chat
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: '#fbbf24' }}>
          cohort-comms-phi.vercel.app/demo
        </div>
      </div>
    ),
    { ...size }
  )
}
