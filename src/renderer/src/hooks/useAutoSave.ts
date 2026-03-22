import { type DependencyList, useEffect, useRef } from 'react'

/** TASK-S3-06: 편집 내용 자동 저장 간격 */
export const AUTOSAVE_DEBOUNCE_MS = 1500

/**
 * `deps`가 바뀔 때마다 타이머를 갱신하고, `debounceMs` 후 `save` 호출.
 * 컴포넌트 언마운트 시에는 타이머와 관계없이 즉시 한 번 `save` 호출.
 */
export function useDebouncedAutoSave(
  save: () => void | Promise<void>,
  debounceMs: number,
  deps: DependencyList
): void {
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    const id = window.setTimeout(() => {
      void saveRef.current()
    }, debounceMs)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps를 호출부에서 묶어 전달
  }, [debounceMs, ...deps])

  useEffect(() => {
    return () => {
      void saveRef.current()
    }
  }, [])
}

/** 1.5초 디바운스 자동 저장 (S3-06) */
export function useAutoSave(save: () => void | Promise<void>, deps: DependencyList): void {
  useDebouncedAutoSave(save, AUTOSAVE_DEBOUNCE_MS, deps)
}
