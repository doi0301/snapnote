export function EmptyState(): React.JSX.Element {
  return (
    <div className="empty-state">
      <p className="empty-state-text">접기창에 표시할 메모가 없습니다.</p>
      <p className="empty-state-hint">아래 <strong>새 메모</strong>로 추가하세요.</p>
    </div>
  )
}
