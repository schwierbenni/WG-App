'use client'

import { usePathname } from 'next/navigation'

const LEAF_CONFIGS = [
  { left: 5,  dur: 9,  delay: 0,    size: 13 },
  { left: 15, dur: 12, delay: 2.5,  size: 10 },
  { left: 26, dur: 8,  delay: 1.0,  size: 14 },
  { left: 38, dur: 14, delay: 5.0,  size: 10 },
  { left: 52, dur: 10, delay: 3.0,  size: 15 },
  { left: 63, dur: 11, delay: 7.0,  size: 11 },
  { left: 74, dur: 9,  delay: 4.5,  size: 12 },
  { left: 84, dur: 13, delay: 1.5,  size: 13 },
  { left: 93, dur: 8,  delay: 6.0,  size: 10 },
  { left: 46, dur: 11, delay: 9.0,  size: 12 },
]

const CARD_CONFIGS = [
  { left: 7,  dur: 14, delay: 0,   suit: '♠', value: 'A',  red: false },
  { left: 22, dur: 17, delay: 5,   suit: '♥', value: 'K',  red: true  },
  { left: 38, dur: 12, delay: 2,   suit: '♦', value: 'J',  red: true  },
  { left: 53, dur: 16, delay: 8,   suit: '♣', value: 'Q',  red: false },
  { left: 68, dur: 13, delay: 3,   suit: '♠', value: 'J',  red: false },
  { left: 80, dur: 15, delay: 6,   suit: '♥', value: '10', red: true  },
  { left: 91, dur: 11, delay: 10,  suit: '♦', value: 'A',  red: true  },
]

function Leaf({ left, dur, delay, size }: { left: number; dur: number; delay: number; size: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '-40px',
        left: `${left}%`,
        animation: `bgLeafFall ${dur}s linear ${delay}s infinite`,
        willChange: 'transform, opacity',
      }}
    >
      <svg width={size} height={Math.round(size * 1.5)} viewBox="0 0 20 30" fill="none" aria-hidden="true">
        <path d="M10 29C10 29 1 19 1 10C1 4.5 5 1 10 1C15 1 19 4.5 19 10C19 19 10 29 10 29Z" fill="#4a7c59" opacity="0.8" />
        <path d="M10 2L10 28" stroke="#2e5e3e" strokeWidth="1.3" opacity="0.5" />
        <path d="M10 10L4 14M10 16L16 12" stroke="#2e5e3e" strokeWidth="0.9" opacity="0.4" />
      </svg>
    </div>
  )
}

function PlayingCard({ left, dur, delay, suit, value, red }: {
  left: number; dur: number; delay: number; suit: string; value: string; red: boolean
}) {
  const color = red ? '#c42d2d' : '#1a1710'
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '-60px',
        left: `${left}%`,
        animation: `bgCardFloat ${dur}s linear ${delay}s infinite`,
        opacity: 0,
        willChange: 'transform, opacity',
      }}
    >
      <svg width="34" height="48" viewBox="0 0 34 48" fill="none" aria-hidden="true">
        <rect x="0.5" y="0.5" width="33" height="47" rx="4" fill="white" stroke="#d0c8be" />
        <text x="4" y="14" fontSize="10" fontFamily="Georgia, 'Times New Roman', serif" fill={color} fontWeight="700">{value}</text>
        <text x="17" y="34" fontSize="16" fontFamily="Georgia, 'Times New Roman', serif" textAnchor="middle" fill={color}>{suit}</text>
      </svg>
    </div>
  )
}

function Tree({ x, height, delay, flip }: { x: number; height: number; delay: number; flip?: boolean }) {
  const width = Math.round(height * 0.55)
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: `${x}%`,
        width,
        height,
        animation: `bgTreeSway ${8 + delay}s ease-in-out ${delay * 0.6}s infinite`,
        transformOrigin: 'bottom center',
        transform: flip ? 'scaleX(-1)' : undefined,
        opacity: 0.18,
        willChange: 'transform',
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 66 140" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMax meet">
        <rect x="27" y="105" width="12" height="35" rx="3" fill="#5C4033" />
        <polygon points="33,8 60,68 6,68"   fill="#1e5c32" />
        <polygon points="33,32 63,88 3,88"  fill="#2e7d46" />
        <polygon points="33,56 66,108 0,108" fill="#3a8f52" />
      </svg>
    </div>
  )
}

