import { memo, useCallback, useLayoutEffect, useRef } from 'react'
import type { EditorLine as EditorLineModel } from '@shared/types'
import { INDENT_PX } from './EditorLine'
import { MAX_TABLE_COLS } from './editorLines'
import { padTableRows, parseTsvToRows, resolveTableCols } from './tableLine'
import './table-line.css'

export { tableRowsToTsv, parseTsvToRows } from './tableLine'

export interface TableEditorRowProps {
  line: EditorLineModel
  index: number
  bindTextareaRef: (lineIndex: number, el: HTMLTextAreaElement | null) => void
  onRowsChange: (lineIndex: number, rows: string[][], tableCols: number) => void
  onPasteFullGrid?: (lineIndex: number, rows: string[][], tableCols: number) => void
  onTableFocus?: (lineIndex: number) => void
  onCopyTable?: (lineIndex: number) => void
  onDeleteTable?: (lineIndex: number) => void
  onRequestUndo?: () => void
}

function syncCellEl(el: HTMLDivElement | null, value: string): void {
  if (!el) return
  const next = value ?? ''
  if (el.textContent !== next) el.textContent = next
}

export const TableEditorRow = memo(function TableEditorRow({
  line,
  index,
  bindTextareaRef,
  onRowsChange,
  onPasteFullGrid,
  onTableFocus,
  onCopyTable,
  onDeleteTable,
  onRequestUndo
}: TableEditorRowProps) {
  const rawRows = line.formatting?.tableRows ?? [
    ['', ''],
    ['', '']
  ]
  const colCount = resolveTableCols(rawRows, MAX_TABLE_COLS, line.formatting?.tableCols)
  const rows = padTableRows(rawRows, MAX_TABLE_COLS, colCount)
  const level = Math.min(6, Math.max(0, line.indentLevel))
  const marginW = level * INDENT_PX
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const undoPrimedRef = useRef(false)

  useLayoutEffect(() => {
    bindTextareaRef(index, null)
    return () => bindTextareaRef(index, null)
  }, [bindTextareaRef, index])

  useLayoutEffect(() => {
    for (let ri = 0; ri < rows.length; ri++) {
      for (let ci = 0; ci < colCount; ci++) {
        const key = `${ri}:${ci}`
        syncCellEl(cellRefs.current.get(key) ?? null, rows[ri]?.[ci] ?? '')
      }
    }
  }, [rows, colCount])

  const commitRows = useCallback(
    (next: string[][], cols: number = colCount) => {
      const c = Math.min(MAX_TABLE_COLS, Math.max(2, cols))
      onRowsChange(index, padTableRows(next, MAX_TABLE_COLS, c), c)
    },
    [colCount, index, onRowsChange]
  )

  const bumpCell = useCallback(
    (r: number, c: number, value: string) => {
      if (!undoPrimedRef.current) {
        undoPrimedRef.current = true
        onRequestUndo?.()
      }
      const next = rows.map((row) => [...row])
      while (next.length <= r) next.push(Array(colCount).fill(''))
      next[r]![c] = value
      commitRows(next)
    },
    [colCount, commitRows, onRequestUndo, rows]
  )

  const addRow = () => {
    onRequestUndo?.()
    const next = [...rows.map((row) => [...row]), Array(colCount).fill('')]
    commitRows(next)
  }

  const addCol = () => {
    if (colCount >= MAX_TABLE_COLS) return
    onRequestUndo?.()
    commitRows(rows, colCount + 1)
  }

  const deleteRow = (ri: number) => {
    if (rows.length <= 1) {
      onDeleteTable?.(index)
      return
    }
    onRequestUndo?.()
    const next = rows.filter((_, i) => i !== ri)
    commitRows(next)
  }

  const deleteCol = (ci: number) => {
    if (colCount <= 2) return
    onRequestUndo?.()
    const next = rows.map((row) => row.filter((_, c) => c !== ci))
    commitRows(next, colCount - 1)
  }

  const isLastRowOnly = rows.length <= 1

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData?.getData('text/plain')
    if (!text?.includes('\t')) return
    e.preventDefault()
    onRequestUndo?.()
    const parsed = parseTsvToRows(text, MAX_TABLE_COLS)
    if (parsed.length && onPasteFullGrid) {
      const cols = resolveTableCols(parsed, MAX_TABLE_COLS, null)
      onPasteFullGrid(index, padTableRows(parsed, MAX_TABLE_COLS, cols), cols)
    }
  }

  const onCellKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, ri: number, ci: number) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const nextC = e.shiftKey ? ci - 1 : ci + 1
      let nr = ri
      let nc = nextC
      if (nc >= colCount) {
        if (!e.shiftKey && colCount < MAX_TABLE_COLS && ci === colCount - 1) {
          e.preventDefault()
          onRequestUndo?.()
          const newCols = colCount + 1
          commitRows(rows, newCols)
          const target = `${ri}:${ci + 1}`
          requestAnimationFrame(() => cellRefs.current.get(target)?.focus())
          return
        }
        nc = 0
        nr = Math.min(rows.length - 1, ri + 1)
      } else if (nc < 0) {
        nc = colCount - 1
        nr = Math.max(0, ri - 1)
      }
      cellRefs.current.get(`${nr}:${nc}`)?.focus()
    }
  }

  return (
    <div
      className={`editor-line editor-line--table editor-line--level-${level}`}
      style={{ '--indent-level': level } as React.CSSProperties}
      onPointerDown={() => onTableFocus?.(index)}
    >
      <div
        className="editor-line-gutter"
        style={{ width: marginW, minWidth: marginW }}
        aria-hidden
      />
      <div className="table-editor-wrap">
        <div className="table-editor-toolbar">
          <button type="button" onClick={addRow}>
            + 행 추가
          </button>
          <button type="button" onClick={addCol} disabled={colCount >= MAX_TABLE_COLS}>
            + 열 추가
          </button>
          <button type="button" onClick={() => deleteCol(colCount - 1)} disabled={colCount <= 2}>
            − 열 삭제
          </button>
          <button type="button" onClick={() => onCopyTable?.(index)}>
            복사
          </button>
        </div>
        <div className="table-editor-grid" role="grid" onPaste={onPaste}>
          <div className="table-editor-row table-editor-row--head" role="row">
            <div className="table-editor-gutter" aria-hidden />
            {Array.from({ length: colCount }, (_, ci) => (
              <div
                key={`h-${ci}`}
                className="table-editor-cell table-editor-col-head"
                role="columnheader"
              >
                {ci + 1}
                <button
                  type="button"
                  className="table-editor-col-del"
                  title="이 열 삭제"
                  aria-label={`${ci + 1}열 삭제`}
                  disabled={colCount <= 2}
                  onClick={() => deleteCol(ci)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {rows.map((_row, ri) => (
            <div key={ri} className="table-editor-row" role="row">
              <div className="table-editor-gutter">
                <button
                  type="button"
                  className="table-editor-row-del"
                  title={isLastRowOnly ? '표 삭제' : '이 행 삭제'}
                  aria-label={isLastRowOnly ? '표 삭제' : `${ri + 1}행 삭제`}
                  onClick={() => deleteRow(ri)}
                >
                  ×
                </button>
              </div>
              {Array.from({ length: colCount }, (_, ci) => (
                <div
                  key={ci}
                  ref={(el) => {
                    const key = `${ri}:${ci}`
                    if (el) cellRefs.current.set(key, el)
                    else cellRefs.current.delete(key)
                  }}
                  className="table-editor-cell"
                  role="gridcell"
                  contentEditable
                  suppressContentEditableWarning
                  aria-label={`${ri + 1}행 ${ci + 1}열`}
                  onFocus={() => {
                    undoPrimedRef.current = false
                    onTableFocus?.(index)
                  }}
                  onInput={(e) => bumpCell(ri, ci, e.currentTarget.textContent ?? '')}
                  onKeyDown={(e) => onCellKeyDown(e, ri, ci)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})
