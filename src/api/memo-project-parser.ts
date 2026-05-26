import { ApiError, type ProjectStatus } from "./types.js";
import { isObject } from "./utils.js";

export const MEMO_PROJECT_SOURCES = ["discord", "line", "manual"] as const;

export type MemoProjectSource = (typeof MEMO_PROJECT_SOURCES)[number];
export type MemoNaturalStatus = "planning" | "in_progress" | "completed";

export type ParsedMemoProjectText = {
  naturalText: string;
  source: MemoProjectSource;
  name: string;
  addressCandidate?: string;
  naturalStatus: MemoNaturalStatus;
  projectStatus: ProjectStatus;
  matchedStatusKeyword?: string;
};

const STATUS_KEYWORDS: Array<{
  pattern: RegExp;
  naturalStatus: MemoNaturalStatus;
  projectStatus: ProjectStatus;
}> = [
  { pattern: /(完工|完了|終わった|終わり|済み|済|終了|引渡し済み|引き渡し済み)/, naturalStatus: "completed", projectStatus: "completed" },
  { pattern: /(着工|進行中|施工中|工事中|対応中|作業中|始まった|スタート)/, naturalStatus: "in_progress", projectStatus: "active" },
  { pattern: /(見積中|見積もり中|見積り中|見積|計画中|予定|相談中|現調前)/, naturalStatus: "planning", projectStatus: "planning" },
];

const LOCATION_HINT_PATTERN =
  /(都|道|府|県|市|区|町|村|丁目|番地|台|谷|丘|坂|浜|島|橋|町|駅|銀座|新宿|渋谷|世田谷|白金|白金台|恵比寿|青山|赤坂|六本木|目黒|中目黒)/;

function normalizeNaturalText(value: string): string {
  return value
    .replace(/[　\t\r\n]+/g, " ")
    .replace(/[、。,.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findStatus(text: string): {
  naturalStatus: MemoNaturalStatus;
  projectStatus: ProjectStatus;
  matchedStatusKeyword?: string;
} {
  for (const entry of STATUS_KEYWORDS) {
    const match = text.match(entry.pattern);
    if (match?.[0]) {
      return {
        naturalStatus: entry.naturalStatus,
        projectStatus: entry.projectStatus,
        matchedStatusKeyword: match[0],
      };
    }
  }

  return {
    naturalStatus: "planning",
    projectStatus: "planning",
  };
}

function removeStatusKeyword(text: string, keyword?: string): string {
  if (!keyword) {
    return text;
  }

  return normalizeNaturalText(text.replace(keyword, " "));
}

function splitAddressCandidate(textWithoutStatus: string): {
  name: string;
  addressCandidate?: string;
} {
  const tokens = textWithoutStatus.split(" ").filter(Boolean);
  if (tokens.length <= 1) {
    return { name: textWithoutStatus };
  }

  const [firstToken, ...restTokens] = tokens;
  if (firstToken && LOCATION_HINT_PATTERN.test(firstToken) && restTokens.length > 0) {
    return {
      addressCandidate: firstToken,
      name: restTokens.join(" "),
    };
  }

  return { name: tokens.join(" ") };
}

export function validateMemoProjectSource(value: unknown): MemoProjectSource {
  if (typeof value !== "string" || !MEMO_PROJECT_SOURCES.includes(value as MemoProjectSource)) {
    throw new ApiError(400, "入力ソースは「discord」、「line」、「manual」のいずれかを指定してください。");
  }

  return value as MemoProjectSource;
}

export function parseMemoProjectText(payload: unknown): ParsedMemoProjectText {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  const source = validateMemoProjectSource(payload.source);
  if (typeof payload.naturalText !== "string" || !payload.naturalText.trim()) {
    throw new ApiError(400, "naturalTextは必須です。");
  }

  const naturalText = normalizeNaturalText(payload.naturalText);
  if (naturalText.length > 500) {
    throw new ApiError(400, "naturalTextは500文字以内で入力してください。");
  }

  const status = findStatus(naturalText);
  const withoutStatus = removeStatusKeyword(naturalText, status.matchedStatusKeyword);
  if (!withoutStatus) {
    throw new ApiError(400, "案件名を含む自然文を入力してください。");
  }

  const { name, addressCandidate } = splitAddressCandidate(withoutStatus);
  if (!name.trim()) {
    throw new ApiError(400, "案件名を含む自然文を入力してください。");
  }

  return {
    naturalText,
    source,
    name: name.trim(),
    addressCandidate,
    naturalStatus: status.naturalStatus,
    projectStatus: status.projectStatus,
    matchedStatusKeyword: status.matchedStatusKeyword,
  };
}
