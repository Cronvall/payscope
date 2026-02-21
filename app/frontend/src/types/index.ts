export type DiscrepancyType = 'TAX_ERROR' | 'MISSING_PAYMENT' | 'AMOUNT_MISMATCH' | 'OVERPAYMENT'
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type ExpectedStatus = 'PENDING' | 'NO_DIVIDEND'
export type SettlementStatus = 'SETTLED' | 'PENDING' | 'FAILED'

export interface ExpectedPayment {
  expected_id: string
  isin: string
  sedol: string
  ticker: string
  company_name: string
  ex_date: string
  pay_date: string
  holding_quantity: number
  div_rate: number
  quotation_currency: string
  expected_gross_amount: number
  tax_treaty: string
  tax_treaty_rate: number
  expected_tax: number
  expected_net_amount: number
  custodian: string
  account_number: string
  calculation_date: string
  expected_status: ExpectedStatus
}

export interface ReceivedPayment {
  received_id: string
  custodian_ref: string
  isin: string
  sedol: string
  ticker: string
  company_name: string
  pay_date: string
  settlement_date: string
  received_gross_amount: number
  tax_withheld: number
  received_net_amount: number
  settlement_currency: string
  custodian: string
  account_number: string
  received_timestamp: string
  settlement_status: SettlementStatus
  notes?: string | null
}

export interface AIAnalysis {
  verification_steps: string[]
  root_cause: string
  explanation: string
  recommendation: string
  recoverable_amount: number
  timeline: string
}

export interface Discrepancy {
  id: string
  type: DiscrepancyType
  severity: Severity
  expected: ExpectedPayment
  received: ReceivedPayment | null
  discrepancy_amount: number
  detected_at: string
  analysis?: AIAnalysis | null
}

export interface ReconciliationSummary {
  total_expected: number
  total_received: number
  total_matched: number
  total_discrepancies: number
  value_at_risk: number
}

export interface ReconciliationResult {
  discrepancies: Discrepancy[]
  matched: ExpectedPayment[]
  summary: ReconciliationSummary
}

export interface ExtractedPayment {
  company: string
  isin?: string | null
  ticker?: string | null
  shares?: number | null
  rate?: number | null
  gross?: number | null
  tax?: number | null
  net?: number | null
  currency?: string | null
}

export interface PDFExtraction {
  filename: string
  custodian?: string | null
  account?: string | null
  date?: string | null
  payments: ExtractedPayment[]
}

export interface PDFListItem {
  filename: string
  size_bytes: number
  custodian_hint: string
}

export interface MessageRichContent {
  summary?: ReconciliationSummary
  discrepancies?: Discrepancy[]
  analysis?: AIAnalysis
  pdfExtractions?: PDFExtraction[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  richContent?: MessageRichContent
}

export type CaseStatus =
  | 'NEW'
  | 'AI_ANALYZED'
  | 'UNDER_REVIEW'
  | 'DOCUMENT_REQUESTED'
  | 'CLAIM_SUBMITTED'
  | 'RECOVERED'
  | 'WRITTEN_OFF'

export interface CaseStatusHistoryEntry {
  from_status: string | null
  to_status: string
  changed_at: string
  note?: string | null
}

export interface ActionItemReference {
  title: string
  url: string
}

export interface ActionItem {
  id: string
  errand_id: string
  client_id: string
  custodian: string
  type: string
  amount_recoverable: number
  currency: string
  steps: string[]
  references?: ActionItemReference[]
  status: string
}

export interface Case {
  id: string
  errand_id: string
  client_id: string
  custodian: string
  type: string
  amount_recoverable: number
  currency: string
  steps: string[]
  references?: ActionItemReference[]
  status: CaseStatus
  history?: CaseStatusHistoryEntry[]
  created_at: string
  updated_at: string
}
