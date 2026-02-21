import type { ReconciliationSummary } from '../types'

interface SummaryStatsProps {
  summary: ReconciliationSummary
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function SummaryStats({ summary }: SummaryStatsProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="font-mono text-sm font-medium text-zinc-400">Reconciliation Summary</span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-zinc-500">Expected</p>
          <p className="font-mono text-lg font-medium text-zinc-200">{summary.total_expected}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Received</p>
          <p className="font-mono text-lg font-medium text-zinc-200">{summary.total_received}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Matched</p>
          <p className="font-mono text-lg font-medium text-green-500">{summary.total_matched}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Discrepancies</p>
          <p className="font-mono text-lg font-medium text-amber-400">{summary.total_discrepancies}</p>
        </div>
      </div>
      <div className="mt-4 border-t border-zinc-800 pt-4">
        <p className="text-xs text-zinc-500">Value at Risk</p>
        <p className="font-mono text-2xl font-semibold text-accent">
          {formatCurrency(summary.value_at_risk)}
        </p>
      </div>
    </div>
  )
}
