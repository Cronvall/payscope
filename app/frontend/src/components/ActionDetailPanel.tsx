import { useState, useEffect, useRef } from 'react'
import MessageList from './MessageList'
import { useWorkspace } from '../context/WorkspaceContext'
import { listForms, fillForm, listAttachments, getAttachmentDownloadUrl } from '../api/client'
import type { Case, CaseStatus } from '../types'

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const TYPE_LABELS: Record<string, string> = {
  tax_reclaim: 'Tax Reclaim',
  missing_followup: 'Missing Follow-up',
  overpayment_return: 'Overpayment Return',
}

const CASE_STATUSES: CaseStatus[] = [
  'NEW',
  'AI_ANALYZED',
  'UNDER_REVIEW',
  'DOCUMENT_REQUESTED',
  'CLAIM_SUBMITTED',
  'RECOVERED',
  'WRITTEN_OFF',
]

const STATUS_STYLES: Record<CaseStatus, string> = {
  NEW: 'bg-zinc-700/80 text-zinc-300',
  AI_ANALYZED: 'bg-blue-900/50 text-blue-300',
  UNDER_REVIEW: 'bg-amber-900/50 text-amber-300',
  DOCUMENT_REQUESTED: 'bg-orange-900/50 text-orange-300',
  CLAIM_SUBMITTED: 'bg-purple-900/50 text-purple-300',
  RECOVERED: 'bg-emerald-900/50 text-emerald-300',
  WRITTEN_OFF: 'bg-zinc-700/50 text-zinc-400',
}

