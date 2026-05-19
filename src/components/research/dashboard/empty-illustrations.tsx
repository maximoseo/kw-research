'use client';

/**
 * Premium SVG illustrations for empty states.
 * Matches the KW Research visual language: minimal, geometric, accent-colored.
 */

export function NoProjectIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="160"
      height="120"
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Background circle */}
      <circle cx="80" cy="55" r="44" className="fill-accent/[0.04] stroke-accent/[0.08]" strokeWidth="1.5" />
      {/* Compass outer ring */}
      <circle cx="80" cy="55" r="28" className="stroke-accent/20" strokeWidth="2" fill="none" />
      {/* Compass inner marks */}
      <path d="M80 27v8M80 75v8M52 55h8M100 55h8" className="stroke-accent/30" strokeWidth="1.5" strokeLinecap="round" />
      {/* Compass needle */}
      <path
        d="M80 42L87 55L80 68L73 55Z"
        className="fill-accent/60"
      />
      <circle cx="80" cy="55" r="3" className="fill-accent" />
      {/* Directional dots */}
      <circle cx="80" cy="31" r="2.5" className="fill-accent/20" />
      <circle cx="80" cy="79" r="2.5" className="fill-accent/10" />
      <circle cx="56" cy="55" r="2.5" className="fill-accent/10" />
      <circle cx="104" cy="55" r="2.5" className="fill-accent/10" />
      {/* Bottom grid hints */}
      <rect x="28" y="98" width="12" height="8" rx="2" className="fill-accent/[0.06]" />
      <rect x="44" y="98" width="28" height="8" rx="2" className="fill-accent/[0.08]" />
      <rect x="76" y="98" width="56" height="8" rx="2" className="fill-accent/[0.06]" />
    </svg>
  );
}

export function NoRunsIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="160"
      height="120"
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Background circle */}
      <circle cx="80" cy="52" r="44" className="fill-accent/[0.04] stroke-accent/[0.08]" strokeWidth="1.5" />
      {/* Launchpad base */}
      <rect x="56" y="88" width="48" height="6" rx="3" className="fill-accent/10" />
      <rect x="62" y="82" width="36" height="6" rx="2" className="fill-accent/[0.06]" />
      {/* Rocket body */}
      <path
        d="M80 40c-6 0-11 4-11 10v20c0 3 2 6 4 8l2 3h10l2-3c2-2 4-5 4-8V50c0-6-5-10-11-10z"
        className="fill-accent/20 stroke-accent/30"
        strokeWidth="1.5"
      />
      {/* Rocket window */}
      <circle cx="80" cy="54" r="4" className="fill-surface stroke-accent/40" strokeWidth="1.5" />
      {/* Rocket fins */}
      <path
        d="M69 74L63 84l6-4v-6zM91 74l6 10-6-4v-6z"
        className="fill-accent/15 stroke-accent/25"
        strokeWidth="1"
      />
      {/* Exhaust / anticipation dots */}
      <circle cx="76" cy="96" r="2" className="fill-accent/20" />
      <circle cx="80" cy="100" r="1.5" className="fill-accent/12" />
      <circle cx="84" cy="96" r="2" className="fill-accent/20" />
      {/* Stars */}
      <circle cx="45" cy="28" r="1.5" className="fill-accent/15" />
      <circle cx="118" cy="32" r="1.5" className="fill-accent/12" />
      <circle cx="105" cy="22" r="1" className="fill-accent/10" />
      <circle cx="52" cy="38" r="1" className="fill-accent/10" />
    </svg>
  );
}

export function NoResultsIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="160"
      height="120"
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Background circle */}
      <circle cx="80" cy="50" r="44" className="fill-accent/[0.04] stroke-accent/[0.08]" strokeWidth="1.5" />
      {/* Document / report */}
      <rect x="52" y="26" width="56" height="70" rx="5" className="fill-surface stroke-accent/15" strokeWidth="1.5" />
      {/* Document lines */}
      <rect x="62" y="38" width="36" height="3" rx="1.5" className="fill-accent/12" />
      <rect x="62" y="46" width="28" height="3" rx="1.5" className="fill-accent/10" />
      <rect x="62" y="54" width="32" height="3" rx="1.5" className="fill-accent/10" />
      <rect x="62" y="62" width="20" height="3" rx="1.5" className="fill-accent/08" />
      <rect x="62" y="70" width="24" height="3" rx="1.5" className="fill-accent/08" />
      {/* Magnifying glass over document */}
      <circle cx="102" cy="66" r="16" className="stroke-accent/30" strokeWidth="2" fill="none" />
      <path d="M113.5 77.5L124 88" className="stroke-accent/30" strokeWidth="2.5" strokeLinecap="round" />
      {/* No-data indicator */}
      <circle cx="102" cy="66" r="8" className="fill-accent/08" />
      <path d="M97 66h10" className="stroke-accent/25" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
