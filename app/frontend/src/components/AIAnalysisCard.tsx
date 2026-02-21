import type { AIAnalysis } from '../types'

interface AIAnalysisCardProps {
  analysis: AIAnalysis
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function AIAnalysisCard({ analysis }: AIAnalysisCardProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Root Cause</p>
        <p className="mt-1 font-mono text-sm text-zinc-200">{analysis.root_cause}</p>
      </div>
      <div className="mb-3 space-y-1.5">
        {analysis.verification_steps.map((step, i) => {
          const isWarning = step.startsWith('⚠') || step.toLowerCase().includes('actual')
          const cleanStep = step.replace(/^[✓⚠]\s*/, '')
          return (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 shrink-0">
                {isWarning ? (
                  <span className="text-amber-400">⚠</span>
                ) : (
                  <span className="text-green-500">✓</span>
                )}
              </span>
              <span className="text-zinc-300">{cleanStep}</span>
            </div>
          )
        })}
      </div>
      <div className="mb-3 border-t border-zinc-800 pt-3">
        <p className="text-xs text-zinc-500">{analysis.explanation}</p>
      </div>
      <div className="mb-3">
        <p className="text-xs text-zinc-500">Recommendation</p>
        <p className="mt-0.5 text-sm text-zinc-300">{analysis.recommendation}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3 text-sm">
        <span className="font-mono font-medium text-green-400">
          Recoverable: {formatCurrency(analysis.recoverable_amount)}
        </span>
        <span className="text-zinc-500">•</span>
        <span className="text-zinc-400">Timeline: {analysis.timeline}</span>
      </div>
    </div>
  )
}
