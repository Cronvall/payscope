import { useState, useEffect, useCallback } from 'react'
import ActionItemCard from './ActionItemCard'
import type { Case, CaseStatus } from '../types'

const CASE_STATUSES: CaseStatus[] = [
  'AI_ANALYZED',
  'UNDER_REVIEW',
  'DOCUMENT_REQUESTED',
  'CLAIM_SUBMITTED',
  'RECOVERED',
  'WRITTEN_OFF',
]

const COLLAPSED_JURISDICTIONS_KEY = 'payscope_collapsed_jurisdictions'

function loadCollapsedJurisdictions(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_JURISDICTIONS_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveCollapsedJurisdictions(set: Set<string>) {
  localStorage.setItem(COLLAPSED_JURISDICTIONS_KEY, JSON.stringify([...set]))
}

interface ActionListPanelProps {
  actions: Case[]
  selectedAction: Case | null
  onSelectAction: (action: Case | null) => void
  streaming?: boolean
  errandsOptimized?: number
  /** Statuses to exclude from the filter dropdown (e.g. terminal statuses in workspace) */
  excludeStatuses?: CaseStatus[]
}

export default function ActionListPanel({
  actions,
  selectedAction,
  onSelectAction,
  streaming,
  errandsOptimized = 0,
  excludeStatuses = [],
}: ActionListPanelProps) {
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'ALL'>('ALL')
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>('ALL')
  const [collapsedJurisdictions, setCollapsedJurisdictions] = useState<Set<string>>(loadCollapsedJurisdictions)

  const statusOptions = CASE_STATUSES.filter((s) => !excludeStatuses.includes(s))
  let filtered = statusFilter === 'ALL' ? actions : actions.filter((a) => a.status === statusFilter)
  filtered = jurisdictionFilter === 'ALL' ? filtered : filtered.filter((a) => (a.jurisdiction || 'Unknown').trim() === jurisdictionFilter)

  // Group by jurisdiction for team specialization (e.g. Japanese/German markets)
  const groupedByJurisdiction = filtered.reduce(
    (acc, action) => {
      const j = (action.jurisdiction || 'Unknown').trim() || 'Unknown'
      if (!acc[j]) acc[j] = []
      acc[j].push(action)
      return acc
    },
    {} as Record<string, Case[]>
  )
  const jurisdictions = Object.keys(groupedByJurisdiction).sort()

  const toggleJurisdiction = useCallback((jurisdiction: string) => {
    setCollapsedJurisdictions((prev) => {
      const next = new Set(prev)
      if (next.has(jurisdiction)) {
        next.delete(jurisdiction)
      } else {
        next.add(jurisdiction)
      }
      saveCollapsedJurisdictions(next)
      return next
    })
  }, [])

  const allJurisdictions = [...new Set(actions.map((a) => (a.jurisdiction || 'Unknown').trim() || 'Unknown'))].sort()

  useEffect(() => {
    if (statusFilter !== 'ALL' && excludeStatuses.includes(statusFilter)) {
      setStatusFilter('ALL')
    }
  }, [excludeStatuses, statusFilter])

  return (
    <div className="flex h-full w-full shrink-0 flex-col border-r border-zinc-800 bg-canvas">
      <div className="flex h-12 shrink-0 flex-wrap items-center gap-2 border-b border-zinc-800 px-4">
        <span className="font-mono text-sm font-medium text-zinc-300">Cases</span>
        {actions.length > 0 && (
          <span className="shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {actions.length}
          </span>
        )}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CaseStatus | 'ALL')}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-300"
        >
          <option value="ALL">All</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select
          value={jurisdictionFilter}
          onChange={(e) => setJurisdictionFilter(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-300"
          title="Filter by nation/jurisdiction"
        >
          <option value="ALL">All nations</option>
          {allJurisdictions.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>
        {errandsOptimized > 0 && (
          <span className="flex shrink-0 items-center gap-1 rounded bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-400">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {errandsOptimized}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 overscroll-contain">
        {streaming && actions.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            Streaming...
          </div>
        )}
        {!streaming && actions.length === 0 && (
          <p className="text-sm text-zinc-500">
            {errandsOptimized > 0
              ? `No action items. ${errandsOptimized} errand${errandsOptimized === 1 ? '' : 's'} optimized.`
              : 'No action items yet.'}
          </p>
        )}
        <div className="space-y-6">
          {jurisdictions.map((jurisdiction) => {
            const isCollapsed = collapsedJurisdictions.has(jurisdiction)
            const cards = groupedByJurisdiction[jurisdiction]
            return (
              <div key={jurisdiction} className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleJurisdiction(jurisdiction)}
                  className="sticky top-0 z-10 flex w-full items-center gap-2 border-b border-zinc-800 bg-zinc-950 pb-2 pt-1 text-left font-mono text-xs font-medium uppercase tracking-wider text-zinc-500 shadow-[0_1px_0_0_rgba(0,0,0,0.3)] transition-colors hover:bg-zinc-800 hover:text-zinc-400"
                >
                  <span
                    className={`shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                    aria-hidden
                  >
                    ▶
                  </span>
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-400">
                    {cards.length}
                  </span>
                  {jurisdiction}
                </button>
                {!isCollapsed && (
                  <div className="space-y-3">
                    {cards.map((action) => (
                      <ActionItemCard
                        key={action.id}
                        action={action}
                        selected={selectedAction?.id === action.id}
                        onClick={() => onSelectAction(selectedAction?.id === action.id ? null : action)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
