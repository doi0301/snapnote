import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseHashAtCursor, parseTagString } from './tagUtils'
import './tag-input.css'

export interface TagInputProps {
  value: string
  onChange: (raw: string) => void
  suggestions: string[]
  /** 하단 고정바용 여백 조정 */
  variant?: 'default' | 'bottom'
}

export function TagInput({ value, onChange, suggestions, variant = 'default' }: TagInputProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [ctx, setCtx] = useState<{ start: number; query: string } | null>(null)

  const refreshCtx = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    const cursor = el.selectionStart ?? 0
    const h = parseHashAtCursor(value, cursor)
    if (h) {
      setCtx(h)
      setOpen(true)
      setHighlight(0)
    } else {
      setCtx(null)
      setOpen(false)
    }
  }, [value])

  useEffect(() => {
    const id = requestAnimationFrame(refreshCtx)
    return () => cancelAnimationFrame(id)
  }, [value, refreshCtx])

  const filtered = useMemo(() => {
    if (!ctx) return []
    const q = ctx.query.toLowerCase()
    return suggestions.filter((t) => {
      const tl = t.toLowerCase()
      return tl.startsWith(q) && tl !== q
    })
  }, [ctx, suggestions])

  const applySuggestion = useCallback(
    (tag: string) => {
      const el = inputRef.current
      if (!el || !ctx) return
      const cursor = el.selectionStart ?? 0
      const before = value.slice(0, ctx.start)
      const after = value.slice(cursor)
      const inserted = `#${tag} `
      onChange(before + inserted + after)
      setOpen(false)
      setCtx(null)
      requestAnimationFrame(() => {
        const pos = before.length + inserted.length
        el.focus()
        el.setSelectionRange(pos, pos)
      })
    },
    [ctx, onChange, value]
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open || filtered.length === 0) {
        if (e.key === 'Escape') setOpen(false)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((i) => (i + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((i) => (i - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        applySuggestion(filtered[highlight]!)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    },
    [open, filtered, highlight, applySuggestion]
  )

  const serializedTags = useMemo(() => JSON.stringify(parseTagString(value)), [value])

  return (
    <div className={`tag-input-wrap${variant === 'bottom' ? ' tag-input-wrap--bottom' : ''}`}>
      <input
        ref={inputRef}
        type="text"
        className="tag-input-field"
        value={value}
        placeholder="카테고리를 설정하세요. 예: #업무 #계획"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onClick={refreshCtx}
        onKeyUp={refreshCtx}
        onKeyDown={onKeyDown}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {open && filtered.length > 0 ? (
        <ul className="tag-suggest" role="listbox">
          {filtered.map((t, i) => (
            <li
              key={t}
              role="option"
              data-active={i === highlight ? 'true' : 'false'}
              aria-selected={i === highlight}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => applySuggestion(t)}
            >
              #{t}
            </li>
          ))}
        </ul>
      ) : null}
      <textarea
        className="edit-tags-serialized"
        aria-hidden
        tabIndex={-1}
        readOnly
        value={serializedTags}
        onChange={() => {}}
      />
    </div>
  )
}
