"use client";
import { useEffect, useMemo, useState } from "react";
import type { Reconciliation } from "@/lib/controller";
import { money } from "@/lib/controller";

type Metrics = {
  total: number;
  classes: string[];
  predictedClasses: string[];
  matrix: { actual: string; values: number[] }[];
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  autoResolutionRate: number;
  exceptionRate: number;
  unresolvedRate: number;
  humanReviewRate: number;
  processingTimeMs: number;
  throughput: number;
  falsePositives: string[];
  falseNegatives: string[];
  misclassifications: string[];
  classificationOnlyMisclassifications: string[];
};
type RunData = { results: Reconciliation[]; metrics: Metrics; runId: string };
const labels: Record<string, string> = {
  EXACT_MATCH: "Exact match",
  FEE_ADJUSTED: "Fee adjusted",
  REFUND_ADJUSTED: "Refund adjusted",
  TIMING_VARIANCE: "Timing variance",
  DUPLICATE: "Duplicate",
  MISSING_SETTLEMENT: "Missing settlement",
  AMOUNT_MISMATCH: "Amount mismatch",
  INVALID_REFERENCE: "Invalid reference",
  UNEXPLAINED: "Unexplained",
};
const autoClasses = new Set([
  "EXACT_MATCH",
  "FEE_ADJUSTED",
  "REFUND_ADJUSTED",
  "TIMING_VARIANCE",
]);

