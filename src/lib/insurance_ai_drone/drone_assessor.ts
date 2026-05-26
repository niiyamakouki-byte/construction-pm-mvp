/**
 * ドローン3D被害判定エンジン
 * Sprint 60-C: 工事保険AI査定 + ドローン現場検証
 *
 * 入力: ドローン写真複数枚 (SfM想定、位置・姿勢メタ付き)
 * 出力: 3D点群サマリ(モック)、被害領域マスク座標、被害金額自動算出
 *
 * NOTE: SfM写真測量は外部依存にせず、メタデータのみで体積/面積を概算するモック実装
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type DronePhotoMeta = {
  /** 写真URL */
  url: string;
  /** 撮影位置 (WGS84) */
  gps?: {
    lat: number;
    lng: number;
    altitudeM: number;
  };
  /** カメラ姿勢 (度) */
  orientation?: {
    pitchDeg: number;
    rollDeg: number;
    yawDeg: number;
  };
  /** 撮影高度 (m) */
  flightAltitudeM?: number;
  /** 地上サンプリング距離 (cm/pixel) */
  gsdCmPerPixel?: number;
};

export type Point3D = {
  x: number;
  y: number;
  z: number;
};

export type PointCloudSummary = {
  /** 推定点群数 */
  estimatedPointCount: number;
  /** バウンディングボックス (m) */
  boundingBox: {
    widthM: number;
    heightM: number;
    depthM: number;
  };
  /** 推定体積 (m³) */
  estimatedVolumeM3: number;
  /** 推定面積 (m²) */
  estimatedAreaM2: number;
  /** 点群密度 (points/m²) */
  pointDensity: number;
};

export type DamageMask = {
  /** 被害領域の矩形座標 (正規化 0.0〜1.0) */
  regions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    /** 被害確信度 0.0〜1.0 */
    confidence: number;
    /** 被害面積推定 (m²) */
    estimatedAreaM2: number;
  }>;
  /** 全体の被害率 0.0〜1.0 */
  overallDamageRatio: number;
};

export type DroneAssessmentResult = {
  /** 3D点群サマリ */
  pointCloudSummary: PointCloudSummary;
  /** 被害領域マスク */
  damageMask: DamageMask;
  /** 被害金額自動算出 (円) */
  estimatedDamageJpy: number;
  /** 査定信頼度 0.0〜1.0 */
  confidenceScore: number;
  /** 処理メモ */
  processingNotes: string[];
};

// ── Internal helpers ───────────────────────────────────────────────────────

/** GSD(cm/px)と写真枚数から撮影面積を推定 */
function estimateCoverageAreaM2(photos: DronePhotoMeta[]): number {
  const photosWithGsd = photos.filter((p) => p.gsdCmPerPixel !== undefined);
  if (photosWithGsd.length === 0) {
    // フォールバック: 高度から推定
    const avgAltitude = photos.reduce((s, p) => s + (p.flightAltitudeM ?? 30), 0) / photos.length;
    // 典型的なドローンカメラ(FOV 84°)での地上投影面積: altitude²  × tan²(42°) × 4
    const groundCoverage = avgAltitude * avgAltitude * 4 * Math.tan((42 * Math.PI) / 180) ** 2;
    return groundCoverage * photos.length * 0.6; // 60%オーバーラップ想定
  }

  const avgGsd = photosWithGsd.reduce((s, p) => s + (p.gsdCmPerPixel ?? 1), 0) / photosWithGsd.length;
  // 典型的なドローン写真 4000×3000px
  const imgWidthM = (4000 * avgGsd) / 100;
  const imgHeightM = (3000 * avgGsd) / 100;
  return imgWidthM * imgHeightM * photos.length * 0.6;
}

/** 被害領域モックマスク生成 (写真枚数・撮影条件から統計的に生成) */
function generateDamageMask(photos: DronePhotoMeta[], coverageAreaM2: number): DamageMask {
  // 写真枚数が多いほど精度が上がり、検出領域が増える
  const regionCount = Math.min(Math.max(1, Math.floor(photos.length / 2)), 5);
  const damageRatioBase = 0.15 + (photos.length > 5 ? 0.1 : 0);

  const regions = Array.from({ length: regionCount }, (_, i) => {
    const x = 0.1 + (i * 0.18) % 0.7;
    const y = 0.1 + (i * 0.23) % 0.7;
    const w = 0.1 + (i * 0.05) % 0.25;
    const h = 0.08 + (i * 0.04) % 0.2;
    return {
      x,
      y,
      width: w,
      height: h,
      confidence: 0.55 + Math.min(photos.length / 20, 0.35),
      estimatedAreaM2: coverageAreaM2 * w * h * 2.5,
    };
  });

  const overallDamageRatio = Math.min(regionCount * 0.06 + damageRatioBase, 0.8);

  return { regions, overallDamageRatio };
}

