# AI Finance Controller — Hackathon Build Specification

## 1. Product Overview

### Product name
AI Finance Controller

### One-line pitch
An AI-powered finance controller that reconciles multi-source payment records, explains discrepancies, automatically resolves high-confidence exceptions, and escalates uncertain cases with a complete audit trail.

### Hackathon track
Track 04 — AI Finance Controller

### Core problem
Merchants and finance teams receive financial information from multiple sources such as payments, orders, settlements, refunds, and fees. These records can disagree because of fees, refunds, timing differences, duplicates, missing settlements, or unexplained amount differences.

The product must close one finance-ops loop:

**Load → Normalize → Reconcile → Explain → Resolve or Escalate → Measure**

The system must work on a batch of at least 50 records. The demo should use 500 synthetic transactions.

### Primary design principle
**Code determines what happened. AI explains what happened and recommends what to do.**

Do not use an LLM for basic arithmetic, deterministic matching, or metric calculation.

---

# 2. Goals

## Must-have goals

1. Process at least 500 synthetic transactions.
2. Reconcile records across multiple financial sources.
3. Detect and classify discrepancies.
4. Automatically resolve high-confidence cases.
5. Escalate uncertain cases for human review.
6. Explain why a transaction was reconciled or flagged.
7. Maintain an audit trail for every decision.
8. Maintain hidden/ground-truth labels for the synthetic dataset.
9. Calculate real evaluation metrics from the ground truth.
10. Show throughput and processing time.
11. Provide a polished web dashboard suitable for a hackathon demo.

## Explicit non-goals

Do not build:

- Real payment processing.
- Real money movement.
- Real merchant integrations.
- A generic finance chatbot.
- Complex accounting software.
- Kubernetes/microservices infrastructure.
- A complicated authentication system unless already available.
- AI-generated fake metrics.
- Autonomous financial actions involving real money.

---

# 3. Recommended Technology Stack

Prioritize speed and simplicity.

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- Recharts or another lightweight chart library
- Responsive desktop-first UI

## Backend

Prefer Next.js API routes/server-side functions for the MVP.

Use a separate FastAPI backend only if the coding agent is significantly faster with it.

## Database

- SQLite for local development/demo.
- If deployment requires a hosted database, use the simplest supported option such as Vercel Postgres/Neon/Supabase.

The exact database technology is less important than having a reliable working demo.

## AI

Use an LLM API only for:

- exception explanation
- exception categorization when deterministic rules cannot confidently classify it
- resolution recommendation
- human-readable reasoning

The system must still work in deterministic/demo mode if the LLM API key is unavailable. In that case, use rule-based explanations.

## Deployment

- Vercel for the web application.
- Store API keys only in environment variables.
- Never expose LLM API keys to the browser.

---

# 4. Product Workflow

The main workflow is:

```text
Synthetic / Uploaded Financial Data
              |
              v
        Data Normalization
              |
              v
       Transaction Matching
              |
              v
      Deterministic Checks
              |
              v
       Exception Detection
              |
              v
     +----------------------+
     | High confidence?     |
     +----------+-----------+
                |
       +--------+--------+
       |                 |
      YES                NO
       |                 |
       v                 v
 Auto-resolve      AI Analysis
       |                 |
       |          +------+------+
       |          |             |
       |      Resolvable      Uncertain
       |          |             |
       |          v             v
       |      Recommend      Human Review
       |          |             |
       +----------+-------------+
                  |
                  v
             Audit Trail
                  |
                  v
           Evaluation Engine
                  |
                  v
              Dashboard
```

---

# 5. Financial Data Sources

Create four primary synthetic datasets.

## 5.1 Payments

Fields:

```text
payment_id
order_id
customer_id
payment_timestamp
amount
currency
payment_method
payment_status
```

Example:

```json
{
  "payment_id": "PAY_10001",
  "order_id": "ORD_50001",
  "customer_id": "CUS_201",
  "payment_timestamp": "2026-09-01T10:15:00",
  "amount": 5000,
  "currency": "INR",
  "payment_method": "UPI",
  "payment_status": "SUCCESS"
}
```

## 5.2 Orders

Fields:

```text
order_id
customer_id
order_timestamp
order_amount
currency
order_status
```

## 5.3 Settlements

Fields:

```text
settlement_id
payment_id
settlement_timestamp
settlement_amount
fee_amount
currency
settlement_status
```

## 5.4 Refunds

Fields:

