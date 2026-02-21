import { useState } from 'react'
import ActionItemCard from './ActionItemCard'
import type { Case, CaseStatus } from '../types'

const CASE_STATUSES: CaseStatus[] = [
  'NEW',
  'AI_ANALYZED',
  'UNDER_REVIEW',
  'DOCUMENT_REQUESTED',
  'CLAIM_SUBMITTED',
  'RECOVERED',
  'WRITTEN_OFF',
]

interface ActionListPanelProps {
  actions: Case[]
  selectedAction: Case | null
  onSelectAction: (action: Case | null) => void
  streaming?: boolean
  errandsOptimized?: number
}

export default function ActionListPanel({
  actions,
  selectedAction,
  onSelectAction,
  streaming,
  errandsOptimized = 0,
}: ActionListPanelProps) {
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'ALL'>('ALL')

  const filtered = statusFilter === 'ALL' ? actions : actions.filter((a) => a.status === statusFilter)

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
          {CASE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
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
        <div className="space-y-3">
          {filtered.map((action) => (
            <ActionItemCard
              key={action.id}
              action={action}
              selected={selectedAction?.id === action.id}
              onClick={() => onSelectAction(selectedAction?.id === action.id ? null : action)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
