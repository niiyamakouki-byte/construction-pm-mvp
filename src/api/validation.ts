import { ApiError } from "./types.js";
import {
  CHANGE_ORDER_STATUSES,
  DEPENDENCY_TYPES,
  MATERIAL_STATUSES,
  PROJECT_STATUSES,
  TASK_STATUSES,
  type CreateChangeOrderInput,
  type CreateContractorInput,
  type CreateMaterialInput,
  type CreateProjectInput,
  type CreateTaskInput,
  type DependencyRecord,
  type ProjectStatus,
  type UpdateProjectInput,
  type UpdateTaskInput,
} from "./types.js";
import { formatDate, isNonEmptyString, isObject } from "./utils.js";

function parseDateString(value: string, fieldLabel: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `${fieldLabel}はYYYY-MM-DD形式で入力してください。`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || formatDate(date) !== value) {
    throw new ApiError(400, `${fieldLabel}が不正です。`);
  }

  return value;
}

export function assertDateOrder(startDate: string, endDate: string): void {
  if (startDate > endDate) {
    throw new ApiError(400, "開始日は終了日以前の日付を指定してください。");
  }
}

function validateEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fieldLabel: string,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    const allowedValues = allowed.map((item) => `「${item}」`).join("、");
    throw new ApiError(400, `${fieldLabel}は${allowedValues}のいずれかを指定してください。`);
  }
  return value as T[number];
}

function requireString(
  input: Record<string, unknown>,
  fieldName: string,
  fieldLabel: string,
  maxLength: number,
): string {
  const value = input[fieldName];
  if (!isNonEmptyString(value)) {
    throw new ApiError(400, `${fieldLabel}は必須です。`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ApiError(400, `${fieldLabel}は${maxLength}文字以内で入力してください。`);
  }
  return normalized;
}

function optionalTrimmedString(
  input: Record<string, unknown>,
  fieldName: string,
  fieldLabel: string,
  maxLength: number,
): string | undefined {
  const value = input[fieldName];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ApiError(400, `${fieldLabel}は文字列で入力してください。`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new ApiError(400, `${fieldLabel}を空文字にはできません。`);
  }
  if (normalized.length > maxLength) {
    throw new ApiError(400, `${fieldLabel}は${maxLength}文字以内で入力してください。`);
  }
  return normalized;
}

function optionalUpdatedString(
  input: Record<string, unknown>,
  fieldName: string,
  fieldLabel: string,
  maxLength: number,
  options: { allowEmpty?: boolean } = {},
): string | undefined {
  if (!(fieldName in input)) {
    return undefined;
  }

  const value = input[fieldName];
  if (typeof value !== "string") {
    throw new ApiError(400, `${fieldLabel}は文字列で入力してください。`);
  }

  const normalized = value.trim();
  if (!options.allowEmpty && !normalized) {
    throw new ApiError(400, `${fieldLabel}を空文字にはできません。`);
  }
  if (normalized.length > maxLength) {
    throw new ApiError(400, `${fieldLabel}は${maxLength}文字以内で入力してください。`);
  }
  return normalized;
}

function requireStringFromAliases(
  input: Record<string, unknown>,
  fieldNames: string[],
  fieldLabel: string,
  maxLength: number,
): string {
  for (const fieldName of fieldNames) {
    if (fieldName in input) {
      return requireString(input, fieldName, fieldLabel, maxLength);
    }
  }

  throw new ApiError(400, `${fieldLabel}は必須です。`);
}

function parseNumericValue(
  value: unknown,
  fieldLabel: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    throw new ApiError(400, `${fieldLabel}は数値で入力してください。`);
  }
  if (options.integer && !Number.isInteger(parsed)) {
    throw new ApiError(400, `${fieldLabel}は整数で入力してください。`);
  }
  if (options.min !== undefined && parsed < options.min) {
    throw new ApiError(400, `${fieldLabel}は${options.min}以上で入力してください。`);
  }
  if (options.max !== undefined && parsed > options.max) {
    throw new ApiError(400, `${fieldLabel}は${options.max}以下で入力してください。`);
  }

  return parsed;
}

