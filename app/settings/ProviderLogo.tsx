interface Props { id: string; size?: number }

export function ProviderLogo({ id, size = 14 }: Props) {
  const s = size
  const r = Math.round(s * 0.25)

  switch (id) {
    case 'anthropic':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14" fill="none" aria-label="Anthropic">
          <rect width="14" height="14" rx={r} fill="#CA6A50"/>
          <text x="7" y="10.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="white" fontFamily="system-ui,sans-serif">A</text>
        </svg>
      )
    case 'openai':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14" fill="none" aria-label="OpenAI">
          <rect width="14" height="14" rx={r} fill="#00A67E"/>
          <text x="7" y="10.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="white" fontFamily="system-ui,sans-serif">O</text>
        </svg>
      )
    case 'groq':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14" fill="none" aria-label="Groq">
          <rect width="14" height="14" rx={r} fill="#F55036"/>
          <text x="7" y="10.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="white" fontFamily="system-ui,sans-serif">G</text>
        </svg>
      )
    case 'google':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14" fill="none" aria-label="Google">
          <rect width="14" height="14" rx={r} fill="white" stroke="#e5e7eb"/>
          {/* Google G — four coloured arcs */}
          <text x="7" y="10.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#4285F4" fontFamily="system-ui,sans-serif">G</text>
        </svg>
      )
    case 'xai':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14" fill="none" aria-label="xAI Grok">
          <rect width="14" height="14" rx={r} fill="#111111"/>
          <text x="7" y="10.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="white" fontFamily="system-ui,sans-serif">X</text>
        </svg>
      )
    case 'perplexity':
      return (
        <svg width={s} height={s} viewBox="0 0 14 14" fill="none" aria-label="Perplexity">
          <rect width="14" height="14" rx={r} fill="#20B2AA"/>
          <text x="7" y="10.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="white" fontFamily="system-ui,sans-serif">P</text>
        </svg>
      )
    default:
      return null
  }
}