export default function Home() {
  const [data, setData] = useState<RunData | null>(null);
  const [selected, setSelected] = useState<Reconciliation | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const run = async () => {
    if (running) return;
    setRunning(true);
    setRunError(null);
    setCompleted(false);
    try {
      const response = await fetch("/api/reconcile", { method: "POST" });
      if (!response.ok)
        throw new Error(`Reconciliation request failed (${response.status})`);
      const nextData = (await response.json()) as RunData;
      await new Promise((resolve) => window.setTimeout(resolve, 800));
      setData(nextData);
      setCompleted(true);
    } catch (error) {
      setRunError(
        error instanceof Error
          ? error.message
          : "Reconciliation could not be completed.",
      );
    } finally {
      setRunning(false);
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => void run(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const results = data?.results ?? [];
  const exceptions = useMemo(
    () =>
      results.filter(
        (item) =>
          !autoClasses.has(item.prediction) &&
          (filter === "ALL" || item.prediction === filter),
      ),
    [results, filter],
  );
  const totalValue = results.reduce((sum, item) => sum + item.paymentAmount, 0);
  const valueAtRisk = results
    .filter(
      (item) => item.status === "HUMAN REVIEW" || item.status === "UNRESOLVED",
    )
    .reduce((sum, item) => sum + item.paymentAmount, 0);
  const counts = results.reduce<Record<string, number>>((map, item) => {
    map[item.prediction] = (map[item.prediction] ?? 0) + 1;
    return map;
  }, {});
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">⌁</span>
          <span>
            ledger<span className="accent">/</span>control
          </span>
        </div>
        <div className="workspace">
          FINANCE OPS <span>⌄</span>
        </div>
        <nav>
          {[
            "Dashboard",
            "Transactions",
            "Exceptions",
            "Reconciliation runs",
            "Audit trail",
            "Evaluation",
          ].map((item, i) => (
            <button
              className={i === 0 ? "nav-item active" : "nav-item"}
              key={item}
            >
              <span className="nav-icon">
                {["◈", "≡", "!", "↻", "◷", "✦"][i]}
              </span>
              {item}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="pulse" /> Synthetic demo data
          <br />
          <strong>500 records ready</strong>
        </div>
      </aside>
      <section className="content">
        <header>
          <div>
            <div className="eyebrow">CONTROL CENTER / 04 SEP 2026</div>
            <h1>Good morning, controller.</h1>
            <p>Reconcile every record. Escalate only what needs judgment.</p>
          </div>
          <button
            className="run-button"
            onClick={() => void run()}
            disabled={running}
          >
            <span>{running ? "◌" : "↻"}</span>
            {running ? "Running..." : "Run reconciliation"}
          </button>
        </header>
        {running && (
          <div className="progress">
            Processing payments, settlements, refunds and audit events...
          </div>
        )}
        {runError && <div className="error-note" role="alert">Reconciliation failed: {runError}</div>}
        {completed && !running && (
          <div className="completion" role="status">
            ✓ Reconciliation completed <span>{data?.metrics.total.toLocaleString()} records processed</span>
          </div>
        )}
        {!data ? (
          <div className="loading">Loading demo dataset...</div>
        ) : (
          <>
            <div className="kpis">
              <Kpi
                label="Total transactions"
                value={data.metrics.total.toLocaleString()}
                note="Canonical result set"
              />
              <Kpi
                label="Auto-reconciled"
                value={`${(data.metrics.autoResolutionRate * 100).toFixed(1)}%`}
                note={`${results.filter((x) => autoClasses.has(x.prediction)).length} records`}
                positive
              />
              <Kpi
                label="Total exceptions"
                value={results
                  .filter((x) => !autoClasses.has(x.prediction))
                  .length.toString()}
                note={`${(data.metrics.exceptionRate * 100).toFixed(1)}% of batch`}
                warn
              />
              <Kpi
                label="Human review"
                value={results
                  .filter((x) => x.status === "HUMAN REVIEW")
                  .length.toString()}
                note={`${(data.metrics.humanReviewRate * 100).toFixed(1)}% of batch`}
                warn
              />
              <Kpi
                label="Unresolved"
                value={results
                  .filter((x) => x.status === "UNRESOLVED")
                  .length.toString()}
                note={`${(data.metrics.unresolvedRate * 100).toFixed(1)}% of batch`}
                warn
              />
              <Kpi
                label="Value at risk"
                value={money(valueAtRisk)}
                note="Human review + unresolved"
                warn
              />
            </div>
            <div className="grid-overview">
              <section className="panel overview">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">
                      RECONCILIATION OVERVIEW
                    </span>
                    <h2>Where the batch landed</h2>
                  </div>
                  <span className="run-id">{data.runId}</span>
                </div>
                <div className="bars">
                  {Object.entries(labels).map(([key, label]) => (
                    <div className="bar-row" key={key}>
                      <span>{label}</span>
                      <div className="bar-track">
                        <i
                          className="bar"
                          style={{
                            width: `${Math.max(2, ((counts[key] ?? 0) / data.metrics.total) * 100)}%`,
                          }}
                        />
                      </div>
                      <strong>{counts[key] ?? 0}</strong>
                    </div>
                  ))}
                </div>
              </section>
              <section className="panel health">
                <span className="section-kicker">RUN HEALTH</span>
                <div className="score">
                  <strong>
                    {(data.metrics.accuracy * 100).toFixed(1)}
                    <small>%</small>
                  </strong>
                  <span>classification accuracy</span>
                </div>
                <div className="health-line">
                  <span>Exception precision</span>
                  <b>{(data.metrics.precision * 100).toFixed(1)}%</b>
                </div>
                <div className="health-line">
                  <span>Exception recall</span>
                  <b>{(data.metrics.recall * 100).toFixed(1)}%</b>
                </div>
                <div className="health-line">
                  <span>Exception F1</span>
                  <b>{(data.metrics.f1 * 100).toFixed(1)}%</b>
                </div>
                <div className="throughput">
                  <b>{data.metrics.throughput.toFixed(0)}</b> records / sec
                  <span>
                    {data.metrics.processingTimeMs} ms processing time
                  </span>
                </div>
              </section>
            </div>
            <section className="panel exceptions">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">EXCEPTION QUEUE</span>
                  <h2>Cases that need a closer look</h2>
                </div>
                <div className="filters">
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  >
                    <option value="ALL">All exception types</option>
                    {Object.entries(labels)
                      .filter(([key]) => !autoClasses.has(key))
                      .map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                  </select>
                  <span className="count">{exceptions.length} open</span>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Transaction</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Difference</th>
                      <th>Confidence</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {exceptions.slice(0, 12).map((item) => (
                      <tr key={item.id} onClick={() => setSelected(item)}>
                        <td>
                          <strong>{item.id}</strong>
                          <small>{item.orderId}</small>
                        </td>
                        <td>
                          <span className="type">
                            {labels[item.prediction]}
                          </span>
                        </td>
                        <td>{money(item.paymentAmount)}</td>
                        <td className="negative">
                          {money(Math.abs(item.difference))}
                        </td>
                        <td>{(item.confidence * 100).toFixed(0)}%</td>
                        <td>
                          <span className="status">{item.status}</span>
                        </td>
                        <td>
                          <button
                            className="view"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelected(item);
                            }}
                          >
                            View →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="panel evaluation">
              <div>
                <span className="section-kicker">EVALUATION METHODOLOGY</span>
                <h2>Canonical results plus hidden labels</h2>
                <p>
                  One 500-record result set powers the overview, queue, status
                  counts, and throughput. Separately stored hidden labels are
                  used only to score those predictions.
                </p>
                <div className="method-row">
                  <span>
                    Test records <b>{data.metrics.total}</b>
                  </span>
                  <span>
                    Ground-truth classes <b>{data.metrics.classes.length}</b>
                  </span>
                  <span>
                    Predicted classes{" "}
                    <b>{data.metrics.predictedClasses.length}</b>
                  </span>
                </div>
                <div className="method-row">
                  <span>
                    Exception false positives{" "}
                    <b>{data.metrics.falsePositives.length}</b>
                  </span>
                  <span>
                    Exception false negatives{" "}
                    <b>{data.metrics.falseNegatives.length}</b>
                  </span>
                  <span>
                    Class-only misclassifications{" "}
                    <b>
                      {data.metrics.classificationOnlyMisclassifications.length}
                    </b>
                  </span>
                </div>
              </div>
              <div className="metric-grid">
                <Metric
                  label="Classification accuracy"
                  value={data.metrics.accuracy}
                />
                <Metric
                  label="Exception precision"
                  value={data.metrics.precision}
                />
                <Metric label="Exception recall" value={data.metrics.recall} />
                <Metric label="Exception F1" value={data.metrics.f1} />
              </div>
              <div className="error-note">
                Exception detection: {data.metrics.falsePositives.length} false
                positives and {data.metrics.falseNegatives.length} false
                negatives. Additional class-only misclassifications:{" "}
                {data.metrics.classificationOnlyMisclassifications.length};
                total class errors including false positives:{" "}
                {data.metrics.misclassifications.length}.
              </div>
              <div className="matrix">
                <span className="section-kicker">
                  CONFUSION MATRIX / ACTUAL × PREDICTED
                </span>
                <div className="matrix-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Actual</th>
                        {data.metrics.classes.map((key) => (
                          <th key={key}>{key.replace("_", " ")}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.metrics.matrix.map((row) => (
                        <tr key={row.actual}>
                          <td>{row.actual.replace("_", " ")}</td>
                          {row.values.map((value, i) => (
                            <td key={`${row.actual}-${i}`}>{value}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </section>
      {selected && <Detail item={selected} close={() => setSelected(null)} />}
    </main>
  );
}
function Kpi({
  label,
  value,
  note,
  positive,
  warn,
}: {
  label: string;
  value: string;
  note: string;
  positive?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <strong className={positive ? "positive" : warn ? "warning" : ""}>
        {value}
      </strong>
      <small>{note}</small>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{(value * 100).toFixed(1)}%</strong>
      <div className="metric-track">
        <i style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}
function Detail({ item, close }: { item: Reconciliation; close: () => void }) {
  return (
    <div className="drawer-backdrop" onClick={close}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={close}>
          ×
        </button>
        <span className="section-kicker">TRANSACTION DETAIL</span>
        <h2>{item.id}</h2>
        <p className="muted">
          {item.customerId} · {item.orderId} · {item.paymentId}
        </p>
        <span className="status">{item.status}</span>
        <div className="finance-list">
          <Line label="Payment amount" value={money(item.paymentAmount)} />
          <Line label="Order amount" value={money(item.orderAmount)} />
          <Line
            label="Settlement amount"
            value={
              item.settlementAmount === null
                ? "Missing"
                : money(item.settlementAmount)
            }
          />
          <Line label="Fee" value={money(item.feeAmount)} />
          <Line label="Refund" value={money(item.refundAmount)} />
          <Line label="Difference" value={money(Math.abs(item.difference))} />
        </div>
        <div className="decision">
          <span className="section-kicker">RULE-BASED EXPLANATION</span>
          <h3>{labels[item.prediction]}</h3>
          <p>{item.explanation}</p>
          <strong>{(item.confidence * 100).toFixed(0)}% confidence</strong>
          <p className="action">Recommended: {item.recommendedAction}</p>
        </div>
        <div className="checks">
          <span className="section-kicker">DETERMINISTIC CHECKS</span>
          {item.rules.map((rule) => (
            <div key={rule}>✓ {rule}</div>
          ))}
        </div>
        <div className="audit">
          <span className="section-kicker">AUDIT TRAIL</span>
          {item.audit.map((event, i) => (
            <div key={event}>
              <i>{i + 1}</i>
              {event}
              <small>recorded automatically</small>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
