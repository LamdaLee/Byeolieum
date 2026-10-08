export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 13 12 35C26 16 52 25 50 40 47 58 17 56 12 35"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="18" cy="13" r="5" fill="currentColor" />
      <circle cx="12" cy="35" r="5" fill="currentColor" />
      <circle cx="50" cy="40" r="5" fill="currentColor" />
      <circle cx="31" cy="53" r="5" fill="currentColor" />
      <path d="m46 4 2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="currentColor" />
    </svg>
  );
}
