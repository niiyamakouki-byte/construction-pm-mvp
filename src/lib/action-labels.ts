export const ACTION_LABELS = {
  project: {
    create: "案件を作成",
    createFirst: "最初の案件を作成",
    select: "案件を選択する",
  },
  task: {
    createFirst: "最初のタスクを作成",
    add: "タスクを追加",
    adding: "追加中...",
  },
  gantt: {
    addSelected: (count: number) => `ガントに追加 (${count}件)`,
  },
  contractor: {
    register: "協力会社を登録",
    registering: "登録中...",
  },
  customer: {
    register: "顧客を登録",
  },
  changeRequest: {
    register: "変更指示を登録",
  },
  invoice: {
    register: "請求書を登録",
    registering: "登録中...",
  },
  estimate: {
    import: "見積を取り込む",
  },
  budget: {
    createBaseline: "予算ベースラインを作成",
  },
  form: {
    cancel: "キャンセル",
    save: "保存",
    saving: "保存中...",
  },
} as const;
