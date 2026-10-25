/**
 * Lecvy brand lockup (rabbit mark + wordmark).
 *
 * PLACEHOLDER: the official Lecvy rabbit asset is not in this repository yet.
 * This is a temporary stand-in so the auth screens can be built and reviewed —
 * swap `RabbitMark` for the supplied asset as soon as it is provided. Nothing
 * else in the app needs to change: only this file renders the mark.
 */

type MarkProps = { size?: number }

function RabbitMark({ size = 52 }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Lecvy rabbit"
    >
      <rect width="64" height="64" rx="17" fill="#2878F0" />
      <g fill="#FFFFFF">
        <rect
          x="21.5"
          y="8"
          width="8.5"
          height="25"
          rx="4.25"
          transform="rotate(-9 25.75 20.5)"
        />
        <rect
          x="34"
          y="8"
          width="8.5"
          height="25"
          rx="4.25"
          transform="rotate(9 38.25 20.5)"
        />
        <circle cx="32" cy="40" r="15" />
      </g>
      <g fill="#2878F0">
        <circle cx="26.5" cy="38" r="2.3" />
        <circle cx="37.5" cy="38" r="2.3" />
        <ellipse cx="32" cy="43.2" rx="2.7" ry="2" />
      </g>
      <path
        d="M32 45.6c0 1.7-1.4 2.8-3.1 2.8M32 45.6c0 1.7 1.4 2.8 3.1 2.8"
        fill="none"
        stroke="#2878F0"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function BrandLogo({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const markSize = size === 'lg' ? 56 : 44
  return (
    <div className={`brand brand--${size}`}>
      <span className="brand__mark">
        <RabbitMark size={markSize} />
      </span>
      <span className="brand__word">Lecvy</span>
    </div>
  )
}
