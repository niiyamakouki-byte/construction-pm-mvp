/**
 * diagnosis-form-builder — チェックポイント別診断フォームテンプレートを生成する。
 *
 * Sprint 19-A: 5年/10年フォローオート
 */

import type {
  FollowupCheckpoint,
  DiagnosisForm,
  DiagnosisFormId,
  DiagnosisQuestion,
  CheckpointKind,
  DegradationCategory,
} from "./types.js";
import { makeDiagnosisFormId } from "./types.js";

// ── Counter ────────────────────────────────────────────────────────────────

let _formCounter = 0;

export function _resetFormCounter(): void {
  _formCounter = 0;
}

function newFormId(): DiagnosisFormId {
  return makeDiagnosisFormId(`form-${Date.now()}-${++_formCounter}`);
}

// ── Question templates per kind ────────────────────────────────────────────

function makeQuestion(
  id: string,
  questionJa: string,
  category: DegradationCategory,
): DiagnosisQuestion {
  return { id, questionJa, category, scale: 5 };
}

const THREE_MONTH_QUESTIONS: DiagnosisQuestion[] = [
  makeQuestion("q3m-01", "建具（ドア・窓）の開閉はスムーズですか？（1=問題なし, 5=引っかかる）", "fixtures"),
  makeQuestion("q3m-02", "水回り（台所・洗面・浴室）から水漏れはありますか？（1=なし, 5=あり）", "piping"),
  makeQuestion("q3m-03", "施工時の傷や仕上げの不具合はありますか？（1=なし, 5=あり）", "interior_finish"),
  makeQuestion("q3m-04", "床・壁・天井のきしみや異音がありますか？（1=なし, 5=あり）", "structural"),
  makeQuestion("q3m-05", "換気扇・空調の動作は正常ですか？（1=問題なし, 5=問題あり）", "hvac"),
  makeQuestion("q3m-06", "外壁・外構に施工時の傷がありますか？（1=なし, 5=あり）", "exterior_wall"),
  makeQuestion("q3m-07", "配管からの異臭や異音はありますか？（1=なし, 5=あり）", "piping"),
  makeQuestion("q3m-08", "設備機器（給湯器・食洗機など）は正常に動作していますか？（1=問題なし, 5=問題あり）", "fixtures"),
];

const ONE_YEAR_QUESTIONS: DiagnosisQuestion[] = [
  makeQuestion("q1y-01", "内装（壁紙・床材）のひびや浮きがありますか？（1=なし, 5=あり）", "interior_finish"),
  makeQuestion("q1y-02", "窓周辺や壁に結露・カビが発生していますか？（1=なし, 5=あり）", "waterproofing"),
  makeQuestion("q1y-03", "騒音・振動が気になることがありますか？（1=なし, 5=あり）", "structural"),
  makeQuestion("q1y-04", "外壁の色褪せや汚れが目立ちますか？（1=なし, 5=あり）", "exterior_wall"),
  makeQuestion("q1y-05", "屋根・軒天に損傷や剥がれはありますか？（1=なし, 5=あり）", "roof"),
  makeQuestion("q1y-06", "水回りの排水が遅くなっていませんか？（1=問題なし, 5=問題あり）", "piping"),
  makeQuestion("q1y-07", "空調・換気システムの効き目が落ちた気がしますか？（1=問題なし, 5=問題あり）", "hvac"),
  makeQuestion("q1y-08", "バルコニー・テラスに水たまりができますか？（1=なし, 5=あり）", "waterproofing"),
  makeQuestion("q1y-09", "建具の調整（高さ・傾き）が必要な箇所はありますか？（1=なし, 5=あり）", "fixtures"),
  makeQuestion("q1y-10", "電気設備（コンセント・スイッチ）に不具合はありますか？（1=なし, 5=あり）", "fixtures"),
];

const THREE_YEAR_QUESTIONS: DiagnosisQuestion[] = [
  makeQuestion("q3y-01", "外壁にチョーキング（白い粉）が出ていますか？（1=なし, 5=あり）", "exterior_wall"),
  makeQuestion("q3y-02", "コーキング（シーリング）にひびや剥がれはありますか？（1=なし, 5=あり）", "exterior_wall"),
  makeQuestion("q3y-03", "設備機器の動作は問題ありませんか？（1=問題なし, 5=問題あり）", "fixtures"),
  makeQuestion("q3y-04", "内装（壁・床）の傷みが目立ちますか？（1=なし, 5=あり）", "interior_finish"),
  makeQuestion("q3y-05", "屋根瓦・スレートにずれや欠けはありますか？（1=なし, 5=あり）", "roof"),
  makeQuestion("q3y-06", "バルコニーの防水層に亀裂や浮きはありますか？（1=なし, 5=あり）", "waterproofing"),
  makeQuestion("q3y-07", "排水管の詰まりや流れの悪さはありますか？（1=なし, 5=あり）", "piping"),
  makeQuestion("q3y-08", "空調機のフィルターは定期清掃していますか？（1=している, 5=していない）", "hvac"),
  makeQuestion("q3y-09", "外部木部（フェンス・デッキ）の腐食はありますか？（1=なし, 5=あり）", "exterior_wall"),
  makeQuestion("q3y-10", "給湯器・水栓金具の錆びや水漏れはありますか？（1=なし, 5=あり）", "piping"),
  makeQuestion("q3y-11", "床下点検口から異臭や湿気はありますか？（1=なし, 5=あり）", "structural"),
];

