/** 표 한 줄을 엑셀용 TSV 한 블록으로 직렬화 */
export function tableRowsToTsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeTsvCell).join('\t')).join('\n')
}

function escapeTsvCell(cell: string): string {
  const c = cell ?? ''
  if (/[\t\n\r"]/.test(c)) {
    return `"${c.replace(/"/g, '""')}"`
  }
  return c
}

/** 클립보드 TSV → 행 배열 (열 상한 적용) */
export function parseTsvToRows(text: string, maxCols: number): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd()
  if (!normalized) return [['']]
  const lines = normalized.split('\n')
  const rows = lines.map((ln) => {
    const cells = ln.split('\t').slice(0, maxCols)
    return cells.length ? cells : ['']
  })
  while (rows.length && rows[rows.length - 1]!.every((c) => (c ?? '').trim() === '')) {
    rows.pop()
  }
  return rows.length ? rows : [['']]
}

/** 내용 기준 사용 열 수 (최소 minCols, 최대 maxCols) */
export function tableColCount(rows: string[][], maxCols: number, minCols = 2): number {
  let used = minCols
  for (const row of rows) {
    used = Math.max(used, row.length)
    for (let c = row.length - 1; c >= 0; c--) {
      if ((row[c] ?? '').trim() !== '') {
        used = Math.max(used, c + 1)
        break
      }
    }
  }
  return Math.min(maxCols, used)
}

/** 저장된 tableCols와 내용을 합쳐 실제 표시 열 수 결정 */
export function resolveTableCols(
  rows: string[][],
  maxCols: number,
  storedCols?: number | null,
  minCols = 2
): number {
  const fromContent = tableColCount(rows, maxCols, minCols)
  if (storedCols == null || !Number.isFinite(storedCols)) return fromContent
  const stored = Math.min(maxCols, Math.max(minCols, Math.floor(storedCols)))
  return Math.max(fromContent, stored)
}

export function padTableRows(
  rows: string[][],
  maxCols: number,
  colCount?: number,
  minCols = 2
): string[][] {
  const cols = colCount ?? resolveTableCols(rows, maxCols, null, minCols)
  return rows.map((row) => {
    const cells = [...row]
    while (cells.length < cols) cells.push('')
    return cells.slice(0, cols)
  })
}
