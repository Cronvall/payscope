import { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react'
import { reconcile, analyzeDiscrepancy, extractPDFs, chat, toRichContent, listCases, transitionCaseStatus } from '../api/client'
import { subscribeToDividendSeasonStream, type DividendSeasonEvent } from '../api/dividendSeason'
import type { Message, ReconciliationResult, PDFExtraction, Case, CaseStatus } from '../types'

let nextId = 1
function genId() {
  return `msg-${nextId++}`
}

export interface StreamLogEntry {
  id: string
  type: 'errand' | 'evaluated' | 'action'
  message: string
  timestamp: number
}

interface WorkspaceContextValue {
  messages: Message[]
  actionMessages: Record<string, Message[]>
  loading: boolean
  error: string | null
  runReconciliation: () => Promise<void>
  runAnalyze: (id: string) => Promise<void>
  extractPDF: (filename: string) => Promise<void>
  sendChatMessage: (content: string, actionContext?: Case | null) => Promise<void>
  actionItems: Case[]
  transitionCaseStatus: (caseId: string, status: CaseStatus, note?: string) => Promise<void>
  dividendSeasonStreaming: boolean
  errandsOptimized: number
  streamLogs: StreamLogEntry[]
  selectedAction: Case | null
  setSelectedAction: (action: Case | null) => void
  startDividendSeason: () => void
  stopDividendSeason: () => void
  eventStreamPaused: boolean
  togglePauseDividendSeason: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionItems, setActionItems] = useState<Case[]>([])
  const [dividendSeasonStreaming, setDividendSeasonStreaming] = useState(false)
  const [errandsOptimized, setErrandsOptimized] = useState(0)
  const [streamLogs, setStreamLogs] = useState<StreamLogEntry[]>([])
  const [selectedAction, setSelectedAction] = useState<Case | null>(null)
  const [actionMessages, setActionMessages] = useState<Record<string, Message[]>>({})
  const [eventStreamPaused, setEventStreamPaused] = useState(false)
  const logIdRef = useRef(0)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const pausedRef = useRef(false)
  const eventBufferRef = useRef<DividendSeasonEvent[]>([])

  useEffect(() => {
    pausedRef.current = eventStreamPaused
  }, [eventStreamPaused])

  const addUserMessage = useCallback((content: string) => {
    setMessages((m) => [...m, { id: genId(), role: 'user', content }])
  }, [])

  const addAssistantMessage = useCallback(
    (content: string, richContent?: Message['richContent']) => {
      setMessages((m) => [
        ...m,
        { id: genId(), role: 'assistant', content, richContent },
      ])
    },
    []
  )

  const runReconciliation = useCallback(async () => {
    addUserMessage('Run reconciliation')
    setLoading(true)
    setError(null)
    try {
      const result: ReconciliationResult = await reconcile()
      addAssistantMessage(
        `Reconciliation complete. Found ${result.summary.total_discrepancies} discrepancy(ies) with $${result.summary.value_at_risk.toLocaleString()} at risk.`,
        {
          summary: result.summary,
          discrepancies: result.discrepancies,
        }
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reconciliation failed'
      setError(msg)
      addAssistantMessage(`Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [addUserMessage, addAssistantMessage])

  const runAnalyze = useCallback(
    async (discrepancyId: string) => {
      addUserMessage(`Analyze ${discrepancyId}`)
      setLoading(true)
      setError(null)
      try {
        const analysis = await analyzeDiscrepancy(discrepancyId)
        addAssistantMessage(`AI analysis for ${discrepancyId}:`, {
          analysis,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Analysis failed'
        setError(msg)
        addAssistantMessage(`Error: ${msg}`)
      } finally {
        setLoading(false)
      }
    },
    [addUserMessage, addAssistantMessage]
  )

  const extractPDF = useCallback(
    async (filename: string) => {
      addUserMessage(`Extract ${filename}`)
      setLoading(true)
      setError(null)
      try {
        const extractions: PDFExtraction[] = await extractPDFs([filename])
        const ext = extractions[0]
        if (ext) {
          addAssistantMessage(`Extracted from ${filename}`, {
            pdfExtractions: [ext],
          })
        } else {
          addAssistantMessage(`No data extracted from ${filename}`)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Extraction failed'
        setError(msg)
        addAssistantMessage(`Error: ${msg}`)
      } finally {
        setLoading(false)
      }
    },
    [addUserMessage, addAssistantMessage]
  )

  useEffect(() => {
    listCases().then(setActionItems).catch(() => {})
  }, [])

  const transitionCaseStatusHandler = useCallback(
    async (caseId: string, status: CaseStatus, note?: string) => {
      try {
        const updated = await transitionCaseStatus(caseId, status, note)
        setActionItems((prev) => {
          const idx = prev.findIndex((c) => c.id === caseId)
          if (idx < 0) return prev
          const next = [...prev]
          next[idx] = updated
          return next
        })
        if (selectedAction?.id === caseId) {
          setSelectedAction(updated)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update status')
      }
    },
    [selectedAction]
  )

  const sendChatMessage = useCallback(
    async (content: string, actionContext?: Case | null) => {
      const history = actionContext
        ? (actionMessages[actionContext.id] ?? []).map((m) => ({ role: m.role, content: m.content }))
        : messages.map((m) => ({ role: m.role, content: m.content }))

      if (actionContext) {
        setActionMessages((prev) => ({
          ...prev,
          [actionContext.id]: [
            ...(prev[actionContext.id] ?? []),
            { id: genId(), role: 'user', content },
          ],
        }))
      } else {
        addUserMessage(content)
      }

      setLoading(true)
      setError(null)
      try {
        const res = await chat(content, history, actionContext ?? undefined)
        const assistantContent = res.content
        const richContent = toRichContent(res)

        if (actionContext) {
          setActionMessages((prev) => ({
            ...prev,
            [actionContext.id]: [
              ...(prev[actionContext.id] ?? []),
              { id: genId(), role: 'assistant', content: assistantContent, richContent },
            ],
          }))
        } else {
          addAssistantMessage(assistantContent, richContent)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed'
        setError(msg)
        if (actionContext) {
          setActionMessages((prev) => ({
            ...prev,
            [actionContext.id]: [
              ...(prev[actionContext.id] ?? []),
              { id: genId(), role: 'assistant', content: `Error: ${msg}` },
            ],
          }))
        } else {
          addAssistantMessage(`Error: ${msg}`)
        }
      } finally {
        setLoading(false)
      }
    },
    [addUserMessage, addAssistantMessage, messages, actionMessages]
  )

  const processEvent = useCallback((event: DividendSeasonEvent) => {
    const addLog = (type: StreamLogEntry['type'], message: string) => {
      logIdRef.current += 1
      setStreamLogs((prev) => [
        ...prev,
        { id: `log-${logIdRef.current}`, type, message, timestamp: Date.now() },
      ])
    }
    if (event.type === 'errand') {
      const errand = event.payload as { errand_id?: string }
      addLog('errand', `Errand received: ${errand.errand_id ?? 'unknown'}`)
    } else if (event.type === 'evaluated') {
      const eval_ = event.payload as { errand_id?: string; worth_it?: boolean }
      if (eval_.worth_it) {
        addLog('evaluated', `Evaluated: ${eval_.errand_id ?? 'unknown'} — Action needed`)
      } else {
        setErrandsOptimized((c) => c + 1)
        addLog('evaluated', `Evaluated: ${eval_.errand_id ?? 'unknown'} ✓ Optimized`)
      }
    } else if (event.type === 'action') {
      const case_ = event.payload
      setActionItems((prev) => {
        const idx = prev.findIndex((c) => c.id === case_.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = case_
          return next
        }
        return [...prev, case_]
      })
      addLog('action', `Case created: ${event.payload.id}`)
    }
  }, [])

  const startDividendSeason = useCallback(() => {
    if (unsubscribeRef.current) return
    setErrandsOptimized(0)
    setStreamLogs([])
    setEventStreamPaused(false)
    eventBufferRef.current = []
    setDividendSeasonStreaming(true)
    const unsubscribe = subscribeToDividendSeasonStream(
      (event) => {
        if (pausedRef.current) {
          eventBufferRef.current.push(event)
        } else {
          processEvent(event)
        }
      },
      () => {
        setDividendSeasonStreaming(false)
        unsubscribeRef.current = null
      }
    )
    unsubscribeRef.current = () => {
      unsubscribe()
      setDividendSeasonStreaming(false)
      unsubscribeRef.current = null
    }
  }, [processEvent])

  const stopDividendSeason = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
    }
    setDividendSeasonStreaming(false)
    setEventStreamPaused(false)
    eventBufferRef.current = []
    setStreamLogs([])
    setErrandsOptimized(0)
  }, [])

  const EVENT_REPLAY_INTERVAL_MS = 500

  const togglePauseDividendSeason = useCallback(() => {
    setEventStreamPaused((prev) => {
      const next = !prev
      if (prev && !next) {
        const buf = [...eventBufferRef.current]
        eventBufferRef.current = []
        buf.forEach((event, i) => {
          setTimeout(() => processEvent(event), i * EVENT_REPLAY_INTERVAL_MS)
        })
      }
      return next
    })
  }, [processEvent])

  const value: WorkspaceContextValue = {
    messages,
    actionMessages,
    loading,
    error,
    runReconciliation,
    runAnalyze,
    extractPDF,
    sendChatMessage,
    actionItems,
    transitionCaseStatus: transitionCaseStatusHandler,
    dividendSeasonStreaming,
    errandsOptimized,
    streamLogs,
    selectedAction,
    setSelectedAction,
    startDividendSeason,
    stopDividendSeason,
    eventStreamPaused,
    togglePauseDividendSeason,
  }

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
