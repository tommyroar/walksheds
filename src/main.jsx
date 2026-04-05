import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Walksheds from './Walksheds.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Walksheds />
  </StrictMode>,
)
