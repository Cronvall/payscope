import { useEffect, useRef } from 'react'
import type { StreamLogEntry } from '../context/WorkspaceContext'

interface StreamConsoleProps {
  logs: StreamLogEntry[]
  streaming?: boolean
  paused?: boolean
  collapsed: boolean
  onToggleCollapse: () => void
  onStart: () => void
  onStop: () => void
  onPause?: () => void
}

function logColor(type: StreamLogEntry['type']): string {
  switch (type) {
    case 'errand':
      return 'text-zinc-400'
    case 'evaluated':
      return 'text-zinc-300'
    case 'action':
      return 'text-amber-400'
    default:
      return 'text-zinc-500'
  }
}

export default function StreamConsole({
  logs,
  streaming,
  paused,
  collapsed,
  onToggleCollapse,
  onStart,
  onStop,
  onPause,
}: StreamConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [logs])

  return (
    <aside
      className={`flex h-full w-full shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-200`}
    >
      <div className="flex h-12 items-center justify-between gap-2 border-b border-zinc-800 px-3">
        {!collapsed && (
          <>
            <span className="font-mono text-sm font-medium text-zinc-300">Logs</span>
            {streaming ? (
              <span className="flex gap-1">
                {onPause && (
                  <button
                    onClick={onPause}
                    className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
                    title={paused ? 'Resume' : 'Pause (demo)'}
                  >
                    {paused ? 'Resume' : 'Pause'}
                  </button>
                )}
                <button
                  onClick={onStop}
                  className="rounded px-2 py-1 text-xs text-amber-400 hover:bg-zinc-800"
                >
                  Stop
                </button>
              </span>
            ) : (
              <button
                onClick={onStart}
                className="rounded px-2 py-1 text-xs text-accent hover:bg-zinc-800"
              >
                Start
              </button>
            )}
          </>
        )}
        <button
          onClick={onToggleCollapse}
          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          aria-label={collapsed ? 'Expand console' : 'Collapse console'}
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
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2 font-mono text-xs overscroll-contain">
        {streaming && logs.length === 0 && !paused && (
          <div className="flex items-center gap-2 py-2 text-zinc-500">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Connecting...
          </div>
        )}
        {streaming && paused && (
          <div className="flex items-center gap-2 py-2 text-amber-500/80">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            Paused (events buffered)
          </div>
        )}
        {!streaming && logs.length === 0 && !collapsed && (
          <div className="py-4 text-center text-zinc-500">
            Click Start to run dividend season
          </div>
        )}
        {logs.map((log) => (
          <div
            key={log.id}
            className={`flex gap-2 py-0.5 ${logColor(log.type)}`}
          >
            <span className="shrink-0 text-zinc-600">
              {new Date(log.timestamp).toLocaleTimeString('en-GB', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
            <span className="min-w-0 break-all">{log.message}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}
