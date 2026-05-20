import { execFileSync } from "node:child_process";

export type HpPostFaq = {
  question: string;
  answer: string;
};

export type HpPostParams = {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  category: string;
  body: string;
  heroImage?: string;
  faq?: HpPostFaq[];
};

export type HpPostResult = {
  slug: string;
  sha: string;
};

type PublishOptions = {
  mcpPath?: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const MCP_PATH_ENV = "LAPORTA_HP_BLOG_MCP_PATH";

export function publishHpPost(
  params: HpPostParams,
  options: PublishOptions = {},
): HpPostResult {
  const mcpPath = resolveMcpPath(options.mcpPath);
  const toolsPath = `${trimTrailingSlash(mcpPath)}/dist/tools.js`;
  const script = buildDynamicImportScript(toolsPath);

  try {
    const stdout = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: mcpPath,
      encoding: "utf8",
      input: JSON.stringify(params),
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

    return parsePublishResult(stdout);
  } catch (error) {
    throw new Error(
      `laporta-hp-blog-mcp createPost failed for slug "${params.slug}" via ${toolsPath}: ${extractErrorMessage(error)}`,
    );
  }
}

export function isSlugCollisionError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Slug already exists");
}

export function buildDynamicImportScript(toolsPath: string): string {
  return `
const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}

try {
  const params = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const module = await import(${JSON.stringify(toolsPath)});
  if (typeof module.createPost !== "function") {
    throw new Error("createPost export was not found in dist/tools.js");
  }
  const result = module.createPost(params);
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(message);
  process.exit(1);
}
`.trim();
}

function resolveMcpPath(explicitPath?: string): string {
  const mcpPath = explicitPath ?? process.env[MCP_PATH_ENV];
  if (!mcpPath) {
    throw new Error(`${MCP_PATH_ENV} is required to publish to laporta-hp-blog-mcp`);
  }
  return trimTrailingSlash(mcpPath);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function parsePublishResult(stdout: string): HpPostResult {
  const parsed: unknown = JSON.parse(stdout);
  if (!isRecord(parsed) || typeof parsed.slug !== "string" || typeof parsed.sha !== "string") {
    throw new Error("createPost returned an invalid result");
  }
  return {
    slug: parsed.slug,
    sha: parsed.sha,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
