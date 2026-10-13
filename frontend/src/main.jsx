import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'
import ModeratorPage from './pages/ModeratorPage.jsx'

const path = window.location.pathname.replace(/\/$/, '') || '/'
const Root = path === '/moderator' ? ModeratorPage : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
