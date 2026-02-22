import { useCallback, useState } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import type { Case, CaseStatus } from '../types'

const KANBAN_COLUMNS: CaseStatus[] = [
  'NEW',
  'AI_ANALYZED',
  'UNDER_REVIEW',
  'DOCUMENT_REQUESTED',
  'CLAIM_SUBMITTED',
  'RECOVERED',
  'WRITTEN_OFF',
]

const COLUMN_LABELS: Record<CaseStatus, string> = {
  NEW: 'New',
  AI_ANALYZED: 'AI Analyzed',
  UNDER_REVIEW: 'Under Review',
  DOCUMENT_REQUESTED: 'Doc Requested',
  CLAIM_SUBMITTED: 'Claim Submitted',
  RECOVERED: 'Recovered',
  WRITTEN_OFF: 'Written Off',
}

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

interface KanbanCardProps {
  case_: Case
  isDragging?: boolean
  onDragStart: () => void
  onSelect?: () => void
}

function KanbanCard({ case_: c, isDragging, onDragStart, onSelect }: KanbanCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/case-id', c.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onClick={onSelect}
      className={`cursor-grab rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-left transition-shadow active:cursor-grabbing hover:border-zinc-600 ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-medium text-accent">{c.id}</span>
        <span className="font-mono text-sm font-medium text-amber-400">
          {formatCurrency(c.amount_recoverable, c.currency)}
        </span>
      </div>
      <p className="mt-1 truncate font-mono text-xs text-zinc-400">
        {c.client_id} · {c.custodian}
      </p>
      <p className="mt-0.5 truncate text-xs text-zinc-500">
        {c.type.replace(/_/g, ' ')}
      </p>
    </div>
  )
}

interface KanbanColumnProps {
  status: CaseStatus
  cases: Case[]
  draggedCase: Case | null
  onDragStart: (case_: Case) => void
  onDragOver: (e: React.DragEvent, status: CaseStatus) => void
  onDrop: (e: React.DragEvent, status: CaseStatus) => void
  onCardSelect?: (case_: Case) => void
}

function KanbanColumn({
  status,
  cases,
  draggedCase,
  onDragStart,
  onDragOver,
  onDrop,
  onCardSelect,
}: KanbanColumnProps) {
  const total = cases.reduce((sum, c) => sum + c.amount_recoverable, 0)
  const isDone = status === 'RECOVERED' || status === 'WRITTEN_OFF'

  return (
    <div
      className={`flex min-w-[200px] max-w-[220px] flex-1 flex-col rounded-lg border ${
        isDone ? 'border-zinc-700/50 bg-zinc-900/30' : 'border-zinc-700 bg-zinc-900/50'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragOver(e, status)
      }}
      onDrop={(e) => onDrop(e, status)}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-700/50 px-3 py-2">
        <span className="font-mono text-xs font-medium text-zinc-300">
          {COLUMN_LABELS[status]}
        </span>
        <span className="font-mono text-xs text-zinc-500">
          {cases.length}
          {cases.length > 0 && (
            <span className="ml-1 text-amber-400/80">
              ({formatCurrency(total)})
            </span>
          )}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {cases.map((c) => (
          <KanbanCard
            key={c.id}
            case_={c}
            isDragging={draggedCase?.id === c.id}
            onDragStart={() => onDragStart(c)}
            onSelect={() => onCardSelect?.(c)}
          />
        ))}
      </div>
    </div>
  )
}

export default function CasesKanbanPage() {
  const { actionItems, transitionCaseStatus, completedSteps, toggleStepComplete } = useWorkspace()
  const [draggedCase, setDraggedCase] = useState<Case | null>(null)
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const casesByStatus = KANBAN_COLUMNS.reduce(
    (acc, status) => {
      acc[status] = actionItems.filter((c) => c.status === status)
      return acc
    },
    {} as Record<CaseStatus, Case[]>
  )

  const openCases = actionItems.filter(
    (c) => c.status !== 'RECOVERED' && c.status !== 'WRITTEN_OFF'
  )
  const totalRecoverable = openCases.reduce((sum, c) => sum + c.amount_recoverable, 0)

  const handleDrop = useCallback(
    async (e: React.DragEvent, toStatus: CaseStatus) => {
      e.preventDefault()
      const caseId = e.dataTransfer.getData('application/case-id')
      if (!caseId || isTransitioning) return
      setDraggedCase(null)

      const case_ = actionItems.find((c) => c.id === caseId)
      if (!case_ || case_.status === toStatus) return

      setIsTransitioning(true)
      try {
        await transitionCaseStatus(caseId, toStatus)
      } finally {
        setIsTransitioning(false)
      }
    },
    [actionItems, transitionCaseStatus, isTransitioning]
  )

  const handleDragStart = useCallback((case_: Case) => {
    setDraggedCase(case_)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedCase(null)
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-4 border-b border-zinc-800 px-4 py-3">
        <h1 className="font-mono text-lg font-medium text-zinc-200">Recovery Board</h1>
        <div className="flex items-center gap-2">
          <span className="rounded bg-amber-900/30 px-2 py-1 font-mono text-sm text-amber-300">
            {openCases.length} open cases
          </span>
          <span className="font-mono text-sm text-zinc-400">
            {formatCurrency(totalRecoverable)} recoverable
          </span>
        </div>
      </div>

      <div
        className="flex flex-1 gap-4 overflow-x-auto p-4"
        onDragEnd={handleDragEnd}
      >
        {KANBAN_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            cases={casesByStatus[status]}
            draggedCase={draggedCase}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onCardSelect={setSelectedCase}
          />
        ))}
      </div>

      {selectedCase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setSelectedCase(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-mono text-sm font-medium text-accent">{selectedCase.id}</h3>
            <p className="mt-1 text-sm text-zinc-300">
              {selectedCase.client_id} · {selectedCase.custodian}
            </p>
            <p className="mt-1 font-mono text-amber-400">
              {formatCurrency(selectedCase.amount_recoverable, selectedCase.currency)} recoverable
            </p>
            {selectedCase.steps.length > 0 && (
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                {selectedCase.steps.map((step, i) => {
                  const completed = completedSteps[selectedCase.id] ?? []
                  const isComplete = completed.includes(i)
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleStepComplete(selectedCase.id, i)}
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
                      <span className={isComplete ? 'line-through text-zinc-500' : ''}>{step}</span>
                    </li>
                  )
                })}
              </ul>
            )}
            <button
              onClick={() => setSelectedCase(null)}
              className="mt-4 rounded border border-zinc-600 px-3 py-1 font-mono text-sm text-zinc-400 hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
