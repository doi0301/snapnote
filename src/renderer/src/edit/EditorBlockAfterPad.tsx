/** 메모 맨 끝의 표·중간선 아래 — 클릭 시 다음 줄 추가 */
export function EditorBlockAfterPad({ onActivate }: { onActivate: () => void }) {
  return (
    <button
      type="button"
      className="editor-block-after-pad"
      aria-label="아래에 줄 추가"
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onActivate()
      }}
    />
  )
}