```text
refund_id
payment_id
refund_timestamp
refund_amount
refund_status
```

---

# 6. Synthetic Dataset Design

Generate at least 500 transactions.

Recommended demo distribution:

```text
500 total transactions

250 exact matches
80 fee-adjusted matches
50 refund-adjusted matches
35 timing differences
25 duplicate records
20 missing settlements
20 amount mismatches
20 missing/invalid references
```

The exact distribution may vary, but every record must have a known ground-truth classification.

The dataset should intentionally contain both normal and abnormal cases.

Do not make every exception obvious.

---

# 7. Ground Truth

Every synthetic transaction must have an internal ground-truth label.

Possible labels:

```text
EXACT_MATCH
FEE_ADJUSTED
REFUND_ADJUSTED
TIMING_VARIANCE
DUPLICATE
MISSING_SETTLEMENT
AMOUNT_MISMATCH
INVALID_REFERENCE
UNEXPLAINED
```

Ground truth must NOT be displayed as ground truth in the normal dashboard.

It exists only for evaluation.

Create a separate evaluation pipeline:

```text
Ground Truth
      +
Controller Prediction
      |
      v
Evaluation Engine
      |
      v
Accuracy / Precision / Recall / F1
```

---

# 8. Reconciliation Logic

Use deterministic rules first.

## Rule 1 — Exact match

If:

```text
payment.order_id == order.order_id
payment.amount == order.order_amount
payment.payment_status == SUCCESS
settlement.payment_id == payment.payment_id
payment.amount == settlement.amount
refund amount == 0
```

then:

```text
status = RECONCILED
reason = EXACT_MATCH
confidence = 1.0
```

## Rule 2 — Fee-adjusted settlement

If:

```text
payment.amount - settlement.amount == settlement.fee_amount
```

and the difference is fully explained by the fee:

```text
status = RECONCILED
reason = FEE_ADJUSTED
```

Example:

```text
Payment       ₹5,000
Fee             ₹100
Settlement    ₹4,900
```

## Rule 3 — Refund-adjusted settlement

If:

```text
payment.amount
- refund.amount
- fee.amount
== settlement.amount
```

then:

```text
status = RECONCILED
reason = REFUND_ADJUSTED
```

## Rule 4 — Timing variance

If the records match by payment/order/reference and amounts are correct but timestamps differ within an accepted settlement window, classify as:

```text
TIMING_VARIANCE
```

This can still be considered successfully reconciled if the financial values are consistent.

## Rule 5 — Duplicate

Detect multiple settlement or payment records for the same transaction/reference.

Flag:

```text
DUPLICATE
```

for review unless the duplicate can be safely identified as a duplicate record.

## Rule 6 — Missing settlement

Payment exists but no corresponding settlement exists after the configured settlement window.

Flag:

```text
MISSING_SETTLEMENT
```

## Rule 7 — Amount mismatch

If payment/order/settlement references align but the amounts cannot be explained by fees or refunds:

```text
AMOUNT_MISMATCH
```

## Rule 8 — Invalid reference

If a settlement references a nonexistent payment or an order references a nonexistent payment:

```text
INVALID_REFERENCE
```

## Rule 9 — Unexplained

If no deterministic rule explains the discrepancy:

```text
UNEXPLAINED
```

Send this case to the AI reasoning layer.

---

# 9. AI Reasoning Layer

The LLM must receive structured facts, not raw database access.

Example input:

```json
{
  "transaction": {
    "payment": {
      "id": "PAY_10042",
      "amount": 12500
    },
    "order": {
      "id": "ORD_50042",
      "amount": 12500
    },
    "settlement": {
      "amount": 9500,
      "fee": 100
    },
    "refund": {
      "amount": 0
    }
  },
  "deterministic_findings": {
    "unexplained_difference": 2900
  }
}
```

The LLM should return structured JSON:

```json
{
  "classification": "UNEXPLAINED",
  "explanation": "The settlement is ₹2,900 lower than the payment after accounting for the recorded ₹100 fee.",
  "confidence": 0.94,
  "recommended_action": "HUMAN_REVIEW",
  "reason_code": "UNEXPLAINED_AMOUNT_DIFFERENCE"
}
```

Use structured output if supported.

Do not allow free-form LLM responses to directly control financial state.

---

# 10. AI Confidence Policy

Suggested policy:

