/**
 * 現場AIチャットアシスタント — rule_based フォールバックガイド (Sprint 12-A)
 *
 * 過去事例DBにヒットしない場合に提示する8カテゴリ × 3手順の汎用ガイド。
 * 外部API/LLM不使用。純粋な静的データ。
 */

import { IssueCategory } from "./types.js";

export type RuleBasedGuide = {
  category: IssueCategory;
  summary: string;
  steps: string[];
};

export const RULE_BASED_GUIDES: Record<IssueCategory, RuleBasedGuide> = {
  [IssueCategory.material_shortage]: {
    category: IssueCategory.material_shortage,
    summary: "材料不足・欠品の汎用対応",
    steps: [
      "1. 当日納品可能な代替材を仕入先3社に問い合わせる",
      "2. 進められる別工程に着手して工程止めを回避する",
      "3. 施主に進捗影響を15分以内に報告する",
    ],
  },
  [IssueCategory.weather_delay]: {
    category: IssueCategory.weather_delay,
    summary: "天候不良による工程遅延の汎用対応",
    steps: [
      "1. 気象情報を確認し、作業可否を現場責任者が判断する",
      "2. 屋内工程・仕上げ確認・書類整理など雨天対応作業に切り替える",
      "3. 工程表を更新し、関係者全員に遅延情報を共有する",
    ],
  },
  [IssueCategory.tool_breakdown]: {
    category: IssueCategory.tool_breakdown,
    summary: "機器故障・使用不能の汎用対応",
    steps: [
      "1. 故障内容を写真付きで記録し、レンタル業者に代替機を手配する",
      "2. 故障機器を使わない工程を先行して進める",
      "3. 修理・交換コストを見積もり、現場責任者に報告する",
    ],
  },
  [IssueCategory.coordination]: {
    category: IssueCategory.coordination,
    summary: "情報伝達・調整不足の汎用対応",
    steps: [
      "1. 関係者全員を集め、現状認識を5分でそろえるブリーフィングを実施する",
      "2. 作業指示をテキスト化してチャットまたは掲示板で共有する",
      "3. 次の確認タイミング（日時）を明確に決めてチーム全員に周知する",
    ],
  },
  [IssueCategory.safety_concern]: {
    category: IssueCategory.safety_concern,
    summary: "安全懸念・ヒヤリハットの汎用対応",
    steps: [
      "1. 危険箇所を即時立入禁止にし、関係者に周知する",
      "2. ヒヤリハット記録票に状況・原因・対策を記入する",
      "3. 翌朝のKYミーティングで全員に展開し、再発防止策を徹底する",
    ],
  },
  [IssueCategory.quality_issue]: {
    category: IssueCategory.quality_issue,
    summary: "品質不具合・やり直しの汎用対応",
    steps: [
      "1. 不具合範囲を写真で記録し、原因（施工ミス/材料不良/設計違い）を特定する",
      "2. 補修かやり直しかを現場責任者と施主立会いで判断する",
      "3. 再発防止のため施工手順書を見直し、チェックポイントを追加する",
    ],
  },
  [IssueCategory.client_request]: {
    category: IssueCategory.client_request,
    summary: "施主要望・仕様変更の汎用対応",
    steps: [
      "1. 要望内容を書面（変更依頼書）に記録し、施主のサインをもらう",
      "2. 追加費用・工期への影響を24時間以内に概算して施主に提示する",
      "3. 合意後、工程表と見積書を更新して関係者全員に配布する",
    ],
  },
  [IssueCategory.other]: {
    category: IssueCategory.other,
    summary: "その他の現場課題の汎用対応",
    steps: [
      "1. 課題の内容・場所・影響範囲を具体的に書き出す",
      "2. 現場責任者に状況を報告し、対応方針を決める",
      "3. 決定した対応策を実行し、結果を記録・関係者に共有する",
    ],
  },
};
