/**
 * Interior Photo Classifier — 内装特化写真仕分けAI
 * 蔵衛門の1,500種→内装工事特化50分類に絞った版。
 * ファイル名・黒板テキスト・メタデータからカテゴリを推定する。
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type InteriorParentCategory =
  | "解体"
  | "下地"
  | "天井仕上"
  | "壁仕上"
  | "床仕上"
  | "建具"
  | "設備"
  | "家具"
  | "その他";

export type InteriorCategory =
  // 解体 (6)
  | "床撤去"
  | "壁撤去"
  | "天井撤去"
  | "建具撤去"
  | "設備撤去"
  | "廃材搬出"
  // 下地 (7)
  | "軽鉄下地"
  | "ボード貼り"
  | "GL工法"
  | "パテ処理"
  | "墨出し"
  | "開口補強"
  | "断熱材"
  // 天井仕上 (4)
  | "天井クロス"
  | "天井塗装"
  | "天井パネル"
  | "システム天井"
  // 壁仕上 (6)
  | "壁クロス"
  | "壁塗装"
  | "壁タイル"
  | "エコカラット"
  | "腰壁"
  | "壁パネル"
  // 床仕上 (6)
  | "フローリング"
  | "CF"
  | "タイルカーペット"
  | "長尺シート"
  | "石"
  | "畳"
  // 建具 (5)
  | "木製建具"
  | "アルミ建具"
  | "ガラス"
  | "パーティション"
  | "自動ドア"
  // 設備 (6)
  | "電気"
  | "照明"
  | "給排水"
  | "空調"
  | "防災"
  | "弱電"
  // 家具 (4)
  | "造作家具"
  | "キッチン"
  | "カウンター"
  | "収納"
  // その他 (6)
  | "養生"
  | "清掃"
  | "外装"
  | "足場"
  | "搬入搬出"
  | "完成写真";

export type InteriorCategoryDefinition = {
  name: InteriorCategory;
  parent: InteriorParentCategory;
  keywords: string[];
  icon: string;
};

export type InteriorClassificationResult = {
  category: InteriorCategory;
  confidence: number; // 0.0 – 1.0
};

export type CategorySuggestion = {
  category: InteriorCategory;
  confidence: number;
};

export type InteriorPhotoMetadata = {
  blackboardText?: string; // 黒板・小黒板の読み取りテキスト
  capturedAt?: string;
  exifData?: Record<string, unknown>;
};

// ── Category definitions ──────────────────────────────────────────────────────

export const INTERIOR_CATEGORIES: InteriorCategoryDefinition[] = [
  // 解体
  {
    name: "床撤去",
    parent: "解体",
    keywords: ["床撤去", "床解体", "床はがし", "床撤", "flooring removal", "floor demo"],
    icon: "🔨",
  },
  {
    name: "壁撤去",
    parent: "解体",
    keywords: ["壁撤去", "壁解体", "間仕切解体", "間仕切り撤去", "壁撤", "wall demo", "wall removal"],
    icon: "🔨",
  },
  {
    name: "天井撤去",
    parent: "解体",
    keywords: ["天井撤去", "天井解体", "天井撤", "ceiling demo", "ceiling removal"],
    icon: "🔨",
  },
  {
    name: "建具撤去",
    parent: "解体",
    keywords: ["建具撤去", "建具解体", "扉撤去", "ドア撤去", "door removal"],
    icon: "🔨",
  },
  {
    name: "設備撤去",
    parent: "解体",
    keywords: ["設備撤去", "設備解体", "配管撤去", "電気撤去", "equipment removal"],
    icon: "🔨",
  },
  {
    name: "廃材搬出",
    parent: "解体",
    keywords: ["廃材", "廃棄", "搬出", "ガレキ", "瓦礫", "debris", "waste removal", "廃材搬出"],
    icon: "🚛",
  },
  // 下地
  {
    name: "軽鉄下地",
    parent: "下地",
    keywords: ["軽鉄", "LGS", "スタッド", "ランナー", "軽量鉄骨", "metal stud", "軽天"],
    icon: "🔩",
  },
  {
    name: "ボード貼り",
    parent: "下地",
    keywords: ["ボード", "石膏ボード", "GB", "プラスターボード", "gypsum board", "drywall"],
    icon: "🔩",
  },
  {
    name: "GL工法",
    parent: "下地",
    keywords: ["GL工法", "GLボンド", "GL", "direct bond"],
    icon: "🔩",
  },
  {
    name: "パテ処理",
    parent: "下地",
    keywords: ["パテ", "パテ処理", "パテ打ち", "パテかい", "下塗り", "putty", "skim coat"],
    icon: "🔩",
  },
  {
    name: "墨出し",
    parent: "下地",
    keywords: ["墨出し", "墨出", "墨打ち", "レーザー墨出", "layout", "marking"],
    icon: "📐",
  },
  {
    name: "開口補強",
    parent: "下地",
    keywords: ["開口補強", "開口", "補強", "開口部", "opening reinforcement"],
    icon: "🔩",
  },
  {
    name: "断熱材",
    parent: "下地",
    keywords: ["断熱", "断熱材", "グラスウール", "ロックウール", "insulation", "thermal"],
    icon: "🏠",
  },
  // 天井仕上
  {
    name: "天井クロス",
    parent: "天井仕上",
    keywords: ["天井クロス", "天井壁紙", "ceiling wallpaper", "天井クロス貼"],
    icon: "🎨",
  },
  {
    name: "天井塗装",
    parent: "天井仕上",
    keywords: ["天井塗装", "天井ペンキ", "天井仕上", "ceiling paint", "ceiling finish"],
    icon: "🎨",
  },
  {
    name: "天井パネル",
    parent: "天井仕上",
    keywords: ["天井パネル", "天井板", "化粧板", "天井板張", "ceiling panel"],
    icon: "🎨",
  },
  {
    name: "システム天井",
    parent: "天井仕上",
    keywords: ["システム天井", "グリッド天井", "OA天井", "岩綿吸音板", "mineral ceiling", "grid ceiling"],
    icon: "🏗️",
  },
  // 壁仕上
  {
    name: "壁クロス",
    parent: "壁仕上",
    keywords: ["壁クロス", "壁紙", "クロス貼", "クロス張", "wallpaper", "wall paper", "クロス施工"],
    icon: "🎨",
  },
  {
    name: "壁塗装",
    parent: "壁仕上",
    keywords: ["壁塗装", "壁ペンキ", "塗装仕上", "wall paint", "painting"],
    icon: "🎨",
  },
  {
    name: "壁タイル",
    parent: "壁仕上",
    keywords: ["壁タイル", "タイル貼", "タイル張", "wall tile", "tile"],
    icon: "🎨",
  },
  {
    name: "エコカラット",
    parent: "壁仕上",
    keywords: ["エコカラット", "ecocarat", "eco-carat", "ECOCARAT"],
    icon: "🎨",
  },
  {
    name: "腰壁",
    parent: "壁仕上",
    keywords: ["腰壁", "腰板", "ウェインスコット", "wainscot", "dado"],
    icon: "🎨",
  },
  {
    name: "壁パネル",
    parent: "壁仕上",
    keywords: ["壁パネル", "化粧パネル", "メラミンパネル", "wall panel", "melamine panel"],
    icon: "🎨",
  },
  // 床仕上
  {
    name: "フローリング",
    parent: "床仕上",
    keywords: ["フローリング", "木床", "無垢", "複合フローリング", "flooring", "hardwood", "parquet"],
    icon: "🪵",
  },
  {
    name: "CF",
    parent: "床仕上",
    keywords: ["CF", "クッションフロア", "cushion floor", "vinyl floor", "ビニル床"],
    icon: "🪵",
  },
  {
    name: "タイルカーペット",
    parent: "床仕上",
    keywords: ["タイルカーペット", "カーペット", "carpet", "tile carpet"],
    icon: "🪵",
  },
  {
    name: "長尺シート",
    parent: "床仕上",
    keywords: ["長尺シート", "長尺", "long sheet", "vinyl sheet", "塩ビシート"],
    icon: "🪵",
  },
  {
    name: "石",
    parent: "床仕上",
    keywords: ["大理石", "御影石", "石貼", "石張", "stone", "marble", "granite", "天然石"],
    icon: "🪨",
  },
  {
    name: "畳",
    parent: "床仕上",
    keywords: ["畳", "たたみ", "tatami", "琉球畳"],
    icon: "🟩",
  },
  // 建具
  {
    name: "木製建具",
    parent: "建具",
    keywords: ["木製建具", "木製ドア", "フラッシュ戸", "木扉", "wooden door"],
    icon: "🚪",
  },
  {
    name: "アルミ建具",
    parent: "建具",
    keywords: ["アルミ建具", "アルミサッシ", "アルミドア", "aluminum door", "aluminium"],
    icon: "🚪",
  },
  {
    name: "ガラス",
    parent: "建具",
    keywords: ["ガラス", "硝子", "FIX窓", "ガラス戸", "glass", "glazing"],
    icon: "🔲",
  },
  {
    name: "パーティション",
    parent: "建具",
    keywords: ["パーティション", "間仕切り", "可動間仕切", "partition"],
    icon: "🚪",
  },
  {
    name: "自動ドア",
    parent: "建具",
    keywords: ["自動ドア", "自動扉", "automatic door", "auto door", "センサードア"],
    icon: "🚪",
  },
  // 設備
  {
    name: "電気",
    parent: "設備",
    keywords: ["電気", "電線", "配線", "コンセント", "スイッチ", "electrical", "wiring", "conduit"],
    icon: "⚡",
  },
  {
    name: "照明",
    parent: "設備",
    keywords: ["照明", "ダウンライト", "シーリング", "LED", "lighting", "light", "ランプ"],
    icon: "💡",
  },
  {
    name: "給排水",
    parent: "設備",
    keywords: ["給水", "排水", "給排水", "配管", "pipe", "plumbing", "衛生"],
    icon: "🚰",
  },
  {
    name: "空調",
    parent: "設備",
    keywords: ["空調", "エアコン", "HVAC", "換気", "ダクト", "FCU", "air conditioning", "ventilation"],
    icon: "❄️",
  },
  {
    name: "防災",
    parent: "設備",
    keywords: ["防災", "スプリンクラー", "感知器", "消火", "fire", "sprinkler", "detector"],
    icon: "🔥",
  },
  {
    name: "弱電",
    parent: "設備",
    keywords: ["弱電", "LAN", "通信", "インターホン", "監視カメラ", "low voltage", "data", "network"],
    icon: "📡",
  },
  // 家具
  {
    name: "造作家具",
    parent: "家具",
    keywords: ["造作家具", "造作", "作り付け", "built-in", "custom furniture", "カスタム家具"],
    icon: "🪑",
  },
  {
    name: "キッチン",
    parent: "家具",
    keywords: ["キッチン", "台所", "システムキッチン", "kitchen", "シンク", "コンロ"],
    icon: "🍳",
  },
  {
    name: "カウンター",
    parent: "家具",
    keywords: ["カウンター", "counter", "受付", "reception counter", "バーカウンター"],
    icon: "🪑",
  },
  {
    name: "収納",
    parent: "家具",
    keywords: ["収納", "クローゼット", "押入", "棚", "storage", "closet", "shelf"],
    icon: "📦",
  },
  // その他
  {
    name: "養生",
    parent: "その他",
    keywords: ["養生", "シート養生", "ブルーシート", "保護", "protection sheet", "masking"],
    icon: "🛡️",
  },
  {
    name: "清掃",
    parent: "その他",
    keywords: ["清掃", "掃除", "クリーニング", "cleaning", "仕上清掃", "竣工清掃"],
    icon: "🧹",
  },
  {
    name: "外装",
    parent: "その他",
    keywords: ["外装", "外壁", "外観", "facade", "exterior", "外構"],
    icon: "🏢",
  },
  {
    name: "足場",
    parent: "その他",
    keywords: ["足場", "仮設足場", "scaffolding", "scaffold"],
    icon: "🏗️",
  },
  {
    name: "搬入搬出",
    parent: "その他",
    keywords: ["搬入", "搬出", "資材搬入", "材料搬入", "delivery", "transport", "荷受", "荷降"],
    icon: "🚛",
  },
  {
    name: "完成写真",
    parent: "その他",
    keywords: ["完成", "竣工", "引渡", "完了", "仕上がり", "完成写真", "completion", "final"],
    icon: "📸",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(str: string): string {
  return str.toLowerCase().replace(/[\s_\-./]/g, "");
}

function scoreText(text: string, keywords: string[]): number {
  const normalized = normalize(text);
  let score = 0;
  for (const kw of keywords) {
    if (normalized.includes(normalize(kw))) {
      // 長いキーワードのマッチほど高スコア
      score += kw.length;
    }
  }
  return score;
}

function computeConfidence(score: number, maxScore: number): number {
  if (maxScore === 0) return 0;
  // シグモイド風に正規化: スコアが高いほど確信度が高い
  const ratio = score / maxScore;
  return Math.min(1.0, parseFloat(ratio.toFixed(2)));
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * classifyInteriorPhoto — ファイル名・メタデータから内装カテゴリを推定する。
 */
