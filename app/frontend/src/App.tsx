import { Routes, Route } from 'react-router-dom'
import { WorkspaceProvider } from './context/WorkspaceContext'
import AppNav from './components/AppNav'
import WorkspacePage from './pages/WorkspacePage'
import CasesKanbanPage from './pages/CasesKanbanPage'
import DemoPage from './pages/DemoPage'

function App() {
  return (
    <WorkspaceProvider>
      <div className="flex h-screen flex-col bg-canvas text-zinc-100">
        <AppNav />
        <main className="flex min-h-0 flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<WorkspacePage />} />
            <Route path="/demo" element={<DemoPage />} />
            <Route path="/cases" element={<CasesKanbanPage />} />
          </Routes>
        </main>
      </div>
    </WorkspaceProvider>
  )
}

export default App