function optionalUpdatedNullableString(
  input: Record<string, unknown>,
  fieldName: string,
  fieldLabel: string,
  maxLength: number,
): string | null | undefined {
  if (!(fieldName in input)) {
    return undefined;
  }

  if (input[fieldName] === null) {
    return null;
  }

  return optionalUpdatedString(input, fieldName, fieldLabel, maxLength);
}

function optionalUpdatedNumber(
  input: Record<string, unknown>,
  fieldName: string,
  fieldLabel: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number | undefined {
  if (!(fieldName in input)) {
    return undefined;
  }

  return parseNumericValue(input[fieldName], fieldLabel, options);
}

function optionalUpdatedNullableNumber(
  input: Record<string, unknown>,
  fieldName: string,
  fieldLabel: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number | null | undefined {
  if (!(fieldName in input)) {
    return undefined;
  }

  if (input[fieldName] === null) {
    return null;
  }

  return parseNumericValue(input[fieldName], fieldLabel, options);
}

function optionalDateString(
  input: Record<string, unknown>,
  fieldName: string,
  fieldLabel: string,
): string | undefined {
  const value = input[fieldName];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ApiError(400, `${fieldLabel}はYYYY-MM-DD形式で入力してください。`);
  }

  return parseDateString(value.trim(), fieldLabel);
}

function optionalUpdatedNullableDateString(
  input: Record<string, unknown>,
  fieldName: string,
  fieldLabel: string,
): string | null | undefined {
  if (!(fieldName in input)) {
    return undefined;
  }

  if (input[fieldName] === null) {
    return null;
  }
  if (typeof input[fieldName] !== "string") {
    throw new ApiError(400, `${fieldLabel}はYYYY-MM-DD形式で入力してください。`);
  }

  return parseDateString(input[fieldName].trim(), fieldLabel);
}

function optionalBoolean(
  input: Record<string, unknown>,
  fieldName: string,
  fieldLabel: string,
): boolean | undefined {
  if (!(fieldName in input)) {
    return undefined;
  }
  if (typeof input[fieldName] !== "boolean") {
    throw new ApiError(400, `${fieldLabel}はtrueまたはfalseで入力してください。`);
  }

  return input[fieldName];
}

function validateEmail(value: string, fieldLabel: string): string {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new ApiError(400, `${fieldLabel}の形式が不正です。`);
  }

  return value;
}

export function assertProjectStatusTransition(
  currentStatus: ProjectStatus,
  nextStatus: ProjectStatus,
): void {
  if (currentStatus === nextStatus) {
    return;
  }

  const currentIndex = PROJECT_STATUSES.indexOf(currentStatus);
  const nextIndex = PROJECT_STATUSES.indexOf(nextStatus);
  if (nextIndex - currentIndex !== 1) {
    throw new ApiError(
      400,
      "プロジェクトステータスは planning → active → completed の順でのみ更新できます。",
    );
  }
}

export function validateCreateProjectInput(payload: unknown): CreateProjectInput {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  return {
    name: requireString(payload, "name", "プロジェクト名", 200),
    contractor: requireString(payload, "contractor", "元請会社名", 200),
    address: requireString(payload, "address", "住所", 500),
    status: validateEnum(payload.status, PROJECT_STATUSES, "ステータス"),
    clientId: optionalTrimmedString(payload, "clientId", "顧客ID", 200),
    clientName: optionalTrimmedString(payload, "clientName", "顧客名", 200),
    contractAmount:
      "contractAmount" in payload
        ? parseNumericValue(payload.contractAmount, "契約金額", { min: 0 })
        : undefined,
    contractDate: optionalDateString(payload, "contractDate", "契約日"),
    inspectionDate: optionalDateString(payload, "inspectionDate", "検査日"),
    handoverDate: optionalDateString(payload, "handoverDate", "引渡日"),
    warrantyEndDate: optionalDateString(payload, "warrantyEndDate", "保証終了日"),
  };
}

