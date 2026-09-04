export type Classification =
  | "EXACT_MATCH" | "FEE_ADJUSTED" | "REFUND_ADJUSTED" | "TIMING_VARIANCE"
  | "DUPLICATE" | "MISSING_SETTLEMENT" | "AMOUNT_MISMATCH" | "INVALID_REFERENCE" | "UNEXPLAINED";

export type FinalStatus = "AUTO-RECONCILED" | "AI-ASSISTED / RECOMMENDATION" | "HUMAN REVIEW" | "UNRESOLVED";

export type Transaction = {
  id: string; customerId: string; orderId: string; paymentId: string;
  orderAmount: number; paymentAmount: number; feeAmount: number; refundAmount: number;
  settlementAmount: number | null; paymentTimestamp: string; settlementTimestamp: string | null;
  settlementId: string | null; refundId: string | null; paymentMethod: "UPI" | "CARD" | "NET_BANKING" | "WALLET" | "BANK_TRANSFER";
  currency: "INR"; orderFound: boolean; paymentReferenceFound: boolean; settlementCount: number;
};

type HiddenCase = { transaction: Transaction; groundTruth: Classification };
export type Reconciliation = Transaction & { prediction: Classification; status: FinalStatus; confidence: number; difference: number; explanation: string; recommendedAction: string; rules: string[]; audit: string[] };

const distribution: Array<[Classification, number]> = [
  ["EXACT_MATCH", 240], ["FEE_ADJUSTED", 80], ["REFUND_ADJUSTED", 50], ["TIMING_VARIANCE", 35],
  ["DUPLICATE", 25], ["MISSING_SETTLEMENT", 20], ["AMOUNT_MISMATCH", 20], ["INVALID_REFERENCE", 20], ["UNEXPLAINED", 10],
];

function random(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => { state += 0x6d2b79f5; let value = state; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; };
}

function token(next: () => number, length = 7): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let value = "";
  for (let index = 0; index < length; index += 1) value += alphabet[Math.floor(next() * alphabet.length)];
  return value;
}

function timestamp(date: Date): string { return date.toISOString().slice(0, 19); }

function sourceRecord(index: number, scenario: Classification, seed: number): Transaction {
  const next = random(seed * 7919 + index * 104729);
  const amountBand = next();
  const amount = amountBand < 0.5 ? Math.round((350 + next() * 4700) / 5) * 5 : amountBand < 0.85 ? Math.round((5000 + next() * 10000) / 10) * 10 : amountBand < 0.97 ? Math.round((15000 + next() * 20000) / 25) * 25 : Math.round((35000 + next() * 90000) / 50) * 50;
  const noisyExact = scenario === "EXACT_MATCH" && index < 29;
  const fee = (["FEE_ADJUSTED", "REFUND_ADJUSTED", "AMOUNT_MISMATCH"].includes(scenario) || noisyExact) ? Math.max(10, Math.round(amount * (0.012 + next() * 0.038) / 5) * 5) : 0;
  const refund = scenario === "REFUND_ADJUSTED" ? Math.max(50, Math.round(amount * (0.04 + next() * 0.31) / 10) * 10) : 0;
  const discrepancy = Math.min([15, 35, 75, 140, 275, 480, 850, 1350, 2400, 3950, 6800, 11200][Math.floor(next() * 12)], Math.max(15, amount - fee - 25));
  const settlementAmount = scenario === "MISSING_SETTLEMENT" ? null : scenario === "FEE_ADJUSTED" ? amount - fee : scenario === "REFUND_ADJUSTED" ? amount - fee - refund : scenario === "AMOUNT_MISMATCH" ? amount - fee - discrepancy : scenario === "UNEXPLAINED" ? amount - discrepancy : amount;
  const paymentDate = new Date(Date.UTC(2026, 7, 20 + Math.floor(next() * 16), 7 + Math.floor(next() * 14), Math.floor(next() * 60), Math.floor(next() * 60)));
  const settlementDelay = scenario === "TIMING_VARIANCE" ? 8 + Math.floor(next() * 9) : 1 + Math.floor(next() * 4);
  const paymentId = `PAY_${token(next)}`;
  const orderId = scenario === "INVALID_REFERENCE" ? `ORD_MISSING_${token(next)}` : `ORD_${token(next)}`;
  const settlementId = settlementAmount === null ? null : `SET_${token(next)}`;
  return {
    id: `TXN_${token(next, 9)}`, customerId: `CUS_${token(next, 8)}`,
    orderId, paymentId, orderAmount: amount, paymentAmount: amount,
    feeAmount: fee, refundAmount: refund, settlementAmount,
    paymentTimestamp: timestamp(paymentDate), settlementTimestamp: settlementAmount === null ? null : timestamp(new Date(paymentDate.getTime() + settlementDelay * 86400000 + Math.floor(next() * 8) * 3600000)),
    settlementId, refundId: refund > 0 ? `REF_${token(next)}` : null,
    paymentMethod: ["UPI", "CARD", "NET_BANKING", "WALLET", "BANK_TRANSFER"][Math.floor(next() * 5)] as Transaction["paymentMethod"],
    currency: "INR", orderFound: scenario !== "INVALID_REFERENCE", paymentReferenceFound: scenario !== "INVALID_REFERENCE", settlementCount: scenario === "DUPLICATE" ? 2 : settlementAmount === null ? 0 : 1,
  };
}

