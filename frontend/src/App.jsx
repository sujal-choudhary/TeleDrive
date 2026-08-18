import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Folder from './pages/Folder'
import Recent from './pages/Recent'
import Starred from './pages/Starred'
import Trash from './pages/Trash'
import Settings from './pages/Settings'
import Sidebar from './components/Sidebar'
import Header from './components/Header'

function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/folder/:id" element={<Folder />} />
            <Route path="/recent" element={<Recent />} />
            <Route path="/starred" element={<Starred />} />
            <Route path="/trash" element={<Trash />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return <AppLayout />
}