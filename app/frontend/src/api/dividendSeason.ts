import type { Case } from '../types'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export type DividendSeasonEvent =
  | { type: 'errand'; payload: Record<string, unknown> }
  | { type: 'evaluated'; payload: Record<string, unknown> }
  | { type: 'action'; payload: Case }

export function subscribeToDividendSeasonStream(
  onEvent: (event: DividendSeasonEvent) => void,
  onEnd?: () => void,
  options?: { demo?: boolean }
): () => void {
  const params = new URLSearchParams()
  if (options?.demo) params.set('demo', '1')
  const qs = params.toString()
  const url = `${API_BASE}/dividend-season/stream${qs ? `?${qs}` : ''}`
  const eventSource = new EventSource(url)

  eventSource.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as DividendSeasonEvent
      onEvent(event)
    } catch {
      // ignore parse errors
    }
  }

  eventSource.onerror = () => {
    eventSource.close()
    onEnd?.()
  }

  return () => {
    eventSource.close()
    onEnd?.()
  }
}