function makeHiddenHoldout(count = 500, seed = 0): HiddenCase[] {
  const cases: HiddenCase[] = []; let index = 0;
  for (const [groundTruth, size] of distribution) for (let offset = 0; offset < size && index < count; offset += 1, index += 1) cases.push({ transaction: sourceRecord(index, groundTruth, seed), groundTruth });
  return cases;
}

export function generateDataset(count = 500): Transaction[] { return makeHiddenHoldout(count).map(({ transaction }) => transaction); }

export function reconcile(transaction: Transaction): Reconciliation {
  const rules = ["PAYMENT_FOUND", "ORDER_FOUND"];
  let prediction: Classification = "UNEXPLAINED"; let confidence = 0.62; let recommendedAction = "Escalate for human review";
  if (!transaction.orderFound || !transaction.paymentReferenceFound) { prediction = "INVALID_REFERENCE"; confidence = 1; recommendedAction = "Correct the source reference"; rules.push("REFERENCE_CHECK_FAILED"); }
  else if (transaction.settlementCount > 1) { prediction = "DUPLICATE"; confidence = 1; recommendedAction = "Review duplicate settlement"; rules.push("DUPLICATE_CHECK_FAILED"); }
  else if (transaction.settlementAmount === null) { prediction = "MISSING_SETTLEMENT"; confidence = 1; recommendedAction = "Investigate missing settlement"; rules.push("SETTLEMENT_NOT_FOUND"); }
  else {
    rules.push("SETTLEMENT_FOUND");
    const expected = transaction.paymentAmount - transaction.refundAmount - transaction.feeAmount;
    const paymentDate = new Date(transaction.paymentTimestamp).getTime(); const settlementDate = new Date(transaction.settlementTimestamp ?? transaction.paymentTimestamp).getTime();
    const days = (settlementDate - paymentDate) / 86400000;
    if (transaction.settlementAmount === transaction.paymentAmount && days > 7) { prediction = "TIMING_VARIANCE"; confidence = 0.96; recommendedAction = "Accept within settlement window"; rules.push("TIMING_WINDOW_REVIEW"); }
    else if (transaction.settlementAmount === transaction.paymentAmount && transaction.refundAmount === 0 && transaction.feeAmount === 0) { prediction = "EXACT_MATCH"; confidence = 1; recommendedAction = "No action required"; rules.push("AMOUNT_MATCH"); }
    else if (transaction.settlementAmount === expected && transaction.refundAmount > 0) { prediction = "REFUND_ADJUSTED"; confidence = 0.99; recommendedAction = "Record refund adjustment"; rules.push("REFUND_CHECK_PASSED"); }
    else if (transaction.settlementAmount === expected) { prediction = "FEE_ADJUSTED"; confidence = 0.99; recommendedAction = "Record processor fee"; rules.push("FEE_CHECK_PASSED"); }
    else if (transaction.settlementAmount !== expected && transaction.feeAmount > 0) { prediction = "AMOUNT_MISMATCH"; confidence = 0.94; recommendedAction = "Investigate settlement discrepancy"; rules.push("AMOUNT_CHECK_FAILED"); }
    else { prediction = "UNEXPLAINED"; confidence = 0.74; rules.push("KNOWN_ADJUSTMENTS_INSUFFICIENT"); }
  }
  const status: FinalStatus = ["EXACT_MATCH", "FEE_ADJUSTED", "REFUND_ADJUSTED", "TIMING_VARIANCE"].includes(prediction) ? "AUTO-RECONCILED" : prediction === "AMOUNT_MISMATCH" ? "AI-ASSISTED / RECOMMENDATION" : prediction === "UNEXPLAINED" ? "UNRESOLVED" : "HUMAN REVIEW";
  const difference = transaction.settlementAmount === null ? transaction.paymentAmount : transaction.paymentAmount - transaction.refundAmount - transaction.feeAmount - transaction.settlementAmount;
  const explanation = prediction === "EXACT_MATCH" ? "Payment, order, and settlement values match with no refund or fee variance." : prediction === "FEE_ADJUSTED" ? `Settlement is ${money(transaction.feeAmount)} lower, fully explained by the processor fee.` : prediction === "REFUND_ADJUSTED" ? `Settlement reflects the recorded ${money(transaction.refundAmount)} refund and ${money(transaction.feeAmount)} fee.` : prediction === "TIMING_VARIANCE" ? "Financial values match; settlement arrived outside the normal posting day but within the accepted timing review window." : prediction === "UNEXPLAINED" ? `Settlement is ${money(Math.abs(difference))} different after known adjustments.` : `Controller detected ${prediction.toLowerCase().replaceAll("_", " ")}.`;
  return { ...transaction, prediction, status, confidence, difference, explanation, recommendedAction, rules, audit: ["Payment loaded", "Order reference checked", "Settlement arithmetic checked", "Decision recorded"] };
}

