import { useWorkspace } from '../context/WorkspaceContext'
import type { Case, CaseStatus } from '../types'

interface ActionItemCardProps {
  action: Case
  selected?: boolean
  onClick?: () => void
}

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

const STATUS_BADGE_STYLES: Record<CaseStatus, string> = {
  AI_ANALYZED: 'bg-blue-900/50 text-blue-300',
  UNDER_REVIEW: 'bg-amber-900/50 text-amber-300',
  DOCUMENT_REQUESTED: 'bg-orange-900/50 text-orange-300',
  CLAIM_SUBMITTED: 'bg-purple-900/50 text-purple-300',
  RECOVERED: 'bg-emerald-900/50 text-emerald-300',
  WRITTEN_OFF: 'bg-zinc-700/50 text-zinc-400',
}

const MAX_STEP_LENGTH = 45

function abbreviateStep(step: string): string {
  if (step.length <= MAX_STEP_LENGTH) return step
  const cut = step.slice(0, MAX_STEP_LENGTH + 1)
  const lastSpace = cut.lastIndexOf(' ')
  const end = lastSpace > MAX_STEP_LENGTH / 2 ? lastSpace : MAX_STEP_LENGTH
  return step.slice(0, end).trim() + '…'
}

export default function ActionItemCard({ action, selected, onClick }: ActionItemCardProps) {
  const { completedSteps } = useWorkspace()
  const typeLabel = TYPE_LABELS[action.type] ?? action.type.replace(/_/g, ' ')
  const statusStyle = STATUS_BADGE_STYLES[action.status] ?? 'bg-zinc-700/80 text-zinc-400'
  const completed = completedSteps[action.id] ?? []

  const pendingSteps = action.steps
    .map((step, i) => ({ step, i }))
    .filter(({ i }) => !completed.includes(i))

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-4 text-left transition-colors ${
        selected
          ? 'border-accent bg-accent/10'
          : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/50'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-medium text-accent">{action.id}</span>
        <div className="flex items-center gap-1.5">
          {action.jurisdiction && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              {action.jurisdiction.toUpperCase()}
            </span>
          )}
          <span className={`rounded px-2 py-0.5 font-mono text-xs ${statusStyle}`}>
            {action.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>
      {action.security && (
        <p className="text-xs font-medium text-zinc-400">{action.security}</p>
      )}
      <p className="font-mono text-sm font-medium text-zinc-200">
        {action.client_id} · {action.custodian}
      </p>
      <p className="mt-1 text-sm text-zinc-400">{typeLabel}</p>
      <p className={`mt-2 font-mono text-sm font-medium ${action.type === 'overpayment_return' ? 'text-red-400' : 'text-amber-400'}`}>
        {formatCurrency(action.amount_recoverable, action.currency)}{' '}
        {action.type === 'overpayment_return' ? 'owed' : 'recoverable'}
      </p>
      {pendingSteps.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-zinc-500">
          {pendingSteps.map(({ step }, idx) => (
            <li key={idx} className="flex items-start gap-2" title={step.length > MAX_STEP_LENGTH ? step : undefined}>
              <span className="shrink-0 font-mono text-zinc-600">{idx + 1}.</span>
              <span>{abbreviateStep(step)}</span>
            </li>
          ))}
        </ul>
      )}
      {action.references && action.references.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500">
          {action.references.length} official source{action.references.length !== 1 ? 's' : ''} available
        </p>
      )}
    </button>
  )
}
