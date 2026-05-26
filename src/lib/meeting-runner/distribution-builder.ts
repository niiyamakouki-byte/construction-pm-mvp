/**
 * distribution-builder — 議事録を各配布フォーマットに変換する
 *
 * Sprint 17-A: 工程会議自動進行AI
 * - Discord Markdown
 * - Email HTML
 * - Pure Markdown
 */

import type { MeetingSession, MeetingMinutes, MeetingDistributionFormat } from "./types.js";
import { MEETING_KIND_LABELS, ACTION_STATUS_LABELS } from "./types.js";

// ── Formatting helpers ─────────────────────────────────────────────────────

function formatDateJa(iso: string): string {
  const dt = new Date(iso);
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  const dow = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
  return `${y}年${m}月${d}日（${dow}）`;
}

function formatDueJa(dueDate: string): string {
  const dt = new Date(dueDate);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

// ── Discord Markdown builder ───────────────────────────────────────────────

export function buildDiscordMessage(
  session: MeetingSession,
  minutes: MeetingMinutes,
): string {
  const kind = MEETING_KIND_LABELS[session.kind];
  const dateStr = formatDateJa(session.scheduledAt);
  const projectId = session.projectId;

  const lines: string[] = [
    `## 📋 ${kind} 議事録`,
    `**日時:** ${dateStr}　**案件:** ${projectId}`,
    `**参加者:** ${session.participants.join("、") || "（未設定）"}`,
    "",
  ];

  if (minutes.decisions.length > 0) {
    lines.push("### ✅ 決定事項");
    for (const d of minutes.decisions) {
      lines.push(`- ${d}`);
    }
    lines.push("");
  }

  if (minutes.actionItems.length > 0) {
    lines.push("### 🔧 アクションアイテム");
    for (const a of minutes.actionItems) {
      const statusLabel = ACTION_STATUS_LABELS[a.status];
      lines.push(
        `- **${a.assignee}** / ${formatDueJa(a.dueDate)}まで / [${statusLabel}] ${a.description}`,
      );
    }
    lines.push("");
  }

  if (minutes.unresolvedItems.length > 0) {
    lines.push("### ⏭ 次回持越し");
    for (const u of minutes.unresolvedItems) {
      lines.push(`- ${u.title}（担当: ${u.owner}）`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── Email HTML builder ─────────────────────────────────────────────────────

export function buildEmailHtml(
  session: MeetingSession,
  minutes: MeetingMinutes,
): string {
  const kind = MEETING_KIND_LABELS[session.kind];
  const dateStr = formatDateJa(session.scheduledAt);

  const decisionsHtml =
    minutes.decisions.length > 0
      ? `<h3 style="color:#2d4a1e;border-bottom:1px solid #6B8E5A;">✅ 決定事項</h3><ul>${minutes.decisions.map((d) => `<li>${d}</li>`).join("")}</ul>`
      : "";

  const actionsHtml =
    minutes.actionItems.length > 0
      ? `<h3 style="color:#2d4a1e;border-bottom:1px solid #6B8E5A;">🔧 アクションアイテム</h3><table style="border-collapse:collapse;width:100%;"><thead><tr style="background:#6B8E5A;color:#fff;"><th style="padding:6px 10px;text-align:left;">担当者</th><th style="padding:6px 10px;text-align:left;">期限</th><th style="padding:6px 10px;text-align:left;">内容</th><th style="padding:6px 10px;text-align:left;">状態</th></tr></thead><tbody>${minutes.actionItems
          .map(
            (a, i) =>
              `<tr style="background:${i % 2 === 0 ? "#f8fdf5" : "#fff"};"><td style="padding:6px 10px;">${a.assignee}</td><td style="padding:6px 10px;">${formatDueJa(a.dueDate)}</td><td style="padding:6px 10px;">${a.description}</td><td style="padding:6px 10px;">${ACTION_STATUS_LABELS[a.status]}</td></tr>`,
          )
          .join("")}</tbody></table>`
      : "";

  const unresolvedHtml =
    minutes.unresolvedItems.length > 0
      ? `<h3 style="color:#2d4a1e;border-bottom:1px solid #6B8E5A;">⏭ 次回持越し</h3><ul>${minutes.unresolvedItems.map((u) => `<li>${u.title}（担当: ${u.owner}）</li>`).join("")}</ul>`
      : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>${kind} 議事録</title></head>
<body style="font-family:'Hiragino Sans','Yu Gothic',sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#1a2e0a;">
  <div style="background:#6B8E5A;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;font-size:1.2rem;">📋 ${kind} 議事録</h2>
    <div style="margin-top:4px;font-size:0.9rem;opacity:0.9;">${dateStr}　案件: ${session.projectId}</div>
  </div>
  <div style="border:1px solid #d4e4c8;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
    <p style="margin-top:0;"><strong>参加者:</strong> ${session.participants.join("、") || "（未設定）"}</p>
    ${decisionsHtml}
    ${actionsHtml}
    ${unresolvedHtml}
    <hr style="border-color:#d4e4c8;margin-top:24px;">
    <p style="font-size:0.8rem;color:#666;margin-bottom:0;">この議事録はGenbaHubにより自動生成されました。</p>
  </div>
</body>
</html>`;
}

// ── Pure Markdown builder ──────────────────────────────────────────────────

export function buildMarkdown(
  session: MeetingSession,
  minutes: MeetingMinutes,
): string {
  const kind = MEETING_KIND_LABELS[session.kind];
  const dateStr = formatDateJa(session.scheduledAt);

  const lines: string[] = [
    `# ${kind} 議事録`,
    "",
    `- **日時:** ${dateStr}`,
    `- **案件ID:** ${session.projectId}`,
    `- **参加者:** ${session.participants.join("、") || "（未設定）"}`,
    "",
  ];

  if (minutes.decisions.length > 0) {
    lines.push("## 決定事項");
    for (const d of minutes.decisions) {
      lines.push(`- ${d}`);
    }
    lines.push("");
  }

  if (minutes.actionItems.length > 0) {
    lines.push("## アクションアイテム");
    lines.push("");
    lines.push("| 担当者 | 期限 | 内容 | 状態 |");
    lines.push("| --- | --- | --- | --- |");
    for (const a of minutes.actionItems) {
      lines.push(
        `| ${a.assignee} | ${formatDueJa(a.dueDate)} | ${a.description} | ${ACTION_STATUS_LABELS[a.status]} |`,
      );
    }
    lines.push("");
  }

  if (minutes.unresolvedItems.length > 0) {
    lines.push("## 次回持越し");
    for (const u of minutes.unresolvedItems) {
      lines.push(`- ${u.title}（担当: ${u.owner}）`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── Facade ─────────────────────────────────────────────────────────────────

/**
 * 指定フォーマットで議事録テキストを生成する。
 */
export function buildDistribution(
  session: MeetingSession,
  minutes: MeetingMinutes,
  format: MeetingDistributionFormat,
): string {
  switch (format) {
    case "discord":
      return buildDiscordMessage(session, minutes);
    case "email_html":
      return buildEmailHtml(session, minutes);
    case "markdown":
      return buildMarkdown(session, minutes);
  }
}
