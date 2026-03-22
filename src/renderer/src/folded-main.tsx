import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FoldedPanel } from './folded/FoldedPanel'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FoldedPanel />
  </StrictMode>
)
