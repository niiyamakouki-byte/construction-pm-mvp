#!/usr/bin/env -S node --experimental-strip-types

import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

const DEFAULT_API_URL = process.env.GENBAHUB_API_URL ?? "http://127.0.0.1:3001";

type CommandName = "add-project" | "add-task" | "import-schedule";

function printHelp(): void {
  console.log(`GenbaHub CLI

使い方:
  genbahub-cli add-project --name "ゴディバ" --contractor "フィールドクラブ" --address "東京都" [--status planning]
  genbahub-cli add-task --project-id <project-id> --name "LGS工事" --start 2026-04-10 --end 2026-04-15 [--contractor-id <id>] [--description "補足"]
  genbahub-cli import-schedule --project-id <project-id> --file ./schedule.xlsx

オプション:
  --api-url <url>      API サーバーURL (既定値: ${DEFAULT_API_URL})
  --help               このヘルプを表示
`);
}

function parseArgs(argv: string[]): {
  command: CommandName | null;
  options: Record<string, string>;
} {
  const args = [...argv];
  const command = args.shift() as CommandName | undefined;
  const options: Record<string, string> = {};

  while (args.length > 0) {
    const token = args.shift()!;
    if (!token.startsWith("--")) {
      throw new Error(`不明な引数です: ${token}`);
    }

    const key = token.slice(2);
    const value = args.shift();
    if (!value || value.startsWith("--")) {
      throw new Error(`オプション ${token} には値が必要です。`);
    }
    options[key] = value;
  }

  if (!command || !["add-project", "add-task", "import-schedule"].includes(command)) {
    return { command: null, options };
  }

  return { command, options };
}

function requireOption(
  options: Record<string, string>,
  key: string,
  label: string,
): string {
  const value = options[key];
  if (!value?.trim()) {
    throw new Error(`${label}を指定してください。`);
  }
  return value.trim();
}

async function requestJson(
  url: string,
  init: RequestInit,
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(`API サーバーに接続できません: ${url}`);
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) as Record<string, unknown> : {};

  if (!response.ok) {
    const errorMessage =
      typeof data.error === "string"
        ? data.error
        : "API リクエストに失敗しました。";
    throw new Error(errorMessage);
  }

  return data;
}

function getUploadContentType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".csv":
      return "text/csv";
    case ".xls":
      return "application/vnd.ms-excel";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return "application/octet-stream";
  }
}

async function run(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("--help")) {
    printHelp();
    return;
  }

  const { command, options } = parseArgs(argv);
  if (!command) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const apiUrl = (options["api-url"] ?? DEFAULT_API_URL).replace(/\/+$/, "");

  if (command === "add-project") {
    const payload = {
      name: requireOption(options, "name", "プロジェクト名"),
      contractor: requireOption(options, "contractor", "元請会社名"),
      address: requireOption(options, "address", "住所"),
      status: options.status?.trim() || "planning",
    };

    const result = await requestJson(`${apiUrl}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "import-schedule") {
    const projectId = requireOption(options, "project-id", "プロジェクトID");
    const filePath = requireOption(options, "file", "ファイルパス");
    const fileBuffer = await readFile(filePath);
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([fileBuffer], { type: getUploadContentType(filePath) }),
      basename(filePath),
    );

    const result = await requestJson(
      `${apiUrl}/api/projects/${encodeURIComponent(projectId)}/import`,
      {
        method: "POST",
        body: formData,
      },
    );
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const projectId = requireOption(options, "project-id", "プロジェクトID");
  const payload = {
    name: requireOption(options, "name", "タスク名"),
    startDate: requireOption(options, "start", "開始日"),
    endDate: requireOption(options, "end", "終了日"),
    contractorId: options["contractor-id"]?.trim() || undefined,
    description: options.description?.trim() || "",
  };

  const result = await requestJson(`${apiUrl}/api/projects/${encodeURIComponent(projectId)}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "CLI 実行中にエラーが発生しました。");
  process.exitCode = 1;
});
