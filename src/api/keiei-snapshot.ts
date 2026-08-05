/**
 * 経営タブのデータブリッジ（Node専用・devサーバでのみ使用）。
 *
 * ~/laporta-keiei が既に計算済みの経営指標(残高・ランウェイ・未回収・データ欠損)を
 * JSON/レポートファイルとして書き出している。ここではその計算ロジックを一切作り直さず、
 * 既存の出力ファイルを読んで画面表示用の形に整えるだけ。
 *
 * ponytail: ~/laporta-keiei はこのMac上のローカルファイルなので、本番(Vercel)からは
 * 読めない。よって本モジュールは vite.config.ts の dev サーバmiddleware専用（`pnpm dev`時のみ
 * 実データが出る）。将来リモートstaffにも見せたくなったら、keiei側からSupabaseへ
 * スナップショットを同期するジョブを足すのが素直なアップグレード経路。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export type RunwayEstimate = {
  months: number | null;
  exhaustedOn: string | null;
  assumption: string;
};

export type ReceivableRow = {
  client: string;
  title: string;
  amount: number;
  dueDate: string;
  invoiceNumber: string;
};

export type KeieiSnapshot =
  | {
      ok: true;
      asOf: string;
      bankBalance: number;
      runway: { worst: RunwayEstimate; best: RunwayEstimate; historical: RunwayEstimate | null } | null;
      receivables: { count: number; total: number; rows: ReceivableRow[] } | null;
      monthCashflow: { month: string; income: number; expense: number } | null;
      dataQuality: { unregisteredWalletTxns: number; asOf: string; note: string } | null;
      warnings: string[];
    }
  | { ok: false; reason: string };

function defaultRoot(): string {
  return path.join(process.env.HOME ?? "", "laporta-keiei");
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** kind配下の {YYYY-MM}.json 群を読み、rows を1本にまとめる。壊れたファイルはスキップ。 */
function loadMonthlyRows(kindDir: string): Record<string, unknown>[] {
  if (!existsSync(kindDir)) return [];
  const rows: Record<string, unknown>[] = [];
  for (const file of readdirSync(kindDir)) {
    if (!/^\d{4}-\d{2}\.json$/.test(file)) continue;
    try {
      const data = JSON.parse(readFileSync(path.join(kindDir, file), "utf8"));
      if (Array.isArray(data?.rows)) rows.push(...data.rows);
    } catch {
      // 壊れたJSONは無視（このタブはread-only表示、書き込み修復はしない）
    }
  }
  return rows;
}

type RawRunwayEstimate = { months: number | null; exhausted_on: string | null; assumption: string };

/** keiei/reports.py の morning JSON 出力のうち、このタブが使う項目だけの形。 */
type MorningReportJson = {
  bank_balance?: number;
  runway?: {
    worst_case?: RawRunwayEstimate;
    best_case?: RawRunwayEstimate;
    with_historical_revenue?: RawRunwayEstimate;
  };
  data_quality?: { unregistered_wallet_txns?: number; as_of?: string; note?: string };
};

function latestMorningReport(root: string): { day: string; data: MorningReportJson } | null {
  const dir = path.join(root, "reports");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}-morning\.json$/.test(f))
    .sort();
  if (files.length === 0) return null;
  const latest = files[files.length - 1];
  const data = JSON.parse(readFileSync(path.join(dir, latest), "utf8")) as MorningReportJson;
  return { day: latest.slice(0, 10), data };
}

function toRunwayEstimate(r: RawRunwayEstimate | undefined): RunwayEstimate {
  return { months: r?.months ?? null, exhaustedOn: r?.exhausted_on ?? null, assumption: r?.assumption ?? "" };
}

function loadReceivables(root: string): { count: number; total: number; rows: ReceivableRow[] } | null {
  const dir = path.join(root, "receivables");
  if (!existsSync(dir)) return null;
  const rows = loadMonthlyRows(dir)
    .filter((r) => r.status === "unpaid")
    .sort((a, b) => String(a.due_date ?? "").localeCompare(String(b.due_date ?? "")));
  return {
    count: rows.length,
    total: rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0),
    rows: rows.map((r) => ({
      client: String(r.client ?? ""),
      title: String(r.title ?? ""),
      amount: Number(r.amount ?? 0),
      dueDate: String(r.due_date ?? ""),
      invoiceNumber: String(r.invoice_number ?? ""),
    })),
  };
}

/** 今月の入出金。ledger未投入なら0円を出さずnull(=不明)を返す。 */
function loadMonthCashflow(root: string): { month: string; income: number; expense: number } | null {
  const month = todayISO().slice(0, 7);
  const rows = loadMonthlyRows(path.join(root, "ledger")).filter(
    (r) => typeof r.date === "string" && r.date.startsWith(month),
  );
  if (rows.length === 0) return null;
  const income = rows.filter((r) => r.direction === "income").reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const expense = rows.filter((r) => r.direction === "expense").reduce((s, r) => s + Number(r.amount ?? 0), 0);
  return { month, income, expense };
}

export function loadKeieiSnapshot(root: string = defaultRoot()): KeieiSnapshot {
  const report = latestMorningReport(root);
  if (!report) {
    return { ok: false, reason: "経営レポートが見つかりません（~/laporta-keiei/reports/*-morning.json 未生成）" };
  }
  const { day, data } = report;
  const warnings: string[] = [];
  if (day !== todayISO()) warnings.push(`最新レポートは${day}時点（本日分はまだ生成されていません）`);

  const runwayRaw = data.runway ?? {};
  const runway = runwayRaw.worst_case
    ? {
        worst: toRunwayEstimate(runwayRaw.worst_case),
        best: toRunwayEstimate(runwayRaw.best_case),
        historical: runwayRaw.with_historical_revenue ? toRunwayEstimate(runwayRaw.with_historical_revenue) : null,
      }
    : null;
  if (!runway) warnings.push("資金ランウェイ: 未算出");

  const monthCashflow = loadMonthCashflow(root);
  if (!monthCashflow) warnings.push("今月の入出金: ledgerデータ未投入のため不明");

  const dq = data.data_quality;
  const dataQuality =
    dq && typeof dq.unregistered_wallet_txns === "number"
      ? { unregisteredWalletTxns: dq.unregistered_wallet_txns, asOf: dq.as_of ?? day, note: dq.note ?? "" }
      : null;

  return {
    ok: true,
    asOf: day,
    bankBalance: Number(data.bank_balance ?? 0),
    runway,
    receivables: loadReceivables(root),
    monthCashflow,
    dataQuality,
    warnings,
  };
}