const FIVE_YEAR_QUESTIONS: DiagnosisQuestion[] = [
  makeQuestion("q5y-01", "屋根全体の塗装や防水は劣化していますか？（1=問題なし, 5=劣化あり）", "roof"),
  makeQuestion("q5y-02", "外壁塗装の剥がれや色褪せが著しいですか？（1=なし, 5=著しい）", "exterior_wall"),
  makeQuestion("q5y-03", "ベランダ・バルコニーの防水が怪しい箇所はありますか？（1=なし, 5=あり）", "waterproofing"),
  makeQuestion("q5y-04", "サビが出ている箇所（鉄部・手すりなど）はありますか？（1=なし, 5=あり）", "exterior_wall"),
  makeQuestion("q5y-05", "シロアリの被害や床下の湿害の兆候はありますか？（1=なし, 5=あり）", "structural"),
  makeQuestion("q5y-06", "給排水管の老朽化が気になりますか？（1=気にならない, 5=気になる）", "piping"),
  makeQuestion("q5y-07", "空調機の効率が落ちていますか？（1=問題なし, 5=効率低下）", "hvac"),
  makeQuestion("q5y-08", "建具（玄関ドア・引き戸）の開閉に問題はありますか？（1=なし, 5=あり）", "fixtures"),
  makeQuestion("q5y-09", "壁・天井の塗装にひびや剥がれはありますか？（1=なし, 5=あり）", "interior_finish"),
  makeQuestion("q5y-10", "屋根・外壁コーキングの全面打ち替えを検討していますか？（1=不要, 5=必要）", "exterior_wall"),
  makeQuestion("q5y-11", "雨どいの詰まりや変形はありますか？（1=なし, 5=あり）", "roof"),
  makeQuestion("q5y-12", "床の沈みや軋みが増えていますか？（1=なし, 5=増えた）", "structural"),
];

const TEN_YEAR_QUESTIONS: DiagnosisQuestion[] = [
  makeQuestion("q10y-01", "構造体（柱・梁・基礎）に問題の兆候はありますか？（1=なし, 5=あり）", "structural"),
  makeQuestion("q10y-02", "外壁全体の劣化度合いはいかがですか？（1=良好, 5=著しく劣化）", "exterior_wall"),
  makeQuestion("q10y-03", "屋根の全面葺き替えや大規模修繕を検討していますか？（1=不要, 5=必要）", "roof"),
  makeQuestion("q10y-04", "防水工事（バルコニー・屋上）の全面やり直しが必要と感じますか？（1=不要, 5=必要）", "waterproofing"),
  makeQuestion("q10y-05", "給排水管の全面更新を検討していますか？（1=不要, 5=必要）", "piping"),
  makeQuestion("q10y-06", "空調・換気設備の全交換を検討していますか？（1=不要, 5=必要）", "hvac"),
  makeQuestion("q10y-07", "設備機器（給湯器・コンロ等）の老朽化が著しいですか？（1=なし, 5=著しい）", "fixtures"),
  makeQuestion("q10y-08", "内装（床・壁・天井）のリフォームを希望していますか？（1=不要, 5=希望する）", "interior_finish"),
  makeQuestion("q10y-09", "シロアリ・湿害の徹底的な対処が必要ですか？（1=不要, 5=必要）", "structural"),
  makeQuestion("q10y-10", "間取り変更や大規模リフォームを検討していますか？（1=不要, 5=検討中）", "structural"),
  makeQuestion("q10y-11", "断熱・気密の改善を希望していますか？（1=不要, 5=希望する）", "exterior_wall"),
  makeQuestion("q10y-12", "バリアフリー化や段差解消工事を検討していますか？（1=不要, 5=検討中）", "interior_finish"),
  makeQuestion("q10y-13", "太陽光・蓄電池・ZEH化などのエコ改修を検討していますか？（1=不要, 5=検討中）", "hvac"),
  makeQuestion("q10y-14", "外構・庭のリニューアルを検討していますか？（1=不要, 5=検討中）", "exterior_wall"),
  makeQuestion("q10y-15", "全体的にどの程度リフォームが必要と感じていますか？（1=不要, 5=大規模必要）", "structural"),
];

const QUESTIONS_BY_KIND: Record<CheckpointKind, DiagnosisQuestion[]> = {
  three_month: THREE_MONTH_QUESTIONS,
  one_year: ONE_YEAR_QUESTIONS,
  three_year: THREE_YEAR_QUESTIONS,
  five_year: FIVE_YEAR_QUESTIONS,
  ten_year: TEN_YEAR_QUESTIONS,
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * チェックポイントに対応した診断フォームを生成する。
 */
export function buildFormForCheckpoint(
  checkpoint: FollowupCheckpoint,
  now = new Date(),
): DiagnosisForm {
  const questions = QUESTIONS_BY_KIND[checkpoint.kind];

  return {
    id: newFormId(),
    checkpointId: checkpoint.id,
    kind: checkpoint.kind,
    questions,
    createdAt: now.toISOString(),
  };
}

/**
 * 特定の CheckpointKind の質問数を返す。
 */
export function getQuestionCountForKind(kind: CheckpointKind): number {
  return QUESTIONS_BY_KIND[kind].length;
}
