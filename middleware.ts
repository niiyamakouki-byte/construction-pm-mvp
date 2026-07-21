/**
 * Vercel Routing Middleware — API_KEY (x-api-key) ゲート。
 *
 * 配置: Vercel Routing Middleware は project root の middleware.ts でないと実行されない
 * (旧 src/middleware.ts は規約違反で一度もデプロイ後に呼ばれたことがない dead code だった。
 * 2026-07-21 実測で確認・本ファイルへ移設)。
 *
 * 適用範囲について (2026-07-21 実測調査):
 * この x-api-key スキームは元々 src/api/router.ts の requireApiKey と同一の仕組みで、
 * `pnpm api:server` で起動する内部REST API (projects/tasks/materials 等、MCPツール
 * mcp__genbahub__* 経由でのみ叩かれる) 用に作られたもの。現在 Vercel Functions として
 * 公開デプロイされている /api/* (checkout-session, scan-import, invoice-ocr, chat/*,
 * push/*, freee/*, stripe-webhook, cron/keepalive) は実測で全て確認した通り、
 * それぞれ用途に応じた別の保護 (Supabase JWT Bearer認証 / Stripe署名 / freee webhookトークン /
 * CRON_SECRET) を個別に実装済みで、x-api-key は送っていない。ここへ matcher を
 * "/api/:path*" のまま広げて有効化すると、ブラウザ/Webhook からの正規リクエストが
 * 軒並み 401 になり本番が壊れる (2026-07-21 に relocateする過程で実測確認済み)。
 *
 * そのため matcher は将来 /api/internal/* 配下にサーバー間限定のエンドポイントを
 * 追加する時のために予約するに留め、現行の公開エンドポイントには適用しない。
 * 無認証で到達可能だった実際のギャップ (/api/chat/poll, /api/chat/send — userId が
 * 生のままDiscordプレフィックスに埋め込まれ偽装可能だった) は同日、入力サニタイズで
 * 個別に塞いだ (src/vercel-handlers/chat/{poll,send}.ts)。
 */
import { validateApiKey } from "./src/api/api-key.js";

function jsonErrorResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export function middleware(request: Request): Response | undefined {
  const { pathname } = new URL(request.url);

  if (request.method === "OPTIONS" || pathname === "/api/health") {
    return undefined;
  }

  const result = validateApiKey(request.headers);
  if (result.ok) {
    return undefined;
  }

  return jsonErrorResponse(result.statusCode, result.error);
}

// Vercel Routing Middleware は default export を要求する（旧コードは named export の
// みだったため、location を直しただけでは依然 Vercel から呼ばれなかった可能性がある。
// named export はテスト (middleware.test.ts) の import 用に残す）。
export default middleware;

export const config = {
  matcher: ["/api/internal/:path*"],
};