export function validateUpdateProjectInput(payload: unknown): UpdateProjectInput {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  const update: UpdateProjectInput = {};

  if ("name" in payload) {
    update.name = optionalUpdatedString(payload, "name", "プロジェクト名", 200);
  }
  if ("contractor" in payload) {
    update.contractor = optionalUpdatedString(payload, "contractor", "元請会社名", 200);
  }
  if ("address" in payload) {
    update.address = optionalUpdatedString(payload, "address", "住所", 500);
  }
  if ("status" in payload) {
    update.status = validateEnum(payload.status, PROJECT_STATUSES, "ステータス");
  }
  if ("description" in payload) {
    update.description = optionalUpdatedString(payload, "description", "説明", 2000, {
      allowEmpty: true,
    });
  }
  if ("startDate" in payload) {
    if (typeof payload.startDate !== "string") {
      throw new ApiError(400, "開始日はYYYY-MM-DD形式で入力してください。");
    }
    update.startDate = parseDateString(payload.startDate.trim(), "開始日");
  }
  if ("endDate" in payload) {
    if (payload.endDate === null) {
      update.endDate = null;
    } else if (typeof payload.endDate === "string") {
      update.endDate = parseDateString(payload.endDate.trim(), "終了日");
    } else {
      throw new ApiError(400, "終了日はYYYY-MM-DD形式で入力してください。");
    }
  }
  if ("clientId" in payload) {
    update.clientId = optionalUpdatedNullableString(payload, "clientId", "顧客ID", 200);
  }
  if ("clientName" in payload) {
    update.clientName = optionalUpdatedNullableString(payload, "clientName", "顧客名", 200);
  }
  if ("contractAmount" in payload) {
    update.contractAmount = optionalUpdatedNullableNumber(payload, "contractAmount", "契約金額", {
      min: 0,
    });
  }
  if ("contractDate" in payload) {
    update.contractDate = optionalUpdatedNullableDateString(payload, "contractDate", "契約日");
  }
  if ("inspectionDate" in payload) {
    update.inspectionDate = optionalUpdatedNullableDateString(payload, "inspectionDate", "検査日");
  }
  if ("handoverDate" in payload) {
    update.handoverDate = optionalUpdatedNullableDateString(payload, "handoverDate", "引渡日");
  }
  if ("warrantyEndDate" in payload) {
    update.warrantyEndDate = optionalUpdatedNullableDateString(
      payload,
      "warrantyEndDate",
      "保証終了日",
    );
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "更新対象の項目を指定してください。");
  }

  return update;
}

export function validateCreateTaskInput(payload: unknown): CreateTaskInput {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  const startDate = parseDateString(
    requireString(payload, "startDate", "開始日", 10),
    "開始日",
  );
  const endDate = parseDateString(
    requireString(payload, "endDate", "終了日", 10),
    "終了日",
  );
  assertDateOrder(startDate, endDate);
  const isMilestone = optionalBoolean(payload, "isMilestone", "マイルストーン");
  if (isMilestone && startDate !== endDate) {
    throw new ApiError(400, "マイルストーンは開始日と終了日を同日にしてください。");
  }

  return {
    name: requireString(payload, "name", "タスク名", 200),
    startDate,
    endDate,
    progress:
      "progress" in payload
        ? parseNumericValue(payload.progress, "進捗率", { min: 0, max: 100, integer: true })
        : undefined,
    cost:
      "cost" in payload
        ? parseNumericValue(payload.cost, "タスク原価", { min: 0 })
        : undefined,
    contractorId: optionalTrimmedString(payload, "contractorId", "業者ID", 200),
    description: optionalTrimmedString(payload, "description", "説明", 2000) ?? "",
    isMilestone,
  };
}

