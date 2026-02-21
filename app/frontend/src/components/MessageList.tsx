import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import DiscrepancyCard from './DiscrepancyCard'
import AIAnalysisCard from './AIAnalysisCard'
import SummaryStats from './SummaryStats'
import PDFExtractPreview from './PDFExtractPreview'
import type { Message } from '../types'

interface MessageListProps {
  messages: Message[]
  onAnalyzeDiscrepancy: (id: string) => void
  loading?: boolean
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[85%] items-center gap-1.5 rounded-lg bg-zinc-800/80 px-4 py-3">
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-zinc-500"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-zinc-500"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-zinc-500"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  )
}

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-zinc-100">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-2 overflow-x-auto rounded bg-zinc-800/80 p-3 font-mono text-xs">{children}</pre>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    className ? (
      <code className="font-mono text-xs">{children}</code>
    ) : (
      <code className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-xs">{children}</code>
    ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-2 list-inside list-disc space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-2 list-inside list-decimal space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-sm">{children}</li>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline hover:text-accent/80"
    >
      {children}
    </a>
  ),
  br: () => <br />,
}

export default function MessageList({ messages, onAnalyzeDiscrepancy, loading }: MessageListProps) {
  return (
    <div className="flex flex-col gap-6 px-4 py-6 pb-8">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] ${
              msg.role === 'user'
                ? 'rounded-lg bg-accent/20 px-4 py-2 text-zinc-200'
                : 'space-y-3'
            }`}
          >
            {msg.role === 'user' ? (
              <div className="markdown-body text-sm">
                <ReactMarkdown remarkPlugins={[remarkBreaks]} components={markdownComponents}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="space-y-3">
                {msg.content && (
                  <div className="markdown-body text-sm text-zinc-300">
                    <ReactMarkdown remarkPlugins={[remarkBreaks]} components={markdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
                {msg.richContent?.summary && <SummaryStats summary={msg.richContent.summary} />}
                {msg.richContent?.discrepancies?.map((d) => (
                  <DiscrepancyCard
                    key={d.id}
                    discrepancy={d}
                    onAnalyze={onAnalyzeDiscrepancy}
                  />
                ))}
                {msg.richContent?.analysis && <AIAnalysisCard analysis={msg.richContent.analysis} />}
                {msg.richContent?.pdfExtractions?.map((e, i) => (
                  <PDFExtractPreview key={i} extraction={e} />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      {loading && <TypingIndicator />}
    </div>
  )
}