```text
confidence >= 0.90
    and deterministic evidence is consistent
        -> AUTO_RESOLVE

0.70 <= confidence < 0.90
        -> REVIEW

confidence < 0.70
        -> HUMAN_REVIEW
```

The exact thresholds may be tuned during testing.

The UI must clearly distinguish:

- Automatically resolved
- AI-recommended
- Human review required

Never claim that an uncertain AI recommendation is a confirmed financial fact.

---

# 11. Audit Trail

Every processed transaction must create an audit record.

Fields:

```text
audit_id
transaction_id
timestamp
sources_considered
rules_triggered
deterministic_result
ai_result
confidence
final_status
recommended_action
```

Example:

```json
{
  "transaction_id": "PAY_10042",
  "rules_triggered": [
    "PAYMENT_FOUND",
    "ORDER_AMOUNT_MATCH",
    "SETTLEMENT_FOUND",
    "FEE_CHECK_FAILED"
  ],
  "deterministic_result": "AMOUNT_MISMATCH",
  "ai_result": "UNEXPLAINED",
  "confidence": 0.94,
  "final_status": "HUMAN_REVIEW",
  "recommended_action": "INVESTIGATE_SETTLEMENT"
}
```

Create an Audit Trail view in the UI.

---

# 12. Evaluation Metrics

The system must calculate actual metrics from the synthetic ground truth.

At minimum show:

## Accuracy

```text
correct predictions / total predictions
```

## Precision

For exception detection and/or each important class:

```text
TP / (TP + FP)
```

## Recall

```text
TP / (TP + FN)
```

## F1

```text
2 * precision * recall / (precision + recall)
```

## Auto-resolution rate

```text
auto-resolved transactions / total transactions
```

## Exception rate

```text
flagged transactions / total transactions
```

## Unresolved rate

```text
human-review transactions / total transactions
```

## Throughput

```text
transactions processed / processing time
```

Display both:

```text
records/second
```

and total processing time.

---

# 13. False Positive / False Negative Analysis

Include an evaluation section showing examples of errors.

Example:

```text
False Positive
TXN_1024
Controller flagged mismatch
Ground truth: FEE_ADJUSTED

Reason:
Fee metadata was inconsistent.
```

Example:

```text
False Negative
TXN_1198
Controller marked reconciled
Ground truth: DUPLICATE

Impact:
₹4,500 potentially overstated.
```

This demonstrates honest evaluation.

Do not hide model failures.

---

# 14. Dashboard

The main dashboard should communicate the value immediately.

## Header

```text
AI Finance Controller

Intelligent reconciliation and exception management
```

## KPI cards

Display:

```text
Total Transactions
Total Transaction Value
Auto-Reconciled
Exceptions
Unresolved
Accuracy
Processing Time
Throughput
```

Example:

```text
500 Transactions
₹48.2L Processed
91.6% Auto-Reconciled
42 Exceptions
15 Unresolved
96.4% Accuracy
1.84s Processing Time
271 tx/sec
```

Numbers above are examples only. Use actual computed values.

---

# 15. Reconciliation Overview

Add a chart showing:

```text
Reconciled
Fee Adjusted
Refund Adjusted
Timing Variance
Duplicates
Missing Settlement
Amount Mismatch
Unexplained
```

Use a donut/bar chart.

Also show the monetary value associated with each category.

---

# 16. Exceptions Table

Columns:

```text
Transaction
Amount
Exception Type
Difference
Confidence
Status
Action
```

Example:

```text
TXN_1087
₹12,500
Amount Mismatch
₹2,900
94%
Human Review
View
```

Allow filtering by:

- exception type
- status
- confidence
- amount

---

# 17. Transaction Detail Page / Drawer

Clicking a transaction should show:

## Transaction summary

```text
Transaction ID
Customer
Order ID
Payment ID
```

## Financial comparison

```text
Order       ₹12,500
Payment     ₹12,500
Fee            ₹100
Refund           ₹0
Settlement   ₹9,500
Difference   ₹2,900
```

## Controller decision

```text
STATUS
Human Review

CONFIDENCE
94%

REASON
Settlement is ₹2,900 lower than the expected amount after accounting for the recorded fee.
```

## Recommended action

```text
Investigate settlement discrepancy
```

## Audit trail

Show the steps that led to the decision.

---

# 18. Run Reconciliation Experience

Include a prominent button:

**Run Reconciliation**

When clicked, show progress:

