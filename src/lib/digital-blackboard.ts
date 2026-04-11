/**
 * Digital blackboard compositing logic for construction site photos.
 * Renders a blackboard overlay onto a canvas with project metadata.
 */

export type BlackboardData = {
  projectName: string;
  shootDate: string; // YYYY-MM-DD
  workType: string;
  location: string;
  condition: string;
};

export type BlackboardTemplate = {
  id: string;
  projectName: string;
  workType: string;
};

const BLACKBOARD_WIDTH_RATIO = 0.38;
const BLACKBOARD_HEIGHT_RATIO = 0.28;
const PADDING = 10;
const LINE_HEIGHT = 18;

/**
 * Draw the blackboard overlay onto an existing canvas context.
 * Blackboard is placed at the bottom-left of the canvas.
 */
export function drawBlackboard(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  data: BlackboardData
): void {
  const bw = Math.round(canvasWidth * BLACKBOARD_WIDTH_RATIO);
  const bh = Math.round(canvasHeight * BLACKBOARD_HEIGHT_RATIO);
  const bx = PADDING;
  const by = canvasHeight - bh - PADDING;

  // Board background
  ctx.fillStyle = "rgba(10, 40, 10, 0.88)";
  ctx.strokeStyle = "#f5c842";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 6);
  ctx.fill();
  ctx.stroke();

  // Text settings
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";

  const titleFontSize = Math.max(10, Math.round(bh * 0.14));
  const bodyFontSize = Math.max(9, Math.round(bh * 0.11));

  // Title row
  ctx.font = `bold ${titleFontSize}px sans-serif`;
  ctx.fillStyle = "#f5c842";
  drawTextClipped(ctx, "■ 電子黒板", bx + PADDING, by + PADDING, bw - PADDING * 2);

  const rows: [string, string][] = [
    ["工事名", data.projectName],
    ["撮影日", data.shootDate],
    ["工　種", data.workType],
    ["部　位", data.location],
    ["状　況", data.condition],
  ];

  ctx.font = `${bodyFontSize}px sans-serif`;
  let rowY = by + PADDING + titleFontSize + 4;
  const labelWidth = Math.round(bw * 0.28);

  for (const [label, value] of rows) {
    // Divider
    ctx.strokeStyle = "rgba(245,200,66,0.3)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(bx + PADDING, rowY);
    ctx.lineTo(bx + bw - PADDING, rowY);
    ctx.stroke();

    ctx.fillStyle = "#aad4aa";
    drawTextClipped(ctx, label, bx + PADDING, rowY + 2, labelWidth);

    ctx.fillStyle = "#ffffff";
    drawTextClipped(ctx, value, bx + PADDING + labelWidth + 4, rowY + 2, bw - PADDING * 2 - labelWidth - 4);

    rowY += LINE_HEIGHT;
    if (rowY + LINE_HEIGHT > by + bh - PADDING) break;
  }
}

function drawTextClipped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
): void {
  if (maxWidth <= 0) return;
  let t = text;
  while (t.length > 0 && ctx.measureText(t).width > maxWidth) {
    t = t.slice(0, -1);
  }
  ctx.fillText(t, x, y);
}

/**
 * Composite a photo (HTMLImageElement) with a blackboard overlay onto a new canvas.
 * Returns the canvas element.
 */
export function compositeBlackboard(
  image: HTMLImageElement,
  data: BlackboardData
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(image, 0, 0);
  drawBlackboard(ctx, canvas.width, canvas.height, data);

  return canvas;
}

/**
 * Download a canvas as a JPEG file.
 */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  const url = canvas.toDataURL("image/jpeg", 0.92);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

// ── Interior-specific template definitions ────────────────────────────────

export type InteriorTemplate = {
  id: string;
  category: string;
  workType: string;
  shootPoints: string[]; // 着工前 / 施工中 / 完了
  requiredFields: string[];
};

