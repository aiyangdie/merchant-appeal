import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ChatPage from './pages/ChatPage'
import AdminPage from './pages/AdminPage'
import AdminLogin from './pages/AdminLogin'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminPage />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  )
}
