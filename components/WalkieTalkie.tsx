export default function WalkieTalkie() {
  return (
    <svg
      width="36"
      height="34"
      viewBox="0 0 30 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <style>{`
        @keyframes wave {
          0%, 100% { opacity: 0; }
          40%, 60% { opacity: 1; }
        }
        .w1 { animation: wave 2s ease-in-out infinite; animation-delay: 0s; }
        .w2 { animation: wave 2s ease-in-out infinite; animation-delay: 0.35s; }
        .w3 { animation: wave 2s ease-in-out infinite; animation-delay: 0.7s; }
      `}</style>

      {/* Black walkie-talkie — behind, shifted right + down, slightly rotated clockwise */}
      <g transform="translate(4, 3) rotate(5, 8, 18)">
        {/* Antenna */}
        <rect x="5.5" y="0.5" width="3" height="8" rx="1.5" fill="#111111" />
        <circle cx="7" cy="0.5" r="1.5" fill="#080808" />
        {/* Body */}
        <rect x="1.5" y="7" width="13" height="22.5" rx="3" fill="#111111" />
        {/* PTT button hint */}
        <rect x="3.5" y="22" width="9" height="4" rx="1.5" fill="#000" opacity="0.6" />
      </g>

      {/* Yellow walkie-talkie — in front */}

      {/* Antenna */}
      <rect x="5.5" y="0.5" width="3" height="8" rx="1.5" fill="#FFE135" />
      <circle cx="7" cy="0.5" r="1.5" fill="#C9AB00" />

      {/* Body */}
      <rect x="1.5" y="7" width="13" height="22.5" rx="3" fill="#FFE135" />

      {/* Top ridge */}
      <rect x="1.5" y="7" width="13" height="2.5" rx="2" fill="#C9AB00" opacity="0.35" />

      {/* Speaker grille */}
      <rect x="4" y="11"   width="8" height="1.2" rx="0.6" fill="#8B7400" opacity="0.45" />
      <rect x="4" y="13.2" width="8" height="1.2" rx="0.6" fill="#8B7400" opacity="0.45" />
      <rect x="4" y="15.4" width="8" height="1.2" rx="0.6" fill="#8B7400" opacity="0.45" />

      {/* Status LED */}
      <circle cx="7" cy="19.5" r="1.3" fill="#22c55e" opacity="0.9" />

      {/* PTT button */}
      <rect x="3.5" y="22" width="9" height="4" rx="1.5" fill="#C9AB00" opacity="0.6" />
      <rect x="4.5" y="22.7" width="7" height="2.5" rx="1" fill="#FFE135" opacity="0.5" />

      {/* Bottom grip */}
      <rect x="4" y="27.5" width="8" height="1.2" rx="0.6" fill="#8B7400" opacity="0.3" />

      {/* Sound waves */}
      <path className="w1" d="M 16 15.5 A 3 3 0 0 1 16 21.5"     stroke="#FFE135" strokeWidth="1.8" strokeLinecap="round" />
      <path className="w2" d="M 18 13   A 5.5 5.5 0 0 1 18 24"   stroke="#FFE135" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <path className="w3" d="M 20.5 10.5 A 8 8 0 0 1 20.5 26.5" stroke="#FFE135" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}
