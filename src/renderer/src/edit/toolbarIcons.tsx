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

export function IconToolbarFormat(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M6 5h8M10 5v14M7 19h6"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 8h5M15 12h4M15 16h5"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconToolbarBold(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M7 5v14M7 5h6a3 3 0 010 4H7M7 11h6a3 3 0 010 4H7"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconToolbarStrikethrough(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path d="M5 12h14" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
      <path
        d="M8 8h8M8 16h8"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
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
      <path d="M5 12h14" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
      <path d="M8 7h8M8 17h8" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" opacity={0.45} />
    </svg>
  )
}

export function IconClipboard(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M9 4h6l1 2h3a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h3l1-2z"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinejoin="round"
      />
      <path d="M9 11h6M9 15h4" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  )
}

export function IconToolbarHistory(props: { size?: number; className?: string }): React.JSX.Element {
  const s = props.size ?? 18
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={stroke} />
      <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
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