```text
Loading payments... ✓
Loading orders... ✓
Loading settlements... ✓
Loading refunds... ✓
Normalizing records... ✓
Matching transactions... ✓
Detecting exceptions... ✓
Analyzing ambiguous cases... ✓
Generating audit trail... ✓

Reconciliation complete.
```

Then show the results.

The run should process the entire batch, not one cherry-picked transaction.

---

# 19. Demo Data

Provide a "Load Demo Dataset" button.

The demo dataset must be deterministic so the same run produces reproducible results.

Optionally allow:

- 100 records
- 500 records
- 1,000 records

Default to 500.

Do not make the UI depend on manually uploading files for the primary demo.

An upload feature can be added only if time permits.

---

# 20. API Design

Keep APIs simple.

Suggested endpoints:

```text
GET  /api/transactions
GET  /api/transactions/:id

POST /api/reconcile
GET  /api/reconciliation/summary

GET  /api/exceptions
GET  /api/exceptions/:id

GET  /api/audit/:transactionId

GET  /api/evaluation
GET  /api/health
```

If using Next.js route handlers, preserve equivalent semantics.

---

# 21. Reconciliation API Response

Example:

```json
{
  "run_id": "RUN_20260904_001",
  "total_records": 500,
  "processed_records": 500,
  "reconciled": 458,
  "exceptions": 27,
  "unresolved": 15,
  "accuracy": 0.964,
  "precision": 0.952,
  "recall": 0.948,
  "f1": 0.950,
  "processing_time_ms": 1840,
  "throughput_per_second": 271.7
}
```

These values must be calculated, never hardcoded.

---

# 22. UI/UX Requirements

The visual style should feel like a serious fintech operations product.

Use:

- clean white/light background
- dark text
- restrained use of accent colors
- clear status badges
- compact financial tables
- good spacing
- professional typography
- responsive layout
- subtle animations only where useful

Avoid:

- excessive gradients
- flashy AI effects
- cartoonish design
- unnecessary illustrations
- huge hero sections
- too many pages

The user should understand the product within 10 seconds.

---

# 23. Suggested Navigation

Use a simple sidebar:

```text
Dashboard
Transactions
Exceptions
Reconciliation Runs
Audit Trail
Evaluation
```

Optional:

```text
Settings
```

Do not implement unnecessary settings.

---

# 24. Important Engineering Constraints

## Reliability

Deterministic reconciliation must produce reproducible results.

## Explainability

Every status should have a reason.

## Safety

No real money movement.

No real financial action should be executed automatically.

"Auto-resolve" means:

> mark the record as reconciled in the internal system and record why.

It does NOT mean moving money.

## Secrets

Never put API keys in frontend code.

Use environment variables.

## Metrics

Never hardcode evaluation metrics.

Calculate them from predictions and ground truth.

---

# 25. Acceptance Criteria

The implementation is complete only when all of these work:

### Data

- [ ] At least 500 synthetic transactions exist.
- [ ] Multiple data sources are represented.
- [ ] Dataset includes realistic discrepancies.
- [ ] Ground truth exists separately.

### Reconciliation

- [ ] Exact matches are detected.
- [ ] Fee-adjusted settlements are detected.
- [ ] Refund-adjusted settlements are detected.
- [ ] Timing differences are handled.
- [ ] Duplicates are detected.
- [ ] Missing settlements are detected.
- [ ] Amount mismatches are detected.
- [ ] Invalid references are detected.
- [ ] Unexplained cases are escalated.

### AI

- [ ] AI explains ambiguous exceptions.
- [ ] AI returns structured results.
- [ ] AI provides confidence.
- [ ] AI recommends an action.
- [ ] AI cannot directly perform financial transactions.

### Evaluation

- [ ] Accuracy is calculated.
- [ ] Precision is calculated.
- [ ] Recall is calculated.
- [ ] F1 is calculated.
- [ ] Throughput is calculated.
- [ ] Auto-resolution rate is calculated.
- [ ] Honest exceptions are displayed.
- [ ] False positives/negatives can be inspected.

### UI

- [ ] Dashboard works.
- [ ] Reconciliation can be run.
- [ ] Transactions can be inspected.
- [ ] Exceptions can be filtered.
- [ ] AI explanation is visible.
- [ ] Audit trail is visible.
- [ ] Evaluation results are visible.

### Deployment

- [ ] Production build succeeds.
- [ ] Vercel deployment succeeds.
- [ ] Environment variables are documented.
- [ ] Demo dataset is available after deployment.

---

