export function GaugeMark() {
  return (
    <svg
      aria-hidden="true"
      className="gauge-mark"
      fill="none"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 20 80 A 42 42 0 0 1 50 8"
        stroke="var(--color-steel)"
        strokeWidth="6"
      />
      <path
        d="M 50 8 A 42 42 0 0 1 80 80"
        stroke="var(--color-brass)"
        strokeWidth="6"
      />
      <circle cx="50" cy="50" fill="var(--color-ink)" r="4" />
      <line
        x1="50"
        x2="68"
        y1="50"
        y2="28"
        stroke="var(--color-ink)"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}
