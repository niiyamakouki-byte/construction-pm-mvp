import type { WorkCategory } from "./types.js";

export const WORK_CATEGORIES: WorkCategory[] = [
  {
    label: "仮設工事",
    items: [
      { name: "足場組立", defaultDays: 3 },
      { name: "足場解体", defaultDays: 2 },
      { name: "養生シート設置", defaultDays: 1 },
      { name: "仮設トイレ設置", defaultDays: 1 },
      { name: "仮囲い設置", defaultDays: 2 },
    ],
  },
  {
    label: "解体工事",
    items: [
      { name: "内装解体", defaultDays: 5 },
      { name: "床解体", defaultDays: 3 },
      { name: "天井解体", defaultDays: 2 },
      { name: "間仕切り撤去", defaultDays: 2 },
      { name: "設備撤去", defaultDays: 3 },
    ],
  },
  {
    label: "躯体工事",
    items: [
      { name: "基礎工事", defaultDays: 7 },
      { name: "コンクリート打設", defaultDays: 3 },
      { name: "型枠工事", defaultDays: 5 },
      { name: "鉄筋工事", defaultDays: 5 },
      { name: "鉄骨工事", defaultDays: 7 },
    ],
  },
  {
    label: "内装工事",
    items: [
      { name: "壁ボード貼り", defaultDays: 5 },
      { name: "クロス貼り", defaultDays: 4 },
      { name: "床材施工", defaultDays: 3 },
      { name: "天井施工", defaultDays: 4 },
      { name: "間仕切り設置", defaultDays: 3 },
      { name: "フローリング施工", defaultDays: 3 },
    ],
  },
  {
    label: "電気工事",
    items: [
      { name: "幹線工事", defaultDays: 3 },
      { name: "配線工事", defaultDays: 5 },
      { name: "照明器具取付", defaultDays: 2 },
      { name: "コンセント取付", defaultDays: 2 },
      { name: "分電盤工事", defaultDays: 2 },
      { name: "弱電工事", defaultDays: 2 },
    ],
  },
  {
    label: "給排水工事",
    items: [
      { name: "給水配管", defaultDays: 4 },
      { name: "排水配管", defaultDays: 4 },
      { name: "衛生器具取付", defaultDays: 3 },
      { name: "水道引込工事", defaultDays: 2 },
    ],
  },
  {
    label: "空調工事",
    items: [
      { name: "エアコン設置", defaultDays: 2 },
      { name: "ダクト工事", defaultDays: 4 },
      { name: "換気設備工事", defaultDays: 3 },
    ],
  },
  {
    label: "外装工事",
    items: [
      { name: "外壁工事", defaultDays: 7 },
      { name: "屋根工事", defaultDays: 5 },
      { name: "防水工事", defaultDays: 3 },
      { name: "外装タイル貼り", defaultDays: 5 },
    ],
  },
  {
    label: "建具工事",
    items: [
      { name: "ドア取付", defaultDays: 2 },
      { name: "窓サッシ取付", defaultDays: 3 },
      { name: "引き戸設置", defaultDays: 2 },
      { name: "シャッター設置", defaultDays: 2 },
    ],
  },
  {
    label: "左官工事",
    items: [
      { name: "モルタル塗り", defaultDays: 5 },
      { name: "タイル張り", defaultDays: 4 },
      { name: "コンクリート補修", defaultDays: 3 },
    ],
  },
  {
    label: "塗装工事",
    items: [
      { name: "外壁塗装", defaultDays: 5 },
      { name: "内壁塗装", defaultDays: 3 },
      { name: "床塗装", defaultDays: 2 },
      { name: "鉄部塗装", defaultDays: 3 },
    ],
  },
  {
    label: "クリーニング",
    items: [
      { name: "中間清掃", defaultDays: 1 },
      { name: "竣工清掃", defaultDays: 2 },
      { name: "ガラス清掃", defaultDays: 1 },
    ],
  },
  {
    label: "検査・引渡し",
    items: [
      { name: "社内検査", defaultDays: 1 },
      { name: "施主検査", defaultDays: 1 },
      { name: "是正工事", defaultDays: 3 },
      { name: "引渡し", defaultDays: 1 },
    ],
  },
];
