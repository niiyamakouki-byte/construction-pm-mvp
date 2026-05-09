/**
 * share-actions.ts — 共有トークンの公開 API（施主向け portal 設定画面から呼ぶ）
 */

import { revoke as _revoke } from "./share-token-store.js";

/**
 * 共有トークンを失効させる。
 * 施主向け portal 設定画面から呼べる形の公開 API。
 *
 * @param tokenId 失効させるトークン ID（ShareTokenPayload.tokenId）
 * @param reason 失効理由（例: "施主による手動無効化" / "URLが漏洩した可能性"）
 */
export function revokeShareToken(tokenId: string, reason: string): void {
  if (!tokenId) throw new Error("tokenId is required");
  _revoke(tokenId, reason);
}
