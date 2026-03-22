/**
 * OS 이모지 휴지통 대신 — 굵은 스트로크 단순 실루엣 (가독성·명시성)
 */
export function TrashIcon(props: { size?: number; className?: string }): React.JSX.Element {
  const { size = 16, className } = props
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M4 7h16M9 7V5.5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 5.5V7M6 7v12.5A2 2 0 008 22h8a2 2 0 002-2V7M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
