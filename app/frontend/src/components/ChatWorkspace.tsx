import { useState } from 'react'
import MessageList from './MessageList'
import { useWorkspace } from '../context/WorkspaceContext'

export default function ChatWorkspace() {
  const {
    messages,
    loading,
    error,
    runReconciliation,
    runAnalyze,
    sendChatMessage,
    startDividendSeason,
    dividendSeasonStreaming,
  } = useWorkspace()

  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return
    setInput('')
    sendChatMessage(trimmed)
  }

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center border-b border-zinc-800 px-4">
        <span className="font-mono text-sm font-medium text-zinc-400">PayScope Workspace</span>
        {error && (
          <span className="ml-4 text-sm text-red-400">{error}</span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
            <p className="text-center text-zinc-500">
              Run reconciliation, start dividend season, or click a PDF in the sidebar.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={runReconciliation}
                disabled={loading}
                className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 font-mono text-sm text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-50"
              >
                Run reconciliation
              </button>
              <button
                onClick={startDividendSeason}
                disabled={loading || dividendSeasonStreaming}
                className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 font-mono text-sm text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-50"
              >
                Start dividend season
              </button>
            </div>
          </div>
        ) : (
          <MessageList messages={messages} onAnalyzeDiscrepancy={runAnalyze} loading={loading} />
        )}
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 gap-2 border-t border-zinc-800 p-4"
      >
        <input
          name="input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Run reconciliation, Analyze DISC-001, or type a message..."
          disabled={loading}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-mono text-sm text-zinc-200 placeholder-zinc-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-accent px-4 py-2.5 font-mono text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {loading ? '...' : 'Send'}
        </button>
      </form>
    </main>
  )
}
