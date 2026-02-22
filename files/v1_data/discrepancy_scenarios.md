# Mock Data Discrepancy Scenarios for Demo

## Overview
This dataset contains 10 expected payments with 3 intentional discrepancies designed to showcase different AI detection capabilities.

---

## SCENARIO 1: Wrong Tax Withholding Rate (MOST IMPORTANT - USE FOR MAIN DEMO)

**Security:** Apple Inc (AAPL) - US0378331005
**Expected Payment ID:** EXP001
**Received Payment ID:** REC001

### The Setup:
- **Holdings:** 1,500,000 shares
- **Dividend Rate:** $0.25 per share
- **Expected Gross:** $375,000.00
- **Tax Treaty (US-UK):** 15% withholding
- **Expected Tax:** $56,250.00
- **Expected Net:** $318,750.00

### What Actually Happened:
- **Received Gross:** $375,000.00 ✓
- **Tax Withheld:** $93,750.00 ✗ (25% instead of 15%)
- **Received Net:** $281,250.00 ✗

### The Discrepancy:
**Missing Amount:** $37,500.00 (10% over-withholding)

### AI Reasoning Flow (for demo):
1. ✓ Verified holding: 1,500,000 shares
2. ✓ Verified dividend rate: $0.25/share
3. ✓ Calculated expected gross: $375,000
4. ✓ Cross-referenced tax treaty: US-UK, standard rate 15%
5. ✓ Expected net payment: $318,750
6. ⚠ Actual payment received: $281,250
7. ✓ Identified withholding applied: 25%
8. 🎯 **Root Cause:** Custodian applied incorrect 25% withholding rate instead of treaty rate of 15%

### Recovery Action:
- **Type:** Tax reclaim with custodian
- **Amount Recoverable:** $37,500.00
- **Timeline:** 15-30 days
- **Required Documentation:** 
  - W-8BEN tax treaty certification
  - Holding verification
  - Payment statement

### Demo Impact:
This is your **HERO SCENARIO**. It's easy to explain, has clear numbers, and demonstrates the AI's ability to:
- Cross-reference complex tax treaties
- Detect subtle calculation errors
- Generate recovery actions

---

## SCENARIO 2: Missing Payment Entirely

**Security:** Toyota Motor Corp (7203) - JP3633400001
**Expected Payment ID:** EXP006
**Received Payment ID:** NONE

### The Setup:
- **Holdings:** 1,200,000 shares
- **Dividend Rate:** ¥75.00 per share
- **Expected Gross:** ¥90,000,000
- **Tax Treaty (Japan-Norway):** 10% withholding
- **Expected Tax:** ¥9,000,000
- **Expected Net:** ¥81,000,000
- **Payment Date:** June 1, 2025

### What Actually Happened:
- **Received:** NOTHING
- **Status:** Payment not found in custodian records

### The Discrepancy:
**Missing Amount:** ¥81,000,000 (~$540,000 USD)
**Status:** Completely unreceived

### AI Reasoning Flow:
1. ✓ Verified holding: 1,200,000 shares
2. ✓ Verified ex-date: March 25, 2025 (record date confirmed)
3. ✓ Verified payment date: June 1, 2025
4. ✓ Expected net amount: ¥81,000,000
5. ⚠ Payment status: NOT RECEIVED
6. ✓ Checked custodian records: No matching transaction
7. 🎯 **Root Cause:** Payment missing - likely custodian processing delay or settlement failure

### Recovery Action:
- **Type:** Payment inquiry with custodian
- **Amount at Risk:** ¥81,000,000 (~$540,000 USD)
- **Priority:** HIGH
- **Next Steps:**
  - Immediate inquiry to MUFG Custody
  - Request settlement trace
  - Escalate if not resolved in 48 hours

### Demo Impact:
Shows AI can detect **complete absence** of expected payment, not just wrong amounts.

---

## SCENARIO 3: Incorrect Tax Rate (Higher Complexity)

**Security:** Samsung Electronics Co Ltd (005930) - KR7005930003
**Expected Payment ID:** EXP007
**Received Payment ID:** REC007

### The Setup:
- **Holdings:** 25,000 shares
- **Dividend Rate:** ₩361 per share
- **Expected Gross:** ₩9,025,000
- **Tax Treaty (Korea-Norway):** 22% withholding
- **Expected Tax:** ₩1,985,500
- **Expected Net:** ₩7,039,500

