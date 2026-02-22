import type {
  PDFListItem,
  PDFExtraction,
  ReconciliationResult,
  AIAnalysis,
  Discrepancy,
  MessageRichContent,
  Case,
  CaseStatus,
} from '../types'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export interface ChatResponse {
  content: string
  reconciliation?: ReconciliationResult
  analysis?: AIAnalysis
  pdf_extractions?: PDFExtraction[]
}

export function toRichContent(res: ChatResponse): MessageRichContent | undefined {
  if (!res.reconciliation && !res.analysis && !res.pdf_extractions) return undefined
  return {
    ...(res.reconciliation && {
      summary: res.reconciliation.summary,
      discrepancies: res.reconciliation.discrepancies,
    }),
    ...(res.analysis && { analysis: res.analysis }),
    ...(res.pdf_extractions && { pdfExtractions: res.pdf_extractions }),
  }
}

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || res.statusText || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function listPDFs(): Promise<PDFListItem[]> {
  return fetchApi<PDFListItem[]>('/pdf/list')
}

export async function extractPDFs(filenames: string[]): Promise<PDFExtraction[]> {
  return fetchApi<PDFExtraction[]>('/pdf/extract', {
    method: 'POST',
    body: JSON.stringify({ filenames }),
  })
}

export async function reconcile(): Promise<ReconciliationResult> {
  return fetchApi<ReconciliationResult>('/reconcile', {
    method: 'POST',
    body: '{}',
  })
}

export async function analyzeDiscrepancy(discrepancyId: string): Promise<AIAnalysis> {
  const res = await fetchApi<{ analysis: AIAnalysis }>('/analyze', {
    method: 'POST',
    body: JSON.stringify({ discrepancy_id: discrepancyId }),
  })
  return res.analysis
}

export async function analyzeDiscrepancyFull(discrepancy: Discrepancy): Promise<AIAnalysis> {
  const res = await fetchApi<{ analysis: AIAnalysis }>('/analyze', {
    method: 'POST',
    body: JSON.stringify({ discrepancy }),
  })
  return res.analysis
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ActionContext {
  id: string
  errand_id: string
  client_id: string
  custodian: string
  type: string
  amount_recoverable: number
  currency: string
  steps: string[]
  references?: Array<{ title: string; url: string }>
  status: string
}

export async function chat(
  message: string,
  history?: ChatTurn[],
  actionContext?: Case | ActionContext | null
): Promise<ChatResponse> {
  return fetchApi<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      history: history ?? [],
      ...(actionContext && { action_context: actionContext }),
    }),
  })
}

export async function listCases(): Promise<Case[]> {
  return fetchApi<Case[]>('/cases')
}

export async function transitionCaseStatus(
  caseId: string,
  status: CaseStatus,
  note?: string
): Promise<Case> {
  return fetchApi<Case>(`/cases/${caseId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...(note && { note }) }),
  })
}

export interface FormOption {
  key: string
  display_name: string
}

export interface CaseAttachmentResponse {
  id: string
  filename: string
  form_type: string
  created_at: string
}

export async function listForms(): Promise<FormOption[]> {
  return fetchApi<FormOption[]>('/forms')
}

export async function fillForm(
  caseId: string,
  formKey: string
): Promise<CaseAttachmentResponse> {
  return fetchApi<CaseAttachmentResponse>(`/cases/${caseId}/forms/fill`, {
    method: 'POST',
    body: JSON.stringify({ form_key: formKey }),
  })
}

export async function listAttachments(caseId: string): Promise<CaseAttachmentResponse[]> {
  return fetchApi<CaseAttachmentResponse[]>(`/cases/${caseId}/attachments`)
}

export function getAttachmentDownloadUrl(caseId: string, attachmentId: string): string {
  const base = import.meta.env.VITE_API_URL || '/api'
  return `${base}/cases/${caseId}/attachments/${attachmentId}`
}
