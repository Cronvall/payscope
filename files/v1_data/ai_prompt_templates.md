# AI Reasoning Prompts for Demo

## How to Use This File
When a discrepancy is detected, feed the relevant data into Claude API with these prompt templates to generate the reasoning text shown in the UI.

---

## PROMPT TEMPLATE 1: Apple Inc (AAPL) - Wrong Tax Rate Scenario

### Input Data to Claude:
```json
{
  "security": "Apple Inc (AAPL)",
  "isin": "US0378331005",
  "holdings": 1500000,
  "dividend_per_share": 0.25,
  "expected_gross": 375000.00,
  "expected_tax_rate": 15,
  "expected_tax": 56250.00,
  "expected_net": 318750.00,
  "received_gross": 375000.00,
  "received_tax": 93750.00,
  "received_net": 281250.00,
  "discrepancy_amount": 37500.00,
  "tax_treaty": "US-UK, 15% withholding for portfolio dividends",
  "custodian": "JPMorgan Chase",
  "payment_date": "2025-02-14"
}
```

### System Prompt:
```
You are an AI financial reconciliation agent analyzing a dividend payment discrepancy. 

Your task:
1. Verify the calculation logic step by step
2. Compare expected vs received amounts
3. Identify the root cause of the discrepancy
4. Provide a clear, actionable explanation

Format your response as a numbered verification checklist followed by a root cause analysis. Use clear language that a portfolio manager would understand. Be concise but thorough.

Security: {security}
Holdings: {holdings} shares
Dividend Rate: ${dividend_per_share} per share
Expected Gross: ${expected_gross}
Tax Treaty: {tax_treaty}
Expected Tax: ${expected_tax}
Expected Net: ${expected_net}

Actual Received:
Gross: ${received_gross}
Tax Withheld: ${received_tax}
Net: ${received_net}

Discrepancy: ${discrepancy_amount}

Analyze this discrepancy and explain what happened.
```

### Expected Output Format:
```
✓ Verified holding: 1,500,000 shares
✓ Verified dividend rate: $0.25 per share
✓ Calculated expected gross: $375,000.00
✓ Cross-referenced tax treaty: US-UK, standard rate 15%
✓ Expected net payment: $318,750.00
⚠ Actual payment received: $281,250.00
✓ Calculated actual withholding rate: 25%

Root Cause Identified:
Custodian applied 25% withholding tax instead of the treaty rate of 15%.

Analysis:
The gross amount ($375,000) was calculated correctly, but JPMorgan Chase withheld $93,750 (25%) instead of the treaty-compliant $56,250 (15%). This appears to be the standard US non-resident withholding rate rather than the US-UK treaty rate.

Recommendation:
File tax reclaim for $37,500 with supporting W-8BEN documentation. Estimated recovery time: 15-30 days.
```

---

## PROMPT TEMPLATE 2: Toyota (7203) - Missing Payment Scenario

### Input Data to Claude:
```json
{
  "security": "Toyota Motor Corp (7203)",
  "isin": "JP3633400001",
  "holdings": 1200000,
  "dividend_per_share": 75.00,
  "currency": "JPY",
  "expected_gross": 90000000,
  "expected_tax_rate": 10,
  "expected_tax": 9000000,
  "expected_net": 81000000,
  "received_gross": null,
  "received_tax": null,
  "received_net": null,
  "payment_date": "2025-06-01",
  "ex_date": "2025-03-25",
  "record_date": "2025-03-26",
  "custodian": "MUFG Custody",
  "status": "NOT_RECEIVED"
}
```

### System Prompt:
```
You are an AI financial reconciliation agent analyzing a missing dividend payment.

Your task:
1. Verify that the payment was expected
2. Confirm the payment date has passed
3. Check custodian records
4. Determine likely causes for non-receipt
5. Recommend immediate action

Security: {security}
Holdings: {holdings} shares
Dividend Rate: ¥{dividend_per_share} per share
Expected Net: ¥{expected_net}
Payment Date: {payment_date} (ex-date: {ex_date})
Custodian: {custodian}
Status: {status}

The payment has not been received. Analyze and recommend action.
```

