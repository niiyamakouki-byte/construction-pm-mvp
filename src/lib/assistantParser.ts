/**
 * assistantParser — スラッシュコマンドと自然文を解析する
 *
 * `/コマンド 引数1 引数2` → { type: "command", command, args }
 * それ以外                → { type: "natural", text }
 */

export type ParsedMessage =
  | { type: "command"; command: string; args: string[] }
  | { type: "natural"; text: string };

/**
 * 入力文字列をパースして ParsedMessage を返す。
 * 空文字列は natural 扱い。
 */
export function parseMessage(input: string): ParsedMessage {
  const trimmed = input.trim();

  if (trimmed.startsWith("/")) {
    // スラッシュ以降をトークン分割
    const parts = trimmed.slice(1).split(/\s+/).filter(Boolean);
    const command = parts[0] ?? "";
    const args = parts.slice(1);
    return { type: "command", command, args };
  }

  return { type: "natural", text: trimmed };
}
