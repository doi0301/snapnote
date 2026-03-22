import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HistoryModal } from './history/HistoryModal'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HistoryModal />
  </StrictMode>
)
