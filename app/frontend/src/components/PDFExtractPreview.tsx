import type { PDFExtraction } from '../types'

interface PDFExtractPreviewProps {
  extraction: PDFExtraction
}

function formatNumber(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export default function PDFExtractPreview({ extraction }: PDFExtractPreviewProps) {
  const { custodian, account, date, payments } = extraction

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-3 flex flex-wrap gap-4 text-sm">
        {custodian && (
          <div>
            <span className="text-zinc-500">Custodian: </span>
            <span className="font-mono text-zinc-200">{custodian}</span>
          </div>
        )}
        {account && (
          <div>
            <span className="text-zinc-500">Account: </span>
            <span className="font-mono text-zinc-200">{account}</span>
          </div>
        )}
        {date && (
          <div>
            <span className="text-zinc-500">Date: </span>
            <span className="font-mono text-zinc-200">{date}</span>
          </div>
        )}
      </div>
      {payments.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="py-2 text-left text-zinc-500">Company</th>
                <th className="py-2 text-right text-zinc-500">Gross</th>
                <th className="py-2 text-right text-zinc-500">Tax</th>
                <th className="py-2 text-right text-zinc-500">Net</th>
                <th className="py-2 text-left text-zinc-500">Currency</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={i} className="border-b border-zinc-800/50">
                  <td className="py-1.5 font-mono text-zinc-200">{p.company}</td>
                  <td className="py-1.5 text-right font-mono text-zinc-300">
                    {p.gross != null ? formatNumber(p.gross, p.currency || undefined) : '—'}
                  </td>
                  <td className="py-1.5 text-right font-mono text-zinc-300">
                    {p.tax != null ? formatNumber(p.tax, p.currency || undefined) : '—'}
                  </td>
                  <td className="py-1.5 text-right font-mono text-zinc-300">
                    {p.net != null ? formatNumber(p.net, p.currency || undefined) : '—'}
                  </td>
                  <td className="py-1.5 text-zinc-500">{p.currency ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No payments extracted</p>
      )}
    </div>
  )
}