/** 3D点群サマリのモック生成 */
function generatePointCloudSummary(photos: DronePhotoMeta[], coverageAreaM2: number): PointCloudSummary {
  const avgAltitude = photos.reduce((s, p) => s + (p.flightAltitudeM ?? 30), 0) / photos.length;
  const estimatedDepth = avgAltitude * 0.3; // 典型的な建物高さ推定

  const widthM = Math.sqrt(coverageAreaM2);
  const heightM = widthM;

  // 典型的SfM点群密度: 低解像度 50pts/m², 高解像度 500pts/m²
  const pointDensity = photos.length > 10 ? 300 : 80;

  return {
    estimatedPointCount: Math.floor(coverageAreaM2 * pointDensity),
    boundingBox: {
      widthM: Math.round(widthM * 10) / 10,
      heightM: Math.round(heightM * 10) / 10,
      depthM: Math.round(estimatedDepth * 10) / 10,
    },
    estimatedVolumeM3: Math.floor(widthM * heightM * estimatedDepth),
    estimatedAreaM2: Math.floor(coverageAreaM2),
    pointDensity,
  };
}

// ── assessDroneImages ──────────────────────────────────────────────────────

/**
 * ドローン画像から3D被害査定を実行
 *
 * @param photos ドローン写真メタデータ配列
 * @param damageUnitCostPerM2 損害単価(円/m²) デフォルト50,000円
 */
export function assessDroneImages(
  photos: DronePhotoMeta[],
  damageUnitCostPerM2 = 50_000,
): DroneAssessmentResult {
  const notes: string[] = [];

  if (photos.length === 0) {
    return {
      pointCloudSummary: {
        estimatedPointCount: 0,
        boundingBox: { widthM: 0, heightM: 0, depthM: 0 },
        estimatedVolumeM3: 0,
        estimatedAreaM2: 0,
        pointDensity: 0,
      },
      damageMask: { regions: [], overallDamageRatio: 0 },
      estimatedDamageJpy: 0,
      confidenceScore: 0,
      processingNotes: ["写真なし: 査定不能"],
    };
  }

  notes.push(`ドローン写真 ${photos.length}枚を処理`);

  const coverageAreaM2 = estimateCoverageAreaM2(photos);
  notes.push(`撮影面積推定: ${Math.floor(coverageAreaM2)}m²`);

  const pointCloudSummary = generatePointCloudSummary(photos, coverageAreaM2);
  notes.push(
    `点群推定: ${pointCloudSummary.estimatedPointCount.toLocaleString()}点 ` +
      `(${pointCloudSummary.pointDensity}pts/m²)`
  );

  const damageMask = generateDamageMask(photos, coverageAreaM2);
  const totalDamageAreaM2 = damageMask.regions.reduce((s, r) => s + r.estimatedAreaM2, 0);
  notes.push(
    `被害領域: ${damageMask.regions.length}箇所, ` +
      `総面積 ${Math.floor(totalDamageAreaM2)}m², ` +
      `被害率 ${(damageMask.overallDamageRatio * 100).toFixed(1)}%`
  );

  const estimatedDamageJpy = Math.floor(totalDamageAreaM2 * damageUnitCostPerM2);
  notes.push(`被害金額推定: ¥${estimatedDamageJpy.toLocaleString()}`);

  // 信頼度: 写真枚数 + GPS有無 + GSD有無
  const hasGps = photos.some((p) => p.gps !== undefined);
  const hasGsd = photos.some((p) => p.gsdCmPerPixel !== undefined);
  let confidence = Math.min(0.4 + photos.length * 0.04, 0.75);
  if (hasGps) confidence = Math.min(confidence + 0.1, 0.9);
  if (hasGsd) confidence = Math.min(confidence + 0.05, 0.95);

  return {
    pointCloudSummary,
    damageMask,
    estimatedDamageJpy,
    confidenceScore: Math.round(confidence * 100) / 100,
    processingNotes: notes,
  };
}
