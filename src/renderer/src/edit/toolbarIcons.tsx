/**
 * 편집 툴바·히스토리용 단색 라인 아이콘 (stroke, currentColor)
 */
const stroke = 1.75

export function IconToolbarEmoji(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={stroke} />
      <path
        d="M8.5 14.5c1.2 1.2 2.8 1.8 4.5 1.5 1.2-.2 2.3-.8 3.2-1.7"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <circle cx="9" cy="10" r="1.1" fill="currentColor" />
      <circle cx="15" cy="10" r="1.1" fill="currentColor" />
    </svg>
  )
}

/** 텍스트 편집 — A + 밑줄 */
export function IconToolbarFormat(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path d="M7 17L12 5l5 12" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 13h6" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
      <path d="M5 20h14" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  )
}

/** 더보기 — 가로 점 세 개 (형광펜·메모 링크 등) */
export function IconToolbarMore(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <circle cx="5" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="19" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}

export function IconToolbarBold(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" className={props.className} aria-hidden>
      <text
        x="12"
        y="12"
        dominantBaseline="central"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="14"
        fontWeight="700"
      >
        B
      </text>
    </svg>
  )
}

/** 취소선 — 밑줄(U)과 동일한 U자 + 가로 취소선 */
export function IconToolbarStrikethrough(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path d="M8 4v7a4 4 0 008 0V4" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
      <path d="M6 9.25h12" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  )
}

export function IconToolbarUnderline(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path d="M8 4v7a4 4 0 008 0V4" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
      <path d="M6 20h12" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  )
}

/** 메모 간 링크 (체인 두 고리) */
export function IconToolbarMemoLink(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M9 12a5 5 0 017.07-4.95M15 12a5 5 0 01-7.07 4.95"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <path d="M7 17h-.5a3.5 3.5 0 010-7H8M17 7h.5a3.5 3.5 0 010 7H16" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  )
}

export function IconToolbarHighlight(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M5 18h8l8-8a2 2 0 000-2.8l-2.4-2.4a2 2 0 00-2.8 0L8 15v3z"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinejoin="round"
      />
      <path d="M13 7l4 4" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  )
}

export function IconToolbarCheckbox(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth={stroke} />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconToolbarDivider(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <rect x="5" y="4" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth={1.15} />
      <path d="M4.5 17.75h15" stroke="currentColor" strokeWidth={2.55} strokeLinecap="round" />
    </svg>
  )
}

/** 클립보드 히스토리 — 클립보드+시계 */
export function IconClipboard(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path d="M9.5 2h5a.5.5 0 01.5.5V4h-6V2.5a.5.5 0 01.5-.5z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
      <path d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
      <circle cx="17" cy="17" r="4.5" fill="white" stroke="currentColor" strokeWidth={1.6} />
      <path d="M17 15v2.5l1.5 1" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 전체 복사 — 겹친 문서 (범용 복사 아이콘) */
export function IconCopyAll(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <rect x="8" y="8" width="11" height="13" rx="2" stroke="currentColor" strokeWidth={stroke} />
      <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2h2" stroke="currentColor" strokeWidth={stroke} />
    </svg>
  )
}

/** 메모 히스토리 — 리스트 형태 */
export function IconToolbarHistory(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth={stroke} />
      <path d="M8 9h8M8 12h6M8 15h7" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}

/** 상단바 작은 크기에서도 식별되도록 채움 실루엣(썸택) */
export function IconTopBarPin(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" className={props.className} aria-hidden>
      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
    </svg>
  )
}

export function IconTopBarMinimize(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path d="M6 12h12" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  )
}

export function IconToolbarRobot(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <rect x="6" y="7" width="12" height="11" rx="2" stroke="currentColor" strokeWidth={stroke} />
      <circle cx="9.5" cy="11" r="1.2" fill="currentColor" />
      <circle cx="14.5" cy="11" r="1.2" fill="currentColor" />
      <path d="M9 15h6" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
      <path d="M12 4v3" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
      <circle cx="12" cy="3" r="1" fill="currentColor" />
    </svg>
  )
}

export function IconToolbarClock(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={stroke} />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 메모 검색바 — 이전/다음 일치 (삼각, currentColor) */
export function IconSearchBarUp(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 16
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" className={props.className} aria-hidden>
      <path d="M12 6.5L6 16.5h12L12 6.5z" />
    </svg>
  )
}

export function IconSearchBarDown(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 16
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" className={props.className} aria-hidden>
      <path d="M12 17.5L6 7.5h12l-6 10z" />
    </svg>
  )
}

export function IconSearchBarClose(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 16
  const sw = 1.65
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
    </svg>
  )
}

/** 클립보드 이미지 행 — 범용 컬러 썸네일(풍경) */
export function IconImageGeneric(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 22
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" className={props.className} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="1.1" />
      <circle cx="7.5" cy="9" r="2.3" fill="#fde047" />
      <path d="M3 17.5L7.5 12l3.2 3 3.8-4.5L21 17.5V20H3z" fill="#4ade80" />
      <path d="M3 17.5l5.2-3.8 2.6 2L14 12l7 5.8v2.2H3z" fill="#22c55e" opacity={0.35} />
    </svg>
  )
}

/** 편집창에 넣기 — 가로 줄 3 + 우상단에서 비스듬히 들어오는 곡선 화살표 (currentColor) */
export function IconClipboardInsertToEditor(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  const sw = 1.65
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path d="M4.5 8h9.5M4.5 12h11M4.5 16h8" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <path
        d="M19.5 5.5C18.5 12 14.5 15.5 9 16.5"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        fill="none"
      />
      <path d="M7 15.5l2.2 1.2.3-2.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
