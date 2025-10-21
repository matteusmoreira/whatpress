import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { RoleProvider } from './contexts/RoleContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RoleProvider>
      <App />
    </RoleProvider>
  </React.StrictMode>,
)