export const INTERIOR_TEMPLATES: InteriorTemplate[] = [
  // 解体 (5)
  {
    id: "kaitai-yuka",
    category: "解体",
    workType: "床撤去",
    shootPoints: ["撤去前全景", "撤去中", "撤去完了・下地確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "撤去面積(㎡)"],
  },
  {
    id: "kaitai-kabe",
    category: "解体",
    workType: "壁撤去",
    shootPoints: ["撤去前全景", "撤去中", "撤去完了・躯体確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "撤去箇所"],
  },
  {
    id: "kaitai-tenjou",
    category: "解体",
    workType: "天井撤去",
    shootPoints: ["撤去前全景", "撤去中", "撤去完了・上部空間確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "撤去面積(㎡)"],
  },
  {
    id: "kaitai-tategu",
    category: "解体",
    workType: "建具撤去",
    shootPoints: ["撤去前", "撤去中", "撤去完了・開口確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "建具番号"],
  },
  {
    id: "kaitai-setubi",
    category: "解体",
    workType: "設備撤去",
    shootPoints: ["撤去前", "撤去中・養生状況", "撤去完了・管末処理"],
    requiredFields: ["工事名", "撮影日", "施工者", "設備種別"],
  },

  // 下地 (8)
  {
    id: "shitaji-keitetsu",
    category: "下地",
    workType: "軽鉄下地",
    shootPoints: ["墨出し確認", "ランナー・スタッド取付中", "下地完了・間隔確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "スタッド間隔(mm)"],
  },
  {
    id: "shitaji-board",
    category: "下地",
    workType: "ボード貼り",
    shootPoints: ["下地確認", "ボード貼り中", "ボード貼り完了・目地確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "ボード種別・厚み"],
  },
  {
    id: "shitaji-gl",
    category: "下地",
    workType: "GL工法",
    shootPoints: ["下地コンクリート確認", "GLボンド塗付中", "ボード貼り完了"],
    requiredFields: ["工事名", "撮影日", "施工者", "GLボンド品番"],
  },
  {
    id: "shitaji-pate",
    category: "下地",
    workType: "パテ処理",
    shootPoints: ["ビス頭・ジョイント確認", "パテ1回目塗布中", "パテ仕上・研磨完了"],
    requiredFields: ["工事名", "撮影日", "施工者", "パテ工程回数"],
  },
  {
    id: "shitaji-sumidashi",
    category: "下地",
    workType: "墨出し",
    shootPoints: ["基準墨確認", "各部位墨出し中", "墨出し完了全景"],
    requiredFields: ["工事名", "撮影日", "施工者", "基準レベル(GL+mm)"],
  },
  {
    id: "shitaji-kaiko",
    category: "下地",
    workType: "開口補強",
    shootPoints: ["開口位置確認", "補強材取付中", "補強完了・溶接確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "開口サイズ(W×H)"],
  },
  {
    id: "shitaji-bouship",
    category: "下地",
    workType: "防湿シート",
    shootPoints: ["下地確認", "シート敷設中", "シート敷設完了・重ね代確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "重ね代(mm)"],
  },
  {
    id: "shitaji-dannetsu",
    category: "下地",
    workType: "断熱材",
    shootPoints: ["下地確認", "断熱材充填中", "断熱材充填完了・欠損なし確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "断熱材種別・厚み"],
  },

  // 仕上 (10)
  {
    id: "shiage-cloth",
    category: "仕上",
    workType: "クロス仕上",
    shootPoints: ["下地確認", "クロス貼り中・柄合わせ", "クロス貼り完了全景"],
    requiredFields: ["工事名", "撮影日", "施工者", "クロス品番"],
  },
  {
    id: "shiage-paint",
    category: "仕上",
    workType: "塗装仕上",
    shootPoints: ["下地・養生確認", "塗装中(何回目か)", "塗装完了・色確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "塗料品番・色番号・工程回数"],
  },
  {
    id: "shiage-tile",
    category: "仕上",
    workType: "タイル仕上",
    shootPoints: ["下地確認", "タイル貼り中・目地割り確認", "タイル完了・目地詰め確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "タイル品番・目地色"],
  },
  {
    id: "shiage-flooring",
    category: "仕上",
    workType: "フローリング仕上",
    shootPoints: ["下地確認・レベル確認", "フローリング施工中", "フローリング完了・清掃後"],
    requiredFields: ["工事名", "撮影日", "施工者", "フローリング品番・施工方向"],
  },
  {
    id: "shiage-cf",
    category: "仕上",
    workType: "CF仕上",
    shootPoints: ["下地確認", "CF貼り中・接着剤確認", "CF完了・溶接棒処理確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "CF品番"],
  },
  {
    id: "shiage-carpet",
    category: "仕上",
    workType: "カーペット仕上",
    shootPoints: ["下地確認", "グリッパー取付・CF下貼り", "カーペット敷き完了"],
    requiredFields: ["工事名", "撮影日", "施工者", "カーペット品番・方向"],
  },
  {
    id: "shiage-sakan",
    category: "仕上",
    workType: "左官仕上",
    shootPoints: ["下地確認", "左官塗り中", "左官仕上完了・テクスチャ確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "材料品番・テクスチャ種別"],
  },
  {
    id: "shiage-nagajaku",
    category: "仕上",
    workType: "長尺シート仕上",
    shootPoints: ["下地確認・レベル確認", "シート敷設中", "シート完了・溶接棒処理確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "シート品番"],
  },
  {
    id: "shiage-stone",
    category: "仕上",
    workType: "石貼り仕上",
    shootPoints: ["下地確認", "石貼り中・目地割り", "石貼り完了・目地・研磨確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "石材品番・目地幅"],
  },
  {
    id: "shiage-mortar",
    category: "仕上",
    workType: "モルタル仕上",
    shootPoints: ["下地確認", "モルタル塗り中", "モルタル仕上完了・養生状況"],
    requiredFields: ["工事名", "撮影日", "施工者", "モルタル配合・厚み"],
  },

  // 建具 (5)
  {
    id: "tategu-wood",
    category: "建具",
    workType: "木製建具",
    shootPoints: ["開口確認・枠取付", "扉取付中", "建具完了・動作確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "建具番号・品番"],
  },
  {
    id: "tategu-alum",
    category: "建具",
    workType: "アルミ建具",
    shootPoints: ["開口確認", "枠・建具取付中", "建具完了・気密確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "建具番号・品番"],
  },
  {
    id: "tategu-auto",
    category: "建具",
    workType: "自動ドア",
    shootPoints: ["開口確認・基礎確認", "センサー・駆動部取付中", "自動ドア完了・動作確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "メーカー・型番"],
  },
  {
    id: "tategu-glass",
    category: "建具",
    workType: "ガラス工事",
    shootPoints: ["開口確認・サッシ取付", "ガラス搬入・はめ込み中", "ガラス完了・シーリング確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "ガラス種別・厚み"],
  },
  {
    id: "tategu-partition",
    category: "建具",
    workType: "パーティション",
    shootPoints: ["墨出し確認", "パーティション組立中", "パーティション完了・水平垂直確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "メーカー・品番"],
  },

  // 設備 (8)
  {
    id: "setubi-denwiring",
    category: "設備",
    workType: "電気配線",
    shootPoints: ["ルート確認", "配線施工中・管路確認", "配線完了・接続確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "回路番号・電線種別"],
  },
  {
    id: "setubi-light",
    category: "設備",
    workType: "照明器具取付",
    shootPoints: ["器具位置確認", "取付中・配線接続", "取付完了・点灯確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "器具型番・回路番号"],
  },
  {
    id: "setubi-outlet",
    category: "設備",
    workType: "コンセント取付",
    shootPoints: ["ボックス位置確認", "配線接続中", "取付完了・絶縁測定値"],
    requiredFields: ["工事名", "撮影日", "施工者", "回路番号・高さGL+mm"],
  },
  {
    id: "setubi-switch",
    category: "設備",
    workType: "スイッチ取付",
    shootPoints: ["ボックス位置確認", "配線接続中", "取付完了・動作確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "スイッチ種別・高さGL+mm"],
  },
  {
    id: "setubi-kyhousui",
    category: "設備",
    workType: "給排水工事",
    shootPoints: ["配管ルート確認", "配管施工中・勾配確認", "配管完了・水圧テスト"],
    requiredFields: ["工事名", "撮影日", "施工者", "配管種別・口径"],
  },
  {
    id: "setubi-aircon",
    category: "設備",
    workType: "空調工事",
    shootPoints: ["機器位置確認", "冷媒配管・ダクト施工中", "試運転・風量確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "機器型番・冷媒種別"],
  },
  {
    id: "setubi-bousai",
    category: "設備",
    workType: "防災設備",
    shootPoints: ["機器位置確認", "取付中・配線確認", "取付完了・作動確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "機器種別・型番"],
  },
  {
    id: "setubi-jakuden",
    category: "設備",
    workType: "弱電設備",
    shootPoints: ["ルート確認", "配線施工中・端末取付", "完了・疎通確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "システム種別・回線番号"],
  },

  // 外装 (5)
  {
    id: "gaiso-gaihekitoso",
    category: "外装",
    workType: "外壁塗装",
    shootPoints: ["外壁下地・養生確認", "塗装中(工程確認)", "塗装完了・仕上り確認"],
    requiredFields: ["工事名", "撮影日", "天気", "施工者", "塗料品番・色番号"],
  },
  {
    id: "gaiso-bousui",
    category: "外装",
    workType: "防水工事",
    shootPoints: ["下地確認・プライマー確認", "防水材施工中", "防水完了・水張り試験"],
    requiredFields: ["工事名", "撮影日", "天気", "施工者", "防水種別・保証年数"],
  },
  {
    id: "gaiso-sealing",
    category: "外装",
    workType: "シーリング工事",
    shootPoints: ["目地確認・マスキング", "シーリング充填中", "仕上完了・ヘラ押え確認"],
    requiredFields: ["工事名", "撮影日", "天気", "施工者", "シーリング品番・色"],
  },
  {
    id: "gaiso-yane",
    category: "外装",
    workType: "屋根工事",
    shootPoints: ["既存屋根確認", "施工中", "完了・棟・雨仕舞確認"],
    requiredFields: ["工事名", "撮影日", "天気", "施工者", "材料品番"],
  },
  {
    id: "gaiso-amadoi",
    category: "外装",
    workType: "雨樋工事",
    shootPoints: ["取付位置確認", "取付中・勾配確認", "完了・通水確認"],
    requiredFields: ["工事名", "撮影日", "天気", "施工者", "雨樋種別・サイズ"],
  },

  // 家具 (4)
  {
    id: "kagu-zosaku",
    category: "家具",
    workType: "造作家具",
    shootPoints: ["墨出し・下地確認", "組立中", "完了・扉・引き出し動作確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "家具名称・材料品番"],
  },
  {
    id: "kagu-kitchen",
    category: "家具",
    workType: "キッチン工事",
    shootPoints: ["給排水・電気確認", "キャビネット設置中", "完了・水平・扉調整確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "メーカー・型番・カラー"],
  },
  {
    id: "kagu-counter",
    category: "家具",
    workType: "カウンター工事",
    shootPoints: ["下地確認・墨出し", "天板取付中", "完了・シーリング処理確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "天板材・品番"],
  },
  {
    id: "kagu-tana",
    category: "家具",
    workType: "棚工事",
    shootPoints: ["下地確認", "棚板取付中・水平確認", "完了・荷重確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "棚材・品番・耐荷重"],
  },

  // その他 (5)
  {
    id: "other-yojo",
    category: "その他",
    workType: "養生",
    shootPoints: ["養生前の床・壁状態", "養生施工中", "養生完了全景"],
    requiredFields: ["工事名", "撮影日", "施工者", "養生材種別・範囲"],
  },
  {
    id: "other-seiso",
    category: "その他",
    workType: "清掃",
    shootPoints: ["清掃前", "清掃中", "清掃完了・仕上り確認"],
    requiredFields: ["工事名", "撮影日", "施工者", "清掃範囲"],
  },
  {
    id: "other-kensa",
    category: "その他",
    workType: "検査",
    shootPoints: ["検査前全景", "検査中・指摘箇所", "指摘是正完了"],
    requiredFields: ["工事名", "撮影日", "施工者", "検査種別・検査員"],
  },
  {
    id: "other-hanshutu",
    category: "その他",
    workType: "搬出",
    shootPoints: ["搬出前・数量確認", "搬出中・養生確認", "搬出完了・清掃後"],
    requiredFields: ["工事名", "撮影日", "施工者", "搬出品目・数量"],
  },
  {
    id: "other-hikiwatashi",
    category: "その他",
    workType: "引渡し",
    shootPoints: ["引渡し前全景", "取扱説明中", "引渡し書類・鍵渡し"],
    requiredFields: ["工事名", "撮影日", "施工者", "引渡し先担当者名"],
  },
];

/**
 * Get all templates belonging to the specified category.
 */
export function getTemplatesByCategory(category: string): InteriorTemplate[] {
  return INTERIOR_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Return the total number of built-in interior templates.
 */
export function getTemplateCount(): number {
  return INTERIOR_TEMPLATES.length;
}

// ── Persist templates to localStorage ────────────────────────────────────
const STORAGE_KEY = "blackboard_templates";

export function loadTemplates(): BlackboardTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BlackboardTemplate[];
  } catch {
    return [];
  }
}

export function saveTemplate(tpl: BlackboardTemplate): void {
  const templates = loadTemplates().filter((t) => t.id !== tpl.id);
  templates.unshift(tpl);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.slice(0, 20)));
}

export function deleteTemplate(id: string): void {
  const templates = loadTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}
