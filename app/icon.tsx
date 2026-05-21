import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d2819',
          borderRadius: '6px',
        }}
      >
        <div style={{ color: '#b0cfba', fontSize: 20, fontWeight: 800, fontFamily: 'sans-serif' }}>
          F
        </div>
      </div>
    ),
    { ...size }
  )
}
