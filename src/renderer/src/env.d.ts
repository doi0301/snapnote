/// <reference types="vite/client" />

/** Electron frameless 창 드래그 영역 */
declare module 'csstype' {
  interface Properties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}
