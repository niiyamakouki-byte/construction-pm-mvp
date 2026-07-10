import pollHandler from "../../src/vercel-handlers/chat/poll.js";
import sendHandler from "../../src/vercel-handlers/chat/send.js";

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

  if (action === "poll") {
    return pollHandler(req, res);
  }

  if (action === "send") {
    return sendHandler(req, res);
  }

  res.status(404).json({ error: "Not found" });
}
