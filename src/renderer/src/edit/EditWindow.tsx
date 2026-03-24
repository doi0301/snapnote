import { useCallback, useEffect, useRef, useState } from 'react'
import type { Memo, Settings } from '@shared/types'
import { useWindowPersist } from '@renderer/hooks/useWindowPersist'
import { useAutoSave } from '@renderer/hooks/useAutoSave'
import { TopBar } from './TopBar'
import { useEditResizeCursorAffordance } from './useEditResizeCursor'
import { Editor, type EditorHandle } from './Editor'
import { memoHue } from '@renderer/utils/memoHue'
import { collectAllTags, parseTagString, tagsToInputString } from './tagUtils'
import './edit.css'

interface EditWindowProps {
  memoId: string
}

export function EditWindow({ memoId }: EditWindowProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<EditorHandle>(null)
  const [memo, setMemo] = useState<Memo | null>(null)
  const [pinned, setPinned] = useState(false)
  const [tagRaw, setTagRaw] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  /** 서버에서 태그 입력값을 채우기 전에는 자동 저장으로 태그를 덮어쓰지 않음 */
  const tagsHydratedRef = useRef(false)

  useEditResizeCursorAffordance(rootRef)

  useEffect(() => {
    tagsHydratedRef.current = false
  }, [memoId])

  const loadMemo = useCallback(() => {
    if (!memoId) return
    void window.snapnote.memo.get(memoId).then((m) => {
      setMemo(m)
      setPinned(m.isPinned)
      setTagRaw(tagsToInputString(m.tags))
      tagsHydratedRef.current = true
    })
  }, [memoId])

  useEffect(() => {
    loadMemo()
  }, [loadMemo])

  const onMemoSync = useCallback((m: Memo) => {
    setMemo(m)
    setPinned(m.isPinned)
  }, [])

  useWindowPersist(memoId, onMemoSync)

  useEffect(() => {
    return window.snapnote.on.clipboardPasteText((text) => {
      editorRef.current?.appendTextFromClipboard(text)
    })
  }, [])

  useEffect(() => {
    const refreshSuggestions = (): void => {
      void window.snapnote.memo.getAll().then((memos) => setTagSuggestions(collectAllTags(memos)))
    }
    refreshSuggestions()
    return window.snapnote.on.memoUpdated(refreshSuggestions)
  }, [])

  useEffect(() => {
    void window.snapnote.settings.get().then(setSettings)
    return window.snapnote.on.settingsChanged((s) => setSettings(s))
  }, [])

  const saveTags = useCallback(async () => {
    if (!memoId || !tagsHydratedRef.current) return
    const tags = parseTagString(tagRaw)
    const updated = await window.snapnote.memo.update({ id: memoId, patch: { tags } })
    setMemo(updated)
  }, [memoId, tagRaw])

  useAutoSave(saveTags, [tagRaw, memoId])

  const onPinToggle = useCallback(async () => {
    const next = !pinned
    setPinned(next)
    await window.snapnote.memo.setPinned({ id: memoId, pinned: next })
    void window.snapnote.memo.get(memoId).then(setMemo)
  }, [memoId, pinned])

  const saveAndFold = useCallback(async () => {
    await window.snapnote.memo.fold(memoId)
  }, [memoId])

  const saveAndCloseFromStack = useCallback(async () => {
    await window.snapnote.memo.closeFromStack(memoId)
  }, [memoId])

  if (!memo) {
    return (
      <div ref={rootRef} className="edit-root">
        <div className="edit-body edit-loading">불러오는 중…</div>
      </div>
    )
  }

  const hue = memoHue(memo.color)
  const bgAlpha = Math.min(1, Math.max(0.6, Number(settings?.windowOpacity) || 1))
  const textAlpha = Math.max(0.92, bgAlpha)

  return (
    <div
      ref={rootRef}
      className={`edit-root edit-root--memo-${hue}`}
      style={
        {
          '--window-bg-alpha': String(bgAlpha),
          '--window-text-alpha': String(textAlpha)
        } as React.CSSProperties
      }
    >
      <TopBar
        isPinned={pinned}
        onPinToggle={onPinToggle}
        onFold={saveAndFold}
        onCloseFromStack={saveAndCloseFromStack}
      />
      <div className="edit-body">
        <Editor
          ref={editorRef}
          memo={memo}
          onMemoUpdated={setMemo}
          tagRaw={tagRaw}
          onTagRawChange={setTagRaw}
          tagSuggestions={tagSuggestions}
        />
      </div>
    </div>
  )
}
