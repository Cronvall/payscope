import type { Discrepancy, DiscrepancyType, Severity } from '../types'

interface DiscrepancyCardProps {
  discrepancy: Discrepancy
  onAnalyze?: (id: string) => void
}

const SEVERITY_CLASSES: Record<Severity, string> = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/40',
  HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  MEDIUM: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  LOW: 'bg-green-500/20 text-green-400 border-green-500/40',
}

const TYPE_CLASSES: Record<DiscrepancyType, string> = {
  TAX_ERROR: 'text-purple-400',
  MISSING_PAYMENT: 'text-red-400',
  AMOUNT_MISMATCH: 'text-amber-400',
  OVERPAYMENT: 'text-green-400',
}

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export default function DiscrepancyCard({ discrepancy, onAnalyze }: DiscrepancyCardProps) {
  const exp = discrepancy.expected
  const rec = discrepancy.received
  const currency = exp.quotation_currency || 'USD'

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`font-mono text-xs font-medium ${TYPE_CLASSES[discrepancy.type]}`}>
              {discrepancy.type.replace('_', ' ')}
            </span>
            <span
              className={`rounded border px-2 py-0.5 font-mono text-xs ${SEVERITY_CLASSES[discrepancy.severity]}`}
            >
              {discrepancy.severity}
            </span>
          </div>
          <p className="font-mono text-sm font-medium text-zinc-200">
            {exp.company_name} ({exp.ticker})
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
            <div>
              <span className="text-zinc-500">Expected: </span>
              <span className="font-mono text-zinc-200">
                {formatCurrency(exp.expected_net_amount, currency)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-zinc-500">→</span>
              <span className="text-zinc-500">Received: </span>
              <span className="font-mono text-zinc-200">
                {rec ? formatCurrency(rec.received_net_amount, rec.settlement_currency) : '—'}
              </span>
            </div>
          </div>
          <p className="mt-1 text-sm">
            <span className="text-zinc-500">Discrepancy: </span>
            <span className="font-mono font-medium text-amber-400">
              {formatCurrency(discrepancy.discrepancy_amount, currency)}
            </span>
          </p>
        </div>
        {onAnalyze && (
          <button
            onClick={() => onAnalyze(discrepancy.id)}
            className="shrink-0 rounded border border-accent/50 bg-accent/10 px-3 py-1.5 font-mono text-xs font-medium text-accent transition-colors hover:bg-accent/20"
          >
            Analyze
          </button>
        )}
      </div>
    </div>
  )
}
