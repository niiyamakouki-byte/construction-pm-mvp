/**
 * assistantCommands — 5コマンドの仮実装
 *
 * 実データ接続は別タスク。すべて敬語スタイルの固定返答を返す。
 */

import { parseMessage } from "./assistantParser.js";

export type CommandResult = {
  text: string;
};

/** コマンドハンドラーの型 */
type CommandHandler = (args: string[]) => CommandResult;

// ── 各コマンド実装 ──────────────────────────────────────────────

const handleEstimate: CommandHandler = (args) => {
  const [item = "壁紙", room = "LDK", qty = "30㎡"] = args;
  return {
    text: [
      `見積を作りますね。${room} の ${item}（${qty}）でしたら、`,
      `標準単価で概算 ${estimatePrice(item)} 円程度になります。`,
      `詳細な数量・仕上げ仕様が決まり次第、正式見積書をご用意いたします。`,
    ].join("\n"),
  };
};

/** 品目別の概算単価（仮実装） */
function estimatePrice(item: string): string {
  const table: Record<string, string> = {
    壁紙: "45,000〜65,000",
    フローリング: "120,000〜180,000",
    タイル: "80,000〜130,000",
    塗装: "35,000〜55,000",
  };
  return table[item] ?? "お見積もり要";
}

const handleSchedule: CommandHandler = (args) => {
  const [site = "現場", process = "内装"] = args;
  return {
    text: [
      `${site} の ${process} 工程を確認いたします。`,
      `現在の工程表では来週月曜〜水曜が着工予定となっております。`,
      `詳細な日程は担当者に確認のうえ、改めてご連絡いたします。`,
    ].join("\n"),
  };
};

const handleCost: CommandHandler = (args) => {
  const [project = "案件"] = args;
  return {
    text: [
      `${project} のコスト状況をご報告いたします。`,
      `予算: 4,800,000 円 ／ 実績: 3,120,000 円（消化率 65%）`,
      `現時点で予算内に収まっております。引き続き注視いたします。`,
    ].join("\n"),
  };
};

const handleSafety: CommandHandler = (args) => {
  const [site = "現場"] = args;
  return {
    text: [
      `${site} の本日のKY（危険予知）活動項目でございます。`,
      `① 高所作業時の安全帯装着を確認なさってください`,
      `② 電動工具使用前の点検を実施なさってください`,
      `③ 作業区画の立入禁止テープを確認なさってください`,
      `安全第一で今日もよろしくお願いいたします。`,
    ].join("\n"),
  };
};

const handleHelp: CommandHandler = (_args) => {
  return {
    text: [
      "ご利用いただけるコマンドは以下の通りでございます。",
      "",
      "📋 /estimate <品目> <部屋> <数量>",
      "　例: /estimate 壁紙 LDK 30㎡",
      "　→ 見積概算を計算いたします",
      "",
      "📅 /schedule <現場> <工程>",
      "　例: /schedule 南青山 内装",
      "　→ 工程の予定日程をご案内いたします",
      "",
      "💰 /cost <案件名>",
      "　例: /cost 南青山案件",
      "　→ 予実差をご報告いたします",
      "",
      "⛑️ /safety <現場名>",
      "　例: /safety 南青山",
      "　→ 本日のKY活動項目をご案内いたします",
      "",
      "❓ /help",
      "　→ このコマンド一覧を表示いたします",
    ].join("\n"),
  };
};

// ── コマンドディスパッチャー ───────────────────────────────────

const COMMANDS: Record<string, CommandHandler> = {
  estimate: handleEstimate,
  schedule: handleSchedule,
  cost: handleCost,
  safety: handleSafety,
  help: handleHelp,
};

/** 自然文への応答 */
const NATURAL_RESPONSE =
  "申し訳ございません、まだ自然言語対応中でございます。`/help` でコマンド一覧をご覧になれます。";

/** 未知コマンドへの応答 */
function unknownCommandResponse(command: string): CommandResult {
  return {
    text: `「/${command}」は未対応のコマンドでございます。\`/help\` でコマンド一覧をご覧になれます。`,
  };
}

/**
 * 入力文字列を受け取り、適切な返答テキストを返す。
 * API呼び出しなし・完全ローカル実装。
 */
export function handleInput(input: string): CommandResult {
  const parsed = parseMessage(input);

  if (parsed.type === "natural") {
    return { text: NATURAL_RESPONSE };
  }

  const handler = COMMANDS[parsed.command];
  if (!handler) {
    return unknownCommandResponse(parsed.command);
  }

  return handler(parsed.args);
}