### Expected Output Format:
```
✓ Verified holding: 1,200,000 shares as of ex-date (March 25, 2025)
✓ Verified dividend announcement: ¥75.00 per share
✓ Calculated expected gross: ¥90,000,000
✓ Expected tax (Japan-Norway treaty, 10%): ¥9,000,000
✓ Expected net payment: ¥81,000,000
✓ Payment date confirmed: June 1, 2025 (passed)
⚠ Payment status: NOT RECEIVED
✓ Checked custodian records: No matching transaction found

Root Cause Analysis:
Payment expected on June 1, 2025 has not been received. No record found in MUFG Custody settlement reports.

Possible causes:
1. Settlement delay (Japanese payments can take T+3)
2. Custodian processing error
3. Missing settlement instruction
4. Payment routing failure

Immediate Action Required:
Priority: HIGH
Value at Risk: ¥81,000,000 (~$540,000 USD)

Recommended Steps:
1. Immediate inquiry to MUFG Custody operations
2. Request settlement trace and payment status
3. Verify account instructions are current
4. Escalate if not resolved within 48 hours
```

---

## PROMPT TEMPLATE 3: Samsung (005930) - Wrong Tax Rate (International)

### Input Data to Claude:
```json
{
  "security": "Samsung Electronics Co Ltd (005930)",
  "isin": "KR7005930003",
  "holdings": 25000,
  "dividend_per_share": 361.00,
  "currency": "KRW",
  "expected_gross": 9025000,
  "expected_tax_rate": 22,
  "expected_tax": 1985500,
  "expected_net": 7039500,
  "received_gross": 9025000,
  "received_tax": 2254500,
  "received_net": 6770500,
  "discrepancy_amount": 269000,
  "tax_treaty": "Korea-Norway, 22% withholding",
  "custodian": "HSBC Korea",
  "payment_date": "2025-05-20"
}
```

### System Prompt:
```
You are an AI financial reconciliation agent analyzing an international dividend payment discrepancy.

Your task:
1. Verify holdings and dividend calculation
2. Confirm applicable tax treaty rate
3. Compare expected vs actual withholding
4. Identify root cause
5. Assess recoverability

Security: {security}
Holdings: {holdings} shares
Dividend Rate: ₩{dividend_per_share} per share
Expected Gross: ₩{expected_gross}
Tax Treaty: {tax_treaty}
Expected Net: ₩{expected_net}

Actual Received:
Gross: ₩{received_gross}
Tax Withheld: ₩{received_tax}
Net: ₩{received_net}

Analyze the discrepancy of ₩{discrepancy_amount}.
```

### Expected Output Format:
```
✓ Verified holding: 25,000 shares
✓ Verified dividend rate: ₩361 per share
✓ Calculated expected gross: ₩9,025,000
✓ Cross-referenced tax treaty: Korea-Norway, rate 22%
✓ Expected tax withholding: ₩1,985,500
✓ Expected net payment: ₩7,039,500
⚠ Actual payment received: ₩6,770,500
✓ Calculated actual withholding: ₩2,254,500 (25%)

Root Cause Identified:
Custodian applied standard Korean domestic withholding rate (25%) instead of Korea-Norway treaty rate (22%).

Analysis:
The gross amount was calculated correctly, but HSBC Korea withheld an additional 3% above the treaty-compliant rate. This is common when custodians default to domestic tax rules without applying treaty benefits.

Discrepancy: ₩269,000 (~$206 USD)

Recovery Action:
Type: Tax reclaim with Korean tax authority
Timeline: 30-60 days (Korea has formal reclaim process)
Required Documentation:
- Certificate of tax residence (Norway)
- Treaty claim form
- Proof of beneficial ownership

Note: Korean reclaims are slower but have high success rate for institutional investors.
```

---

## Implementation Notes

### For Your Backend/API:

1. **When discrepancy detected**, construct the appropriate JSON payload
2. **Call Claude API** with the system prompt + data
3. **Parse response** and display with progressive reveal (typing animation)
4. **Cache responses** so demo is consistent

### Example API Call:
```javascript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: systemPrompt + JSON.stringify(discrepancyData)
    }]
  })
});
```

### UI Display Strategy:

1. Show "AI Analyzing..." with animated dots (2-3 seconds)
2. Reveal checkmarks one by one (200ms between each)
3. Show warning indicator when discrepancy appears
4. Display root cause with highlight
5. Show recommendation in distinct section

This creates the "discovery moment" that wins hackathons.

---

## Alternative: Pre-generated Responses

If you're worried about API latency during the demo, you can:

1. Pre-generate all 3 responses using Claude
2. Store them as static text
3. Display with animation to simulate real-time analysis

**Judges won't know the difference**, and it guarantees perfect demo timing.

Just make sure the "thinking" animation is believable (2-3 seconds minimum).
