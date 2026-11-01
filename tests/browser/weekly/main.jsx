import React from 'react'
import { createRoot } from 'react-dom/client'
import Page from '../../../app/(dashboard)/duties/page'
import '../../../app/globals.css'
if (location.hash === '#dark') document.documentElement.classList.add('dark')
createRoot(document.getElementById('root')).render(
  <main style={{ padding: 20, maxWidth: 1100, margin: 'auto' }}>
    <Page />
  </main>,
)
