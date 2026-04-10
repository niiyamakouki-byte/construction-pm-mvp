/**
 * 工程表タスクカテゴリマスター - 大項目/中項目/小項目の3階層管理
 */

export type TaskCategory = {
  id: string;
  major: string; // 大項目: 電気工事
  middle: string; // 中項目: 荒配線
  minor?: string; // 小項目: 天井内配線
  costMasterCode?: string; // cost-master連携コード
};

export const TASK_CATEGORIES: TaskCategory[] = [
  // 仮設工事
  { id: "temp-001", major: "仮設工事", middle: "仮囲い", costMasterCode: "TEMP-01" },
  { id: "temp-002", major: "仮設工事", middle: "足場", minor: "外部足場", costMasterCode: "TEMP-02" },
  { id: "temp-003", major: "仮設工事", middle: "足場", minor: "内部足場", costMasterCode: "TEMP-02" },
  { id: "temp-004", major: "仮設工事", middle: "養生", minor: "床養生", costMasterCode: "TEMP-03" },
  { id: "temp-005", major: "仮設工事", middle: "養生", minor: "壁養生", costMasterCode: "TEMP-03" },
  { id: "temp-006", major: "仮設工事", middle: "仮設電気", costMasterCode: "TEMP-04" },
  { id: "temp-007", major: "仮設工事", middle: "仮設水道", costMasterCode: "TEMP-05" },
  { id: "temp-008", major: "仮設工事", middle: "仮設トイレ", costMasterCode: "TEMP-06" },

  // 解体工事
  { id: "demo-001", major: "解体工事", middle: "内装解体", minor: "床材撤去", costMasterCode: "DEMO-01" },
  { id: "demo-002", major: "解体工事", middle: "内装解体", minor: "壁材撤去", costMasterCode: "DEMO-01" },
  { id: "demo-003", major: "解体工事", middle: "間仕切撤去", costMasterCode: "DEMO-02" },
  { id: "demo-004", major: "解体工事", middle: "床撤去", minor: "フローリング撤去", costMasterCode: "DEMO-03" },
  { id: "demo-005", major: "解体工事", middle: "床撤去", minor: "タイル撤去", costMasterCode: "DEMO-03" },
  { id: "demo-006", major: "解体工事", middle: "天井撤去", costMasterCode: "DEMO-04" },
  { id: "demo-007", major: "解体工事", middle: "設備撤去", minor: "電気設備撤去", costMasterCode: "DEMO-05" },
  { id: "demo-008", major: "解体工事", middle: "設備撤去", minor: "給排水設備撤去", costMasterCode: "DEMO-05" },
  { id: "demo-009", major: "解体工事", middle: "搬出処分", costMasterCode: "DEMO-06" },

  // 躯体・下地
  { id: "struc-001", major: "躯体・下地", middle: "LGS間仕切", minor: "ランナー取付", costMasterCode: "STRUC-01" },
  { id: "struc-002", major: "躯体・下地", middle: "LGS間仕切", minor: "スタッド取付", costMasterCode: "STRUC-01" },
  { id: "struc-003", major: "躯体・下地", middle: "PBボード張り", minor: "片面張り", costMasterCode: "STRUC-02" },
  { id: "struc-004", major: "躯体・下地", middle: "PBボード張り", minor: "両面張り", costMasterCode: "STRUC-02" },
  { id: "struc-005", major: "躯体・下地", middle: "天井下地", minor: "野縁受け取付", costMasterCode: "STRUC-03" },
  { id: "struc-006", major: "躯体・下地", middle: "天井下地", minor: "野縁取付", costMasterCode: "STRUC-03" },
  { id: "struc-007", major: "躯体・下地", middle: "防水下地", costMasterCode: "STRUC-04" },
  { id: "struc-008", major: "躯体・下地", middle: "開口補強", costMasterCode: "STRUC-05" },

  // 床工事
  { id: "floor-001", major: "床工事", middle: "フローリング", minor: "フローリング張り", costMasterCode: "FLOOR-01" },
  { id: "floor-002", major: "床工事", middle: "フローリング", minor: "下地合板", costMasterCode: "FLOOR-01" },
  { id: "floor-003", major: "床工事", middle: "タイル", minor: "磁器タイル張り", costMasterCode: "FLOOR-02" },
  { id: "floor-004", major: "床工事", middle: "タイル", minor: "石材張り", costMasterCode: "FLOOR-02" },
  { id: "floor-005", major: "床工事", middle: "長尺シート", costMasterCode: "FLOOR-03" },
  { id: "floor-006", major: "床工事", middle: "カーペット", costMasterCode: "FLOOR-04" },
  { id: "floor-007", major: "床工事", middle: "OAフロア", minor: "パネル設置", costMasterCode: "FLOOR-05" },
  { id: "floor-008", major: "床工事", middle: "OAフロア", minor: "配線処理", costMasterCode: "FLOOR-05" },
  { id: "floor-009", major: "床工事", middle: "置床", costMasterCode: "FLOOR-06" },
  { id: "floor-010", major: "床工事", middle: "巾木", minor: "木製巾木", costMasterCode: "FLOOR-07" },
  { id: "floor-011", major: "床工事", middle: "巾木", minor: "ビニル巾木", costMasterCode: "FLOOR-07" },

  // 壁・天井仕上げ
  { id: "wall-001", major: "壁・天井仕上げ", middle: "クロス", minor: "ビニルクロス", costMasterCode: "WALL-01" },
  { id: "wall-002", major: "壁・天井仕上げ", middle: "クロス", minor: "布クロス", costMasterCode: "WALL-01" },
  { id: "wall-003", major: "壁・天井仕上げ", middle: "塗装", minor: "EP塗装", costMasterCode: "WALL-02" },
  { id: "wall-004", major: "壁・天井仕上げ", middle: "塗装", minor: "AEP塗装", costMasterCode: "WALL-02" },
  { id: "wall-005", major: "壁・天井仕上げ", middle: "タイル", minor: "壁タイル張り", costMasterCode: "WALL-03" },
  { id: "wall-006", major: "壁・天井仕上げ", middle: "タイル", minor: "モザイクタイル", costMasterCode: "WALL-03" },
  { id: "wall-007", major: "壁・天井仕上げ", middle: "パネル", minor: "化粧パネル", costMasterCode: "WALL-04" },
  { id: "wall-008", major: "壁・天井仕上げ", middle: "パネル", minor: "エコカラット", costMasterCode: "WALL-04" },
  { id: "wall-009", major: "壁・天井仕上げ", middle: "左官", minor: "モルタル塗り", costMasterCode: "WALL-05" },
  { id: "wall-010", major: "壁・天井仕上げ", middle: "左官", minor: "珪藻土", costMasterCode: "WALL-05" },
  { id: "wall-011", major: "壁・天井仕上げ", middle: "天井仕上げ", minor: "石膏ボード仕上げ", costMasterCode: "WALL-06" },
  { id: "wall-012", major: "壁・天井仕上げ", middle: "天井仕上げ", minor: "岩綿吸音板", costMasterCode: "WALL-06" },

  // 建具工事
  { id: "door-001", major: "建具工事", middle: "フラッシュドア", minor: "木製フラッシュドア", costMasterCode: "DOOR-01" },
  { id: "door-002", major: "建具工事", middle: "フラッシュドア", minor: "スチールドア", costMasterCode: "DOOR-01" },
  { id: "door-003", major: "建具工事", middle: "ガラスドア", minor: "強化ガラスドア", costMasterCode: "DOOR-02" },
  { id: "door-004", major: "建具工事", middle: "ガラスドア", minor: "框ドア", costMasterCode: "DOOR-02" },
  { id: "door-005", major: "建具工事", middle: "自動ドア", minor: "引き戸自動ドア", costMasterCode: "DOOR-03" },
  { id: "door-006", major: "建具工事", middle: "自動ドア", minor: "センサー取付", costMasterCode: "DOOR-03" },
  { id: "door-007", major: "建具工事", middle: "パーティション", minor: "可動パーティション", costMasterCode: "DOOR-04" },
  { id: "door-008", major: "建具工事", middle: "パーティション", minor: "固定パーティション", costMasterCode: "DOOR-04" },
  { id: "door-009", major: "建具工事", middle: "カーテン", minor: "カーテン取付", costMasterCode: "DOOR-05" },
  { id: "door-010", major: "建具工事", middle: "カーテン", minor: "ブラインド取付", costMasterCode: "DOOR-05" },

  // 電気工事
  { id: "elec-001", major: "電気工事", middle: "既設配線処理", minor: "既設撤去", costMasterCode: "ELEC-01" },
  { id: "elec-002", major: "電気工事", middle: "既設配線処理", minor: "養生・保護", costMasterCode: "ELEC-01" },
  { id: "elec-003", major: "電気工事", middle: "荒配線", minor: "天井内配線", costMasterCode: "ELEC-02" },
  { id: "elec-004", major: "電気工事", middle: "荒配線", minor: "壁内配線", costMasterCode: "ELEC-02" },
  { id: "elec-005", major: "電気工事", middle: "荒配線", minor: "床下配線", costMasterCode: "ELEC-02" },
  { id: "elec-006", major: "電気工事", middle: "器具付", minor: "照明器具取付", costMasterCode: "ELEC-03" },
  { id: "elec-007", major: "電気工事", middle: "器具付", minor: "スイッチ・コンセント", costMasterCode: "ELEC-03" },
  { id: "elec-008", major: "電気工事", middle: "器具付", minor: "弱電機器", costMasterCode: "ELEC-03" },
  { id: "elec-009", major: "電気工事", middle: "分電盤設置", costMasterCode: "ELEC-04" },
  { id: "elec-010", major: "電気工事", middle: "試運転", costMasterCode: "ELEC-05" },

  // 給排水工事
  { id: "plumb-001", major: "給排水工事", middle: "既設配管処理", minor: "給水管撤去", costMasterCode: "PLUMB-01" },
  { id: "plumb-002", major: "給排水工事", middle: "既設配管処理", minor: "排水管撤去", costMasterCode: "PLUMB-01" },
  { id: "plumb-003", major: "給排水工事", middle: "給水配管", minor: "給水管新設", costMasterCode: "PLUMB-02" },
  { id: "plumb-004", major: "給排水工事", middle: "給水配管", minor: "湯水混合栓", costMasterCode: "PLUMB-02" },
  { id: "plumb-005", major: "給排水工事", middle: "排水配管", minor: "排水管新設", costMasterCode: "PLUMB-03" },
  { id: "plumb-006", major: "給排水工事", middle: "排水配管", minor: "通気管", costMasterCode: "PLUMB-03" },
  { id: "plumb-007", major: "給排水工事", middle: "衛生器具取付", minor: "洗面器取付", costMasterCode: "PLUMB-04" },
  { id: "plumb-008", major: "給排水工事", middle: "衛生器具取付", minor: "便器取付", costMasterCode: "PLUMB-04" },
  { id: "plumb-009", major: "給排水工事", middle: "衛生器具取付", minor: "キッチン取付", costMasterCode: "PLUMB-04" },
  { id: "plumb-010", major: "給排水工事", middle: "試運転", costMasterCode: "PLUMB-05" },

  // 空調・換気
  { id: "hvac-001", major: "空調・換気", middle: "既設撤去", minor: "室内機撤去", costMasterCode: "HVAC-01" },
  { id: "hvac-002", major: "空調・換気", middle: "既設撤去", minor: "室外機撤去", costMasterCode: "HVAC-01" },
  { id: "hvac-003", major: "空調・換気", middle: "冷媒配管", minor: "冷媒管新設", costMasterCode: "HVAC-02" },
  { id: "hvac-004", major: "空調・換気", middle: "冷媒配管", minor: "断熱材巻き", costMasterCode: "HVAC-02" },
  { id: "hvac-005", major: "空調・換気", middle: "ドレン", minor: "ドレン管新設", costMasterCode: "HVAC-03" },
  { id: "hvac-006", major: "空調・換気", middle: "ドレン", minor: "ドレンポンプ", costMasterCode: "HVAC-03" },
  { id: "hvac-007", major: "空調・換気", middle: "室内機取付", minor: "天吊型", costMasterCode: "HVAC-04" },
  { id: "hvac-008", major: "空調・換気", middle: "室内機取付", minor: "壁掛型", costMasterCode: "HVAC-04" },
  { id: "hvac-009", major: "空調・換気", middle: "室外機設置", costMasterCode: "HVAC-05" },
  { id: "hvac-010", major: "空調・換気", middle: "ダクト", minor: "給気ダクト", costMasterCode: "HVAC-06" },
  { id: "hvac-011", major: "空調・換気", middle: "ダクト", minor: "排気ダクト", costMasterCode: "HVAC-06" },
  { id: "hvac-012", major: "空調・換気", middle: "試運転", costMasterCode: "HVAC-07" },

  // 造作家具
  { id: "furn-001", major: "造作家具", middle: "製作", minor: "木工製作", costMasterCode: "FURN-01" },
  { id: "furn-002", major: "造作家具", middle: "製作", minor: "鉄骨製作", costMasterCode: "FURN-01" },
  { id: "furn-003", major: "造作家具", middle: "搬入", costMasterCode: "FURN-02" },
  { id: "furn-004", major: "造作家具", middle: "設置", minor: "固定取付", costMasterCode: "FURN-03" },
  { id: "furn-005", major: "造作家具", middle: "設置", minor: "置き型設置", costMasterCode: "FURN-03" },
  { id: "furn-006", major: "造作家具", middle: "建具調整", costMasterCode: "FURN-04" },

  // 塗装工事
  { id: "paint-001", major: "塗装工事", middle: "下地処理", minor: "パテ処理", costMasterCode: "PAINT-01" },
  { id: "paint-002", major: "塗装工事", middle: "下地処理", minor: "研磨", costMasterCode: "PAINT-01" },
  { id: "paint-003", major: "塗装工事", middle: "プライマー", costMasterCode: "PAINT-02" },
  { id: "paint-004", major: "塗装工事", middle: "中塗り", costMasterCode: "PAINT-03" },
  { id: "paint-005", major: "塗装工事", middle: "上塗り", minor: "1回目", costMasterCode: "PAINT-04" },
  { id: "paint-006", major: "塗装工事", middle: "上塗り", minor: "2回目", costMasterCode: "PAINT-04" },
  { id: "paint-007", major: "塗装工事", middle: "クリア", costMasterCode: "PAINT-05" },

  // クリーニング
  { id: "clean-001", major: "クリーニング", middle: "中間クリーニング", costMasterCode: "CLEAN-01" },
  { id: "clean-002", major: "クリーニング", middle: "竣工クリーニング", minor: "清掃一般", costMasterCode: "CLEAN-02" },
  { id: "clean-003", major: "クリーニング", middle: "竣工クリーニング", minor: "ガラス清掃", costMasterCode: "CLEAN-02" },
  { id: "clean-004", major: "クリーニング", middle: "ワックス", minor: "フロアワックス", costMasterCode: "CLEAN-03" },
  { id: "clean-005", major: "クリーニング", middle: "ワックス", minor: "コーティング", costMasterCode: "CLEAN-03" },

  // 検査
  { id: "insp-001", major: "検査", middle: "社内検査", minor: "施工品質確認", costMasterCode: "INSP-01" },
  { id: "insp-002", major: "検査", middle: "社内検査", minor: "是正リスト作成", costMasterCode: "INSP-01" },
  { id: "insp-003", major: "検査", middle: "施主検査", minor: "立会い検査", costMasterCode: "INSP-02" },
  { id: "insp-004", major: "検査", middle: "施主検査", minor: "是正確認", costMasterCode: "INSP-02" },
  { id: "insp-005", major: "検査", middle: "是正工事", costMasterCode: "INSP-03" },
  { id: "insp-006", major: "検査", middle: "竣工引渡し", minor: "書類一式作成", costMasterCode: "INSP-04" },
  { id: "insp-007", major: "検査", middle: "竣工引渡し", minor: "鍵引渡し", costMasterCode: "INSP-04" },
];

/**
 * 大項目の一覧を取得。major指定時はその大項目の中項目一覧を返す。
 */
export function getCategories(major?: string): string[] {
  if (!major) {
    return [...new Set(TASK_CATEGORIES.map((c) => c.major))];
  }
  return [...new Set(
    TASK_CATEGORIES.filter((c) => c.major === major).map((c) => c.middle)
  )];
}

/**
 * 中項目でフィルタして小項目リストを返す。
 * major省略時はmiddleのみでフィルタ。
 */
export function getSubCategories(major: string, middle?: string): string[] {
  const filtered = TASK_CATEGORIES.filter(
    (c) => c.major === major && (middle === undefined || c.middle === middle)
  );
  const minors = filtered.map((c) => c.minor).filter((m): m is string => m !== undefined);
  return [...new Set(minors)];
}

/**
 * 入力テキストで大項目・中項目・小項目を横断検索。
 */
export function searchCategories(query: string): TaskCategory[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return TASK_CATEGORIES.filter(
    (c) =>
      c.major.toLowerCase().includes(q) ||
      c.middle.toLowerCase().includes(q) ||
      (c.minor?.toLowerCase().includes(q) ?? false)
  );
}