### What Actually Happened:
- **Received Gross:** ₩9,025,000 ✓
- **Tax Withheld:** ₩2,254,500 ✗ (25% instead of 22%)
- **Received Net:** ₩6,770,500 ✗

### The Discrepancy:
**Missing Amount:** ₩269,000 (~$206 USD)

### AI Reasoning Flow:
1. ✓ Verified holding: 25,000 shares
2. ✓ Verified dividend rate: ₩361/share
3. ✓ Calculated expected gross: ₩9,025,000
4. ✓ Cross-referenced tax treaty: Korea-Norway, rate 22%
5. ✓ Expected net payment: ₩7,039,500
6. ⚠ Actual payment received: ₩6,770,500
7. ✓ Identified withholding applied: 25%
8. 🎯 **Root Cause:** Custodian applied standard Korean withholding rate (25%) instead of treaty rate (22%)

### Recovery Action:
- **Type:** Tax reclaim
- **Amount Recoverable:** ₩269,000
- **Timeline:** 30-60 days (Korea has slower reclaim process)

### Demo Impact:
Shows AI works across different currencies and tax jurisdictions.

---

## Perfect Matches (No Discrepancies)

The following payments match perfectly and should show as ✓ GREEN in the dashboard:

1. **HSBC Holdings (HSBA)** - EXP002 / REC002 - ✓ Match
2. **Nestle SA (NESN)** - EXP003 / REC003 - ✓ Match
3. **Deutsche Bank (DBK)** - EXP004 / REC004 - ✓ Match
4. **TotalEnergies (TTE)** - EXP005 / REC005 - ✓ Match
5. **ASML Holding (ASML)** - EXP008 / REC008 - ✓ Match
6. **BHP Group (BHP)** - EXP009 / REC009 - ✓ Match
7. **Bank of Montreal (BMO)** - EXP010 / REC010 - ✓ Match

---

## Summary Statistics for Dashboard

**Total Expected Payments:** 10
**Total Expected Amount:** $2,847,392.50 USD equivalent
**Total Received Amount:** $2,269,267.50 USD equivalent
**Discrepancies Detected:** 3

### Breakdown:
1. **Apple (AAPL):** -$37,500 (wrong tax rate)
2. **Toyota (7203):** -$540,000 (missing payment)
3. **Samsung (005930):** -$206 (wrong tax rate)

**Total Value at Risk:** $577,706.00
**Recovery Rate (Historical):** 89%
**Expected Recovery:** ~$514,158.00

---

## Demo Flow Recommendation

### Act 1: Dashboard (15 sec)
Show all 10 payments, 7 green checkmarks, 3 red alerts.

### Act 2: Focus on AAPL Discrepancy (90 sec)
This is your main story. Walk through the AI analysis step-by-step.

### Act 3: Quick Flash of Toyota (15 sec)
"And here's one that didn't arrive at all - $540K missing."

### Act 4: Scale View (20 sec)
Show monthly stats with these 3 + historical discrepancies.

---

## Technical Notes for Build Team

### Calculation Logic You Need to Implement:

```javascript
// Expected Net Amount
expected_net = (holding_quantity * div_rate) * (1 - tax_treaty_rate)

// Discrepancy Detection
discrepancy = expected_net - received_net

// Tax Rate Applied (reverse calculate)
actual_tax_rate = (received_gross - received_net) / received_gross
```

### For the AI Reasoning Component:

Feed Claude this context:
```
Security: {company_name}
Expected: ${expected_net}
Received: ${received_net}
Discrepancy: ${discrepancy}
Holdings: {holding_quantity} shares
Div Rate: ${div_rate}
Tax Treaty: {country1}-{country2} @ {treaty_rate}%
Actual Tax Applied: {actual_tax_rate}%

Identify the root cause and explain the discrepancy.
```

Claude will generate the step-by-step reasoning you see in the demo.

---

## Files Included

1. `expected_payments.csv` - What should be received (AI calculations)
2. `received_payments.csv` - What actually arrived (custodian data)
3. This document - Scenario explanations

**Next Step:** Build the reconciliation logic that compares these two files and flags the 3 discrepancies.