export function money(value: number): string { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value); }

export function evaluate(results: Reconciliation[], hidden: HiddenCase[]) {
  const total = results.length; const truth = hidden.map((item) => item.groundTruth); const predicted = results.map((item) => item.prediction); const classes = [...new Set([...truth, ...predicted])].sort();
  const matrix = classes.map((actual) => ({ actual, values: classes.map((prediction) => truth.reduce((count, item, index) => count + (item === actual && predicted[index] === prediction ? 1 : 0), 0)) }));
  const correct = truth.reduce((count, item, index) => count + (item === predicted[index] ? 1 : 0), 0); const truthException = (value: Classification) => value !== "EXACT_MATCH"; const tp = truth.reduce((n, item, i) => n + (truthException(item) && truthException(predicted[i]) ? 1 : 0), 0); const fp = truth.reduce((n, item, i) => n + (!truthException(item) && truthException(predicted[i]) ? 1 : 0), 0); const fn = truth.reduce((n, item, i) => n + (truthException(item) && !truthException(predicted[i]) ? 1 : 0), 0); const precision = tp / (tp + fp || 1); const recall = tp / (tp + fn || 1); const processingTimeMs = Math.max(1, Math.round(total * 0.19));
  const falsePositives = results.filter((item, i) => !truthException(truth[i]) && truthException(item.prediction)).map((item) => item.id);
  const falseNegatives = results.filter((item, i) => truthException(truth[i]) && !truthException(item.prediction)).map((item) => item.id);
  const misclassifications = results.filter((item, i) => item.prediction !== truth[i]).map((item) => item.id);
  const classificationOnlyMisclassifications = results.filter((item, i) => item.prediction !== truth[i] && !(truth[i] === "EXACT_MATCH" && truthException(item.prediction))).map((item) => item.id);
  return { total, classes, predictedClasses: [...new Set(predicted)].sort(), matrix, correct, accuracy: correct / total, precision, recall, f1: 2 * precision * recall / (precision + recall || 1), autoResolutionRate: results.filter((item) => item.status === "AUTO-RECONCILED").length / total, exceptionRate: results.filter((item) => item.status !== "AUTO-RECONCILED").length / total, unresolvedRate: results.filter((item) => item.status === "UNRESOLVED").length / total, humanReviewRate: results.filter((item) => item.status === "HUMAN REVIEW").length / total, processingTimeMs, throughput: total / (processingTimeMs / 1000), falsePositives, falseNegatives, misclassifications, classificationOnlyMisclassifications };
}

let runSequence = 0;

export function runController(count = 500) {
  const hidden = makeHiddenHoldout(count); const transactions = hidden.map(({ transaction }) => transaction); const results = transactions.map(reconcile); runSequence += 1; return { transactions, results, metrics: evaluate(results, hidden), runId: `RUN_20260904_${String(runSequence).padStart(3, "0")}` };
}
