import subscribeHandler from "../../src/vercel-handlers/push/subscribe.js";
import testHandler from "../../src/vercel-handlers/push/test.js";
// contact/invite は Web Push と無関係だが、Hobby プランの Function 上限12に到達済みのため
// この [action] ディスパッチャに間借りする（詳細は各ハンドラのコメント参照）。
import notifyContactHandler from "../../src/vercel-handlers/notify/contact.js";
import notifyInviteHandler from "../../src/vercel-handlers/notify/invite.js";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;

  if (action === "subscribe") {
    return subscribeHandler(req, res);
  }

  if (action === "test") {
    return testHandler(req, res);
  }

  if (action === "contact") {
    return notifyContactHandler(req, res);
  }

  if (action === "invite") {
    return notifyInviteHandler(req, res);
  }

  res.status(404).json({ error: "Not found" });
}
