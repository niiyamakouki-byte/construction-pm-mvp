import subscribeHandler from "../../src/vercel-handlers/push/subscribe.js";
import testHandler from "../../src/vercel-handlers/push/test.js";

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

  res.status(404).json({ error: "Not found" });
}