function BeerFace({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      width="56"
      height="76"
      viewBox="-30 -35 60 84"
      overflow="visible"
      style={{ display: 'block', transform: flip ? 'scaleX(-1)' : undefined }}
      aria-hidden="true"
    >
      {/* Mug body */}
      <rect x="-20" y="-4" width="40" height="50" rx="8" fill="#F5C842" />
      {/* Foam crown — layered bubbles */}
      <ellipse cx="0"  cy="-11" rx="23" ry="14" fill="white" />
      <circle  cx="-12" cy="-21" r="10" fill="white" />
      <circle  cx="0"   cy="-25" r="11" fill="white" />
      <circle  cx="12"  cy="-20" r="9"  fill="white" />
      <ellipse cx="-19" cy="-28" rx="6" ry="8" fill="white" />
      <ellipse cx="0"   cy="-32" rx="6" ry="8" fill="white" />
      <ellipse cx="19"  cy="-27" rx="6" ry="7" fill="white" />
      {/* Eyes */}
      <circle cx="-7" cy="9"  r="4"   fill="#1a1710" />
      <circle cx="7"  cy="9"  r="4"   fill="#1a1710" />
      <circle cx="-5.5" cy="7.5" r="1.3" fill="white" />
      <circle cx="8.5"  cy="7.5" r="1.3" fill="white" />
      {/* Rosy cheeks */}
      <ellipse cx="-13" cy="17" rx="6" ry="5" fill="#F08080" opacity="0.5" />
      <ellipse cx="13"  cy="17" rx="6" ry="5" fill="#F08080" opacity="0.5" />
      {/* Smile */}
      <path d="M -9 23 Q 0 31 9 23" stroke="#1a1710" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Handle */}
      <path d="M 20 7 Q 34 7 34 23 Q 34 39 20 39" stroke="#D4A820" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* Arm raised toward partner for the toast */}
      <line x1="20" y1="26" x2="36" y2="6" stroke="#F5C842" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

function BeerPair() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '76px',
        right: '20px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: '0px',
        opacity: 0.2,
      }}
    >
      <div style={{ animation: 'bgBeerBob 3.4s ease-in-out infinite', willChange: 'transform' }}>
        <BeerFace />
      </div>

      {/* Clink sparkle between the two beers */}
      <div
        style={{
          marginBottom: '54px',
          marginLeft: '-6px',
          marginRight: '-6px',
          fontSize: '13px',
          lineHeight: 1,
          animation: 'bgClinkSpark 3.4s ease-in-out 0.8s infinite',
          position: 'relative',
          zIndex: 1,
        }}
      >
        ✨
      </div>

      <div style={{ animation: 'bgBeerBob 3.4s ease-in-out 0.6s infinite', willChange: 'transform' }}>
        <BeerFace flip />
      </div>
    </div>
  )
}

export function BackgroundAnimation() {
  const pathname = usePathname()
  const isGamesPage = pathname?.startsWith('/games')

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {/* Trees — left and right edges */}
      <Tree x={-3}  height={175} delay={0}   />
      <Tree x={3}   height={118} delay={1.6} />
      <Tree x={87}  height={160} delay={0.9} flip />
      <Tree x={93}  height={108} delay={2.3} flip />

      {/* Falling leaves */}
      {LEAF_CONFIGS.map((cfg, i) => (
        <Leaf key={i} {...cfg} />
      ))}

      {/* Cute beer duo toasting — bottom-right */}
      <BeerPair />

      {/* Games page: cards drifting upward */}
      {isGamesPage && CARD_CONFIGS.map((cfg, i) => (
        <PlayingCard key={i} {...cfg} />
      ))}
    </div>
  )
}