function ActionDetailView({
  action,
  onTransitionStatus,
  loading,
  attachments,
  forms,
  onFillForm,
  fillLoading,
  onRefreshAttachments,
  completedSteps,
  onToggleStep,
}: {
  action: Case
  onTransitionStatus: (status: CaseStatus, note?: string) => void
  loading: boolean
  attachments: Array<{ id: string; filename: string; form_type: string; created_at: string }>
  forms: Array<{ key: string; display_name: string }>
  onFillForm: (formKey: string) => Promise<void>
  fillLoading: boolean
  onRefreshAttachments: () => void
  completedSteps: number[]
  onToggleStep: (stepIndex: number) => void
}) {
  const [showHistory, setShowHistory] = useState(false)
  const [note, setNote] = useState('')
  const typeLabel = TYPE_LABELS[action.type] ?? action.type.replace(/_/g, ' ')
  const history = action.history ?? []
  const isTerminal = action.status === 'RECOVERED' || action.status === 'WRITTEN_OFF'

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-medium text-accent">{action.id}</span>
        <span className={`rounded px-2 py-0.5 font-mono text-xs ${STATUS_STYLES[action.status] ?? ''}`}>
          {action.status.replace(/_/g, ' ')}
        </span>
      </div>
      {!isTerminal && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={''}
            onChange={(e) => {
              const v = e.target.value
              if (v) onTransitionStatus(v as CaseStatus, note || undefined)
            }}
            disabled={loading}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-300"
          >
            <option value="">Change status...</option>
            {CASE_STATUSES.filter((s) => s !== action.status).map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-32 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-300 placeholder-zinc-500"
          />
        </div>
      )}
      <p className="font-mono text-sm font-medium text-zinc-200">
        {action.client_id} · {action.custodian}
      </p>
      <p className="text-sm text-zinc-400">{typeLabel}</p>
      <p className="font-mono text-sm font-medium text-amber-400">
        {formatCurrency(action.amount_recoverable, action.currency)} recoverable
      </p>
      {action.steps.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Steps</p>
          <ul className="space-y-2 text-sm text-zinc-300">
            {action.steps.map((step, i) => {
              const isComplete = completedSteps.includes(i)
              return (
                <li key={i} className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleStep(i)}
                    className={`mt-0.5 shrink-0 rounded p-0.5 transition-colors ${
                      isComplete
                        ? 'border border-emerald-600 bg-emerald-900/30 text-emerald-400'
                        : 'border-0 bg-transparent text-zinc-500 hover:text-zinc-400'
                    }`}
                    aria-label={isComplete ? 'Mark step incomplete' : 'Mark step complete'}
                  >
                    {isComplete ? (
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2" />
                      </svg>
                    )}
                  </button>
                  <span className={isComplete ? 'text-zinc-500 line-through' : ''}>{step}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {action.references && action.references.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Official Sources
          </p>
          <ul className="space-y-1.5 text-sm">
            {action.references.map((ref, i) => (
              <li key={i}>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {ref.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {history.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-400"
          >
            History {showHistory ? '▼' : '▶'}
          </button>
          {showHistory && (
            <ul className="space-y-2 text-sm">
              {history.map((h, i) => (
                <li key={i} className="rounded border border-zinc-800 bg-zinc-900/50 p-2">
                  <span className="text-zinc-400">
                    {h.from_status ? `${h.from_status.replace(/_/g, ' ')} → ` : ''}
                    {h.to_status.replace(/_/g, ' ')}
                  </span>
                  <span className="ml-2 font-mono text-xs text-zinc-500">
                    {new Date(h.changed_at).toLocaleString()}
                  </span>
                  {h.note && <p className="mt-1 text-xs text-zinc-500">{h.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Attachments
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={''}
            onChange={async (e) => {
              const v = e.target.value
              e.target.value = ''
              if (!v) return
              await onFillForm(v)
              onRefreshAttachments()
            }}
            disabled={fillLoading || forms.length === 0}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-300"
          >
            <option value="">Fill form...</option>
            {forms.map((f) => (
              <option key={f.key} value={f.key}>
                {f.display_name}
              </option>
            ))}
          </select>
          {fillLoading && <span className="text-xs text-zinc-500">Filling...</span>}
        </div>
        {attachments.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 p-2"
              >
                <span className="truncate font-mono text-sm text-zinc-300">{a.filename}</span>
                <a
                  href={getAttachmentDownloadUrl(action.id, a.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded border border-zinc-600 px-2 py-1 font-mono text-xs text-accent hover:bg-zinc-800"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-zinc-500">No attachments yet. Fill a form to add one.</p>
        )}
      </div>
    </div>
  )
}

export default function ActionDetailPanel() {
  const {
    selectedAction,
    actionMessages,
    loading,
    error,
    sendChatMessage,
    transitionCaseStatus,
    runReconciliation,
    startDividendSeason,
    dividendSeasonStreaming,
    completedSteps,
    toggleStepComplete,
  } = useWorkspace()

  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<
    Array<{ id: string; filename: string; form_type: string; created_at: string }>
  >([])
  const [forms, setForms] = useState<Array<{ key: string; display_name: string }>>([])
  const [fillLoading, setFillLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listForms()
      .then(setForms)
      .catch(() => setForms([]))
  }, [])

  useEffect(() => {
    if (!selectedAction) {
      setAttachments([])
      return
    }
    listAttachments(selectedAction.id)
      .then(setAttachments)
      .catch(() => setAttachments([]))
  }, [selectedAction?.id])

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [selectedAction?.id])

  const refreshAttachments = () => {
    if (!selectedAction) return
    listAttachments(selectedAction.id).then(setAttachments).catch(() => setAttachments([]))
  }

  const handleFillForm = async (formKey: string) => {
    if (!selectedAction) return
    setFillLoading(true)
    try {
      await fillForm(selectedAction.id, formKey)
    } finally {
      setFillLoading(false)
    }
  }

  const messages = selectedAction ? actionMessages[selectedAction.id] ?? [] : []
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return
    setInput('')
    sendChatMessage(trimmed, selectedAction ?? undefined)
  }

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-zinc-800 bg-canvas">
      <div className="flex h-12 shrink-0 items-center border-b border-zinc-800 px-4">
        <span className="font-mono text-sm font-medium text-zinc-400">
          {selectedAction ? `${selectedAction.id} – Details` : 'Action Details'}
        </span>
        {error && (
          <span className="ml-4 text-sm text-red-400">{error}</span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!selectedAction ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
            <p className="text-center text-zinc-500">
              Select an action from the list to view details and chat with the bot about that errand.
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
          <>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
              >
                <div className="border-b border-zinc-800 p-4">
                  <ActionDetailView
                    action={selectedAction}
                    onTransitionStatus={(status, note) => transitionCaseStatus(selectedAction.id, status, note)}
                    loading={loading}
                    attachments={attachments}
                    forms={forms}
                    onFillForm={handleFillForm}
                    fillLoading={fillLoading}
                    onRefreshAttachments={refreshAttachments}
                    completedSteps={completedSteps[selectedAction.id] ?? []}
                    onToggleStep={(i) => toggleStepComplete(selectedAction.id, i)}
                  />
                </div>
                <div>
                  {messages.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-zinc-500">
                      Chat with the bot about this action. Ask questions, get clarification on steps, or
                      request help.
                    </p>
                  ) : (
                    <MessageList messages={messages} onAnalyzeDiscrepancy={() => {}} loading={loading} />
                  )}
                </div>
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
                  placeholder="Ask about this action..."
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
            </div>
          </>
        )}
      </div>
    </main>
  )
}
