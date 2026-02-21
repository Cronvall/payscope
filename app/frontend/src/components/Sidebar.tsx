import { useEffect, useState } from 'react'
import { listPDFs } from '../api/client'
import { useWorkspace } from '../context/WorkspaceContext'
import type { PDFListItem } from '../types'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export default function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const { extractPDF } = useWorkspace()
  const [pdfs, setPdfs] = useState<PDFListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listPDFs()
      .then(setPdfs)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const handlePDFClick = (filename: string) => {
    extractPDF(filename)
  }

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-zinc-800 bg-canvas transition-all duration-200 ${
        collapsed ? 'w-12' : 'w-[220px]'
      }`}
    >
      <div className="flex h-12 items-center justify-between border-b border-zinc-800 px-3">
        {!collapsed && (
          <span className="font-mono text-sm font-medium text-zinc-300">Custodian Reports</span>
        )}
        <button
          onClick={onToggleCollapse}
          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {loading && (
          <div className="px-3 py-4 text-center text-sm text-zinc-500">Loading...</div>
        )}
        {error && (
          <div className="px-3 py-4 text-sm text-red-400">{error}</div>
        )}
        {!loading && !error && pdfs.length === 0 && (
          <div className="px-3 py-4 text-sm text-zinc-500">No PDFs found</div>
        )}
        {!loading && !error && pdfs.length > 0 && (
          <ul className="space-y-0.5">
            {pdfs.map((item) => (
              <li key={item.filename}>
                <button
                  onClick={() => handlePDFClick(item.filename)}
                  className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-zinc-800/80 ${
                    collapsed ? 'items-center' : ''
                  }`}
                >
                  {collapsed ? (
                    <span className="text-lg" title={item.custodian_hint}>📄</span>
                  ) : (
                    <>
                      <span className="truncate font-mono text-sm text-zinc-200">
                        {item.custodian_hint}
                      </span>
                      <span className="truncate text-xs text-zinc-500">
                        {formatSize(item.size_bytes)}
                      </span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
