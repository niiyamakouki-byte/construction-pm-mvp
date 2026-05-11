/**
 * 工程テンプレートライブラリ — 型定義
 *
 * WBSCategory / WBSGroup / WBSTask の 3階層を再利用。
 * 永続化は LocalStorage。Supabase 移行は Sprint 61 で別途対応。
 */

import type { WBSCategory } from "../work-breakdown/types.js";

export type PhaseTemplateTag = "住宅" | "店舗" | "オフィス";

export type PhaseTemplate = {
  id: string;
  name: string;
  description: string;
  tags: PhaseTemplateTag[];
  /** WBSCategory[] — 大項目→中項目→小項目の3階層 */
  phases: WBSCategory[];
  createdAt: string; // ISO 8601
};