export function validateCreateContractorInput(payload: unknown): CreateContractorInput {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  return {
    name: requireString(payload, "name", "業者名", 200),
    trade: requireStringFromAliases(payload, ["trade", "職種"], "職種", 100),
    phone: requireString(payload, "phone", "電話番号", 50),
    email: validateEmail(requireString(payload, "email", "メールアドレス", 200), "メールアドレス"),
  };
}

export function validateCreateMaterialInput(payload: unknown): CreateMaterialInput {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  return {
    name: requireString(payload, "name", "資材名", 200),
    quantity: parseNumericValue(payload.quantity, "数量", { min: 0 }),
    unit: requireString(payload, "unit", "単位", 50),
    unitPrice: parseNumericValue(payload.unitPrice, "単価", { min: 0 }),
    supplier: requireString(payload, "supplier", "仕入先", 200),
    deliveryDate: parseDateString(requireString(payload, "deliveryDate", "納品日", 10), "納品日"),
    status: validateEnum(payload.status, MATERIAL_STATUSES, "資材ステータス"),
  };
}

export function validateCreateChangeOrderInput(payload: unknown): CreateChangeOrderInput {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  return {
    description: requireString(payload, "description", "変更内容", 2000),
    amount: parseNumericValue(payload.amount, "金額"),
    approvedBy: requireString(payload, "approvedBy", "承認者", 200),
    date: parseDateString(requireString(payload, "date", "日付", 10), "日付"),
    status: validateEnum(payload.status, CHANGE_ORDER_STATUSES, "変更指示ステータス"),
  };
}

export function validateUpdateTaskInput(payload: unknown): UpdateTaskInput {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  const update: UpdateTaskInput = {};

  if ("status" in payload) {
    update.status = validateEnum(payload.status, TASK_STATUSES, "ステータス");
  }
  if ("startDate" in payload) {
    if (payload.startDate === null) {
      update.startDate = null;
    } else if (typeof payload.startDate === "string") {
      update.startDate = parseDateString(payload.startDate.trim(), "開始日");
    } else {
      throw new ApiError(400, "開始日はYYYY-MM-DD形式で入力してください。");
    }
  }
  if ("endDate" in payload) {
    if (payload.endDate === null) {
      update.endDate = null;
    } else if (typeof payload.endDate === "string") {
      update.endDate = parseDateString(payload.endDate.trim(), "終了日");
    } else {
      throw new ApiError(400, "終了日はYYYY-MM-DD形式で入力してください。");
    }
  }
  if ("projectId" in payload) {
    update.projectId = optionalUpdatedString(payload, "projectId", "プロジェクトID", 200);
  }
  if ("contractorId" in payload) {
    update.contractorId = optionalUpdatedNullableString(payload, "contractorId", "業者ID", 200);
  }
  if ("progress" in payload) {
    update.progress = optionalUpdatedNumber(payload, "progress", "進捗率", {
      min: 0,
      max: 100,
      integer: true,
    });
  }
  if ("cost" in payload) {
    update.cost = optionalUpdatedNumber(payload, "cost", "タスク原価", {
      min: 0,
    });
  }
  if ("isMilestone" in payload) {
    update.isMilestone = optionalBoolean(payload, "isMilestone", "マイルストーン");
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "更新対象の項目を指定してください。");
  }

  return update;
}

export function validateCreateDependencyInput(payload: unknown): DependencyRecord {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  return {
    predecessorId: requireString(payload, "predecessorId", "先行タスクID", 200),
    type: validateEnum(payload.type, DEPENDENCY_TYPES, "依存関係タイプ"),
    lagDays:
      "lagDays" in payload
        ? parseNumericValue(payload.lagDays, "ラグ日数", { integer: true })
        : 0,
  };
}