# 26. Priority Order

If time becomes limited, implement features in this order:

## P0 — Absolutely required

1. Synthetic data generation
2. Ground truth
3. Reconciliation engine
4. Exception detection
5. Evaluation metrics
6. Dashboard
7. Transaction detail
8. Audit trail

## P1 — Important

9. LLM explanation
10. AI confidence
11. Recommended action
12. Exception filters
13. Reconciliation run progress

## P2 — Only if time remains

14. CSV upload
15. Multiple dataset sizes
16. Advanced charts
17. Export report
18. Authentication
19. Fancy animations

Do not sacrifice P0 features for P2 polish.

---

# 27. Recommended Project Structure

A possible structure:

```text
ai-finance-controller/
│
├── app/
│   ├── page.tsx
│   ├── dashboard/
│   ├── transactions/
│   ├── exceptions/
│   ├── runs/
│   ├── audit/
│   ├── evaluation/
│   └── api/
│
├── components/
│   ├── KPI cards
│   ├── charts
│   ├── transaction table
│   ├── exception table
│   ├── transaction detail
│   ├── audit timeline
│   └── run progress
│
├── lib/
│   ├── reconciliation/
│   ├── evaluation/
│   ├── ai/
│   ├── database/
│   └── utils/
│
├── scripts/
│   └── generate-data
│
├── data/
│   └── demo/
│
├── tests/
│
├── .env.example
├── README.md
└── package.json
```

The exact structure may differ if the coding agent has a better Next.js convention.

---

# 28. Testing Strategy

Create automated tests for the reconciliation rules.

At minimum test:

```text
exact match -> RECONCILED

fee difference fully explained -> RECONCILED

refund + fee explain difference -> RECONCILED

missing settlement -> EXCEPTION

duplicate settlement -> EXCEPTION

unexplained amount difference -> EXCEPTION

invalid reference -> EXCEPTION
```

Also run the complete 500-record evaluation.

---

# 29. Hackathon Demo Script

The final demo should take approximately 3 minutes.

## Step 1 — Problem

Say:

> "A merchant's money exists across multiple systems. Payment says one thing, settlement says another, refunds and fees complicate the picture. Finance teams spend time manually figuring out what happened."

## Step 2 — Product

Show:

> "This is our AI Finance Controller. It doesn't just match records. It investigates discrepancies, automatically resolves cases supported by evidence, and knows when to ask for human review."

## Step 3 — Run

Click:

**Run Reconciliation**

Process 500 records.

## Step 4 — Results

Show:

```text
500 records
X% auto-reconciled
X exceptions
X unresolved
X% accuracy
X records/sec
```

Use real calculated numbers.

## Step 5 — Inspect an easy case

Show a fee-adjusted transaction:

```text
Payment ₹5,000
Fee ₹100
Settlement ₹4,900

→ Automatically reconciled
```

## Step 6 — Inspect a hard case

Show an unexplained discrepancy:

```text
Payment ₹12,500
Fee ₹100
Settlement ₹9,500

→ ₹2,900 unexplained
→ AI confidence 94%
→ Human review
```

## Step 7 — Audit trail

Show exactly how the decision was made.

## Step 8 — Evaluation

Show:

```text
Precision
Recall
F1
Accuracy
Throughput
False positives
False negatives
```

End with:

> "The important part is not that the controller resolves everything. It is that it resolves what it can prove, explains what it finds, and knows what it cannot confidently resolve."

---

# 30. Agent Instructions

Read this entire specification before implementing.

Build the product end-to-end.

Prioritize a functioning P0 MVP over optional features.

Do not ask for confirmation for every implementation detail. Make reasonable engineering decisions that preserve this specification.

Do not replace the reconciliation engine with an LLM.

Do not hardcode demo metrics.

Do not fabricate evaluation results.

Do not claim production-grade financial accuracy.

Use synthetic data only.

Make the system deterministic and reproducible where possible.

If the LLM API is unavailable, the application must still run using deterministic/rule-based explanations.

Before considering the project complete:

1. Generate the demo dataset.
2. Run reconciliation on the complete dataset.
3. Run evaluation against ground truth.
4. Verify metrics.
5. Test the main UI flows.
6. Run the production build.
7. Fix all build/runtime errors.
8. Provide clear local setup instructions.
9. Provide Vercel deployment instructions.
10. Ensure no secrets are committed.

The final application should look and behave like a credible fintech operations product, not a toy AI demo.