export function classifyInteriorPhoto(
  filename: string,
  metadata?: InteriorPhotoMetadata,
): InteriorClassificationResult {
  const text = [
    filename,
    metadata?.blackboardText ?? "",
    metadata?.capturedAt ?? "",
  ].join(" ");

  const suggestions = suggestCategory(text);
  if (suggestions.length === 0) {
    return { category: "完成写真", confidence: 0 };
  }
  return { category: suggestions[0].category, confidence: suggestions[0].confidence };
}

/**
 * suggestCategory — テキストからカテゴリ候補を確信度付きで返す（降順ソート）。
 */
export function suggestCategory(description: string): CategorySuggestion[] {
  const scores: Array<{ category: InteriorCategory; score: number }> = [];

  for (const def of INTERIOR_CATEGORIES) {
    const score = scoreText(description, def.keywords);
    if (score > 0) {
      scores.push({ category: def.name, score });
    }
  }

  if (scores.length === 0) return [];

  scores.sort((a, b) => b.score - a.score);
  const maxScore = scores[0].score;

  return scores.map(({ category, score }) => ({
    category,
    confidence: computeConfidence(score, maxScore),
  }));
}

/**
 * getCategoryHierarchy — 親カテゴリ→子カテゴリのツリーを返す。
 */
export function getCategoryHierarchy(): Record<InteriorParentCategory, InteriorCategoryDefinition[]> {
  const result = {} as Record<InteriorParentCategory, InteriorCategoryDefinition[]>;

  for (const def of INTERIOR_CATEGORIES) {
    if (!result[def.parent]) {
      result[def.parent] = [];
    }
    result[def.parent].push(def);
  }

  return result;
}
