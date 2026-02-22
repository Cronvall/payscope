import { useState, useEffect } from 'react'
import {
  listPDFs,
  reconcile,
  analyzeDiscrepancyFull,
} from '../api/client'
import type {
  PDFListItem,
  ReconciliationResult,
  Discrepancy,
  AIAnalysis,
} from '../types'

const STEPS = ['pdfs', 'dashboard', 'detail', 'analysis'] as const
type Step = (typeof STEPS)[number]

function formatCurrency(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const CUSTODIAN_ICONS: Record<string, string> = {
  JPMORGAN_CHASE: '🏦',
  STATE_STREET: '📊',
  CITI: '💳',
  GOLDMAN_SACHS: '📈',
  default: '📄',
}

function getCustodianIcon(name: string): string {
  const key = Object.keys(CUSTODIAN_ICONS).find((k) =>
    name?.toUpperCase().includes(k)
  )
  return key ? CUSTODIAN_ICONS[key] : CUSTODIAN_ICONS.default
}

// Step 1: PDF sources view
function PDFsView({
  pdfs,
  onProcess,
  loading,
}: {
  pdfs: PDFListItem[]
  onProcess: () => void
  loading: boolean
}) {
  const displayPdfs =
    pdfs.length >= 4
      ? pdfs.slice(0, 4)
      : [
          { filename: 'JPMorgan Chase', size_bytes: 0, custodian_hint: 'JPMorgan' },
          { filename: 'State Street', size_bytes: 0, custodian_hint: 'State Street' },
          { filename: 'Goldman Sachs', size_bytes: 0, custodian_hint: 'Goldman' },
          { filename: 'Citi', size_bytes: 0, custodian_hint: 'Citi' },
        ].slice(0, 4)

  return (
    <div className="flex flex-col items-center justify-center gap-8 p-8">
      <div className="max-w-xl text-center">
        <h2 className="text-2xl font-semibold text-zinc-100 sm:text-3xl">
          AI dividend reconciliation
        </h2>
        <p className="mt-3 text-zinc-400">
          Asset managers receive thousands of payments across custodians. Errors in tax
          withholding and amounts cost millions. PayScope detects and explains them
          automatically.
        </p>
      </div>
      <div className="grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
        {displayPdfs.map((pdf) => (
          <div
            key={pdf.filename}
            className="flex flex-col items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/50 px-6 py-5 transition-all hover:border-zinc-600"
          >
            <span className="text-3xl">{getCustodianIcon(pdf.custodian_hint)}</span>
            <span className="truncate text-center font-mono text-sm text-zinc-300">
              {pdf.custodian_hint || pdf.filename}
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={onProcess}
        disabled={loading}
        className="rounded-lg bg-accent px-8 py-3 font-medium text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent/90 disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Process reconciliation'}
      </button>
    </div>
  )
}

// Step 2: Dashboard with big numbers
function DashboardView({
  result,
  onSelectDiscrepancy,
}: {
  result: ReconciliationResult
  onSelectDiscrepancy: (d: Discrepancy) => void
}) {
  const { summary, discrepancies, matched } = result
  const totalExpectedValue =
    matched.reduce((s, p) => s + p.expected_net_amount, 0) +
    discrepancies.reduce((s, d) => s + (d.expected?.expected_net_amount ?? 0), 0)
  const atRisk = summary.value_at_risk

  const appleDisc = discrepancies.find(
    (d) => d.expected?.ticker === 'AAPL' || d.expected?.company_name?.includes('Apple')
  )

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Total expected
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-400 sm:text-3xl">
            {formatCurrency(totalExpectedValue, true)}
          </p>
        </div>
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            At risk
          </p>
          <p className="mt-1 text-2xl font-bold text-red-400 sm:text-3xl">
            {formatCurrency(atRisk, true)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Validated
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-400 sm:text-3xl">
            {summary.total_matched} ✓
          </p>
        </div>
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Need attention
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-400 sm:text-3xl">
            {summary.total_discrepancies} ⚠
          </p>
        </div>
      </div>
      <div>
        <h3 className="mb-3 font-medium text-zinc-200">
          Discrepancies — click to analyze
        </h3>
        <div className="flex flex-wrap gap-3">
          {discrepancies.map((d) => {
            const isApple =
              d.expected?.ticker === 'AAPL' ||
              d.expected?.company_name?.includes('Apple')
            return (
              <button
                key={d.id}
                onClick={() => onSelectDiscrepancy(d)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-sm transition-all ${
                  isApple
                    ? 'border-2 border-accent bg-accent/10 text-accent hover:bg-accent/20'
                    : 'border border-zinc-600 bg-zinc-800/50 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800'
                }`}
              >
                <span>{d.expected?.ticker ?? d.id}</span>
                <span className="text-amber-400">
                  {formatCurrencyFull(d.discrepancy_amount)}
                </span>
              </button>
            )
          })}
        </div>
        {appleDisc && (
          <p className="mt-4 text-sm text-zinc-500">
            💡 Click <strong className="text-accent">AAPL</strong> to see AI root
            cause analysis
          </p>
        )}
      </div>
    </div>
  )
}

// Step 3: Discrepancy detail
function DetailView({
  discrepancy,
  onAnalyze,
  analyzing,
}: {
  discrepancy: Discrepancy
  onAnalyze: () => void
  analyzing: boolean
}) {
  const exp = discrepancy.expected
  const rec = discrepancy.received

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">
              {exp?.company_name ?? 'Unknown'} ({exp?.ticker ?? '—'})
            </h2>
            <p className="mt-1 font-mono text-sm text-zinc-500">
              {discrepancy.id} · {discrepancy.type.replace(/_/g, ' ')}
            </p>
          </div>
          <span className="rounded-lg bg-amber-900/50 px-3 py-1 font-mono text-sm font-medium text-amber-400">
            {formatCurrencyFull(discrepancy.discrepancy_amount)} at risk
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">Expected</p>
            <p className="font-mono text-lg text-emerald-400">
              {formatCurrencyFull(exp?.expected_net_amount ?? 0)}
            </p>
            <p className="text-xs text-zinc-500">
              Tax treaty: {exp?.tax_treaty} @ {exp?.tax_treaty_rate}%
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">Received</p>
            <p className="font-mono text-lg text-zinc-300">
              {rec ? formatCurrencyFull(rec.received_net_amount) : '—'}
            </p>
            {rec && (
              <p className="text-xs text-zinc-500">
                Tax withheld: {formatCurrencyFull(rec.tax_withheld)}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">Gap</p>
            <p className="font-mono text-lg text-amber-400">
              {formatCurrencyFull(discrepancy.discrepancy_amount)}
            </p>
          </div>
        </div>
      </div>
      <button
        onClick={onAnalyze}
        disabled={analyzing}
        className="self-start rounded-lg bg-accent px-8 py-3 font-medium text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent/90 disabled:opacity-50"
      >
        {analyzing ? 'Claude analyzing...' : 'Analyze with AI'}
      </button>
    </div>
  )
}

// Step 4: AI analysis reveal
function AIAnalysisView({
  analysis,
  discrepancy,
  animate,
  onRestart,
}: {
  analysis: AIAnalysis | null
  discrepancy: Discrepancy
  animate: boolean
  onRestart: () => void
}) {
  const companyName = discrepancy.expected?.company_name ?? discrepancy.id
  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-accent">
          <span>✨</span> Claude root cause analysis — {companyName}
        </h2>
        {!analysis ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-4 w-full animate-pulse rounded bg-zinc-700/50"
                style={{ width: `${60 + i * 15}%` }}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Verification steps
              </p>
              <ul className="space-y-2">
                {analysis.verification_steps.map((step, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-2 text-sm text-zinc-300 ${
                      animate ? 'animate-fade-in' : ''
                    }`}
                    style={{ animationDelay: `${i * 200}ms` }}
                  >
                    <span className="text-emerald-500">✓</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Root cause
              </p>
              <p className="text-zinc-200">{analysis.root_cause}</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Recommendation
              </p>
              <p className="text-zinc-300">{analysis.recommendation}</p>
            </div>
            <div className="rounded-lg bg-emerald-900/30 px-4 py-3">
              <p className="text-xs font-medium uppercase text-zinc-500">
                Recoverable amount
              </p>
              <p className="text-2xl font-bold text-emerald-400">
                {formatCurrencyFull(analysis.recoverable_amount)}
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-sm text-zinc-500">
          PayScope: AI-powered dividend reconciliation · Powered by Claude Sonnet 4
        </p>
        <button
          onClick={onRestart}
          className="text-sm text-accent hover:underline"
        >
          Start over
        </button>
      </div>
    </div>
  )
}

export default function DemoPage() {
  const [step, setStep] = useState<Step>('pdfs')
  const [stepIndex, setStepIndex] = useState(0)
  const [pdfs, setPdfs] = useState<PDFListItem[]>([])
  const [result, setResult] = useState<ReconciliationResult | null>(null)
  const [selectedDiscrepancy, setSelectedDiscrepancy] =
    useState<Discrepancy | null>(null)
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [animateAnalysis, setAnimateAnalysis] = useState(false)

  useEffect(() => {
    listPDFs()
      .then(setPdfs)
      .catch(() => setPdfs([]))
  }, [])

  const handleProcess = async () => {
    setLoading(true)
    try {
      const recon = await reconcile()
      setResult(recon)
      setStep('dashboard')
      setStepIndex(1)
    } catch (e) {
      console.error('Reconcile failed:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectDiscrepancy = (d: Discrepancy) => {
    setSelectedDiscrepancy(d)
    setAnalysis(null)
    setStep('detail')
    setStepIndex(2)
  }

  const handleAnalyze = async () => {
    if (!selectedDiscrepancy) return
    setAnalyzing(true)
    setStep('analysis')
    setStepIndex(3)
    setAnimateAnalysis(false)
    try {
      const a = await analyzeDiscrepancyFull(selectedDiscrepancy)
      setAnalysis(a)
      setAnimateAnalysis(true)
    } catch (e) {
      console.error('Analyze failed:', e)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-canvas">
      {/* Progress bar */}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm ${
                  i <= stepIndex
                    ? 'bg-accent text-white'
                    : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-8 sm:w-12 ${
                    i < stepIndex ? 'bg-accent' : 'bg-zinc-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-zinc-500">
          Step {stepIndex + 1} of 4
        </p>
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {step === 'pdfs' && (
          <PDFsView pdfs={pdfs} onProcess={handleProcess} loading={loading} />
        )}
        {step === 'dashboard' && result && (
          <DashboardView
            result={result}
            onSelectDiscrepancy={handleSelectDiscrepancy}
          />
        )}
        {step === 'detail' && selectedDiscrepancy && (
          <DetailView
            discrepancy={selectedDiscrepancy}
            onAnalyze={handleAnalyze}
            analyzing={analyzing}
          />
        )}
        {step === 'analysis' && selectedDiscrepancy && (
          <AIAnalysisView
            analysis={analysis}
            discrepancy={selectedDiscrepancy}
            animate={animateAnalysis}
            onRestart={() => {
              setStep('pdfs')
              setStepIndex(0)
              setResult(null)
              setSelectedDiscrepancy(null)
              setAnalysis(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
