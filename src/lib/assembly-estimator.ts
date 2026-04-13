/** PlanSwift蒸留 — アセンブリ積算 + 業種別テンプレート */

import { escapeHtml } from "./utils/escape-html";

// ─── Types ──────────────────────────────────────────────────────

export type AssemblyComponent = {
  materialCode?: string;
  name: string;
  unit: string;
  /** quantity of this component per 1 unit of the assembly */
  quantityPer: number;
  unitPrice: number;
  wasteFactor?: number;
  note?: string;
};

export type Assembly = {
  id: string;
  name: string;
  category: string;
  unit: string;
  components: AssemblyComponent[];
  description?: string;
};

export type AssemblyEstimateItem = {
  assembly: Assembly;
  quantity: number;
  componentBreakdown: {
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
  totalAmount: number;
};

export type AssemblyEstimateResult = {
  items: AssemblyEstimateItem[];
  subtotal: number;
  overhead: number;
  total: number;
  totalWithTax: number;
};

// ─── Built-in assemblies ─────────────────────────────────────────

/** Return all pre-built assemblies for common interior work */
export function getBuiltInAssemblies(): Assembly[] {
  return [
    // LGS間仕切り壁 65型
    {
      id: "lgs-wall-65",
      name: "LGS間仕切り壁 65型",
      category: "間仕切り壁",
      unit: "㎡",
      description: "LGS 65型スタッドを使用した一般的な間仕切り壁（PB両面貼り・クロス仕上げ）",
      components: [
        {
          materialCode: "LGS-ST-65",
          name: "LGSスタッド 65型",
          unit: "本",
          quantityPer: 1.05,
          unitPrice: 350,
          note: "@303mmピッチ 1㎡あたり約1.05本",
        },
        {
          materialCode: "LGS-RN-65",
          name: "LGSランナー 65型",
          unit: "m",
          quantityPer: 0.7,
          unitPrice: 280,
          note: "床・天井ランナー合計",
        },
        {
          materialCode: "PB-125",
          name: "石膏ボード PB12.5mm",
          unit: "枚",
          quantityPer: 0.55,
          unitPrice: 650,
          wasteFactor: 1.05,
          note: "両面（2面）貼り、歩留まり考慮",
        },
        {
          materialCode: "SCREW-LGS",
          name: "ビス（LGS用）",
          unit: "本",
          quantityPer: 25,
          unitPrice: 4,
        },
        {
          materialCode: "GW-50",
          name: "グラスウール 50mm",
          unit: "㎡",
          quantityPer: 1.0,
          unitPrice: 480,
          wasteFactor: 1.03,
        },
        {
          materialCode: "CLOTH-VP",
          name: "クロス（VP）",
          unit: "㎡",
          quantityPer: 2.1,
          unitPrice: 850,
          wasteFactor: 1.1,
          note: "両面分、ロス込み",
        },
        {
          materialCode: "LABOR-LGS",
          name: "LGS組立・PB施工 労務費",
          unit: "㎡",
          quantityPer: 1.0,
          unitPrice: 3500,
        },
        {
          materialCode: "LABOR-CLOTH",
          name: "クロス施工 労務費",
          unit: "㎡",
          quantityPer: 2.1,
          unitPrice: 600,
        },
      ],
    },

    // LGS間仕切り壁 75型
    {
      id: "lgs-wall-75",
      name: "LGS間仕切り壁 75型",
      category: "間仕切り壁",
      unit: "㎡",
      description: "LGS 75型スタッドを使用した間仕切り壁（PB両面貼り・クロス仕上げ）",
      components: [
        {
          materialCode: "LGS-ST-75",
          name: "LGSスタッド 75型",
          unit: "本",
          quantityPer: 1.05,
          unitPrice: 420,
          note: "@303mmピッチ",
        },
        {
          materialCode: "LGS-RN-75",
          name: "LGSランナー 75型",
          unit: "m",
          quantityPer: 0.7,
          unitPrice: 330,
        },
        {
          materialCode: "PB-125",
          name: "石膏ボード PB12.5mm",
          unit: "枚",
          quantityPer: 0.55,
          unitPrice: 650,
          wasteFactor: 1.05,
        },
        {
          materialCode: "SCREW-LGS",
          name: "ビス（LGS用）",
          unit: "本",
          quantityPer: 25,
          unitPrice: 4,
        },
        {
          materialCode: "GW-75",
          name: "グラスウール 75mm",
          unit: "㎡",
          quantityPer: 1.0,
          unitPrice: 620,
          wasteFactor: 1.03,
        },
        {
          materialCode: "CLOTH-VP",
          name: "クロス（VP）",
          unit: "㎡",
          quantityPer: 2.1,
          unitPrice: 850,
          wasteFactor: 1.1,
        },
        {
          materialCode: "LABOR-LGS",
          name: "LGS組立・PB施工 労務費",
          unit: "㎡",
          quantityPer: 1.0,
          unitPrice: 3800,
        },
        {
          materialCode: "LABOR-CLOTH",
          name: "クロス施工 労務費",
          unit: "㎡",
          quantityPer: 2.1,
          unitPrice: 600,
        },
      ],
    },

    // LGS間仕切り壁 90型
    {
      id: "lgs-wall-90",
      name: "LGS間仕切り壁 90型",
      category: "間仕切り壁",
      unit: "㎡",
      description: "LGS 90型スタッドを使用した重量間仕切り壁（PB両面貼り・クロス仕上げ）",
      components: [
        {
          materialCode: "LGS-ST-90",
          name: "LGSスタッド 90型",
          unit: "本",
          quantityPer: 1.05,
          unitPrice: 520,
          note: "@303mmピッチ",
        },
        {
          materialCode: "LGS-RN-90",
          name: "LGSランナー 90型",
          unit: "m",
          quantityPer: 0.7,
          unitPrice: 400,
        },
        {
          materialCode: "PB-125",
          name: "石膏ボード PB12.5mm",
          unit: "枚",
          quantityPer: 0.55,
          unitPrice: 650,
          wasteFactor: 1.05,
        },
        {
          materialCode: "SCREW-LGS",
          name: "ビス（LGS用）",
          unit: "本",
          quantityPer: 28,
          unitPrice: 4,
        },
        {
          materialCode: "GW-100",
          name: "グラスウール 100mm",
          unit: "㎡",
          quantityPer: 1.0,
          unitPrice: 780,
          wasteFactor: 1.03,
        },
        {
          materialCode: "CLOTH-VP",
          name: "クロス（VP）",
          unit: "㎡",
          quantityPer: 2.1,
          unitPrice: 850,
          wasteFactor: 1.1,
        },
        {
          materialCode: "LABOR-LGS",
          name: "LGS組立・PB施工 労務費",
          unit: "㎡",
          quantityPer: 1.0,
          unitPrice: 4200,
        },
        {
          materialCode: "LABOR-CLOTH",
          name: "クロス施工 労務費",
          unit: "㎡",
          quantityPer: 2.1,
          unitPrice: 600,
        },
      ],
    },

    // LGS天井
    {
      id: "lgs-ceiling",
      name: "LGS軽量天井",
      category: "天井",
      unit: "㎡",
      description: "LGS野縁・野縁受けを使用した一般的な軽量天井（PB貼り・クロス仕上げ）",
      components: [
        {
          materialCode: "LGS-CH",
          name: "Cチャンネル（野縁受け）",
          unit: "m",
          quantityPer: 1.1,
          unitPrice: 290,
          note: "@900mmピッチ",
        },
        {
          materialCode: "LGS-SB",
          name: "シングルバー（野縁）",
          unit: "m",
          quantityPer: 2.2,
          unitPrice: 220,
          note: "@303mmピッチ",
        },
        {
          materialCode: "LGS-HG",
          name: "ハンガー",
          unit: "個",
          quantityPer: 1.5,
          unitPrice: 120,
        },
        {
          materialCode: "LGS-CL",
          name: "クリップ",
          unit: "個",
          quantityPer: 8,
          unitPrice: 35,
        },
        {
          materialCode: "BOLT-W38",
          name: "全ネジボルト W3/8",
          unit: "本",
          quantityPer: 1.5,
          unitPrice: 180,
        },
        {
          materialCode: "PB-125",
          name: "石膏ボード PB12.5mm",
          unit: "枚",
          quantityPer: 0.28,
          unitPrice: 650,
          wasteFactor: 1.05,
        },
        {
          materialCode: "CLOTH-VP",
          name: "クロス（VP）",
          unit: "㎡",
          quantityPer: 1.05,
          unitPrice: 850,
          wasteFactor: 1.1,
        },
        {
          materialCode: "LABOR-CEIL",
          name: "天井LGS・PB施工 労務費",
          unit: "㎡",
          quantityPer: 1.0,
          unitPrice: 4500,
        },
        {
          materialCode: "LABOR-CLOTH-CEIL",
          name: "天井クロス施工 労務費",
          unit: "㎡",
          quantityPer: 1.05,
          unitPrice: 700,
        },
      ],
    },

    // 床 OAフロア + タイルカーペット
    {
      id: "floor-oa-carpet",
      name: "OAフロア＋タイルカーペット",
      category: "床",
      unit: "㎡",
      description: "OAフロアパネル（H100）にタイルカーペット仕上げ",
      components: [
        {
          materialCode: "OA-PANEL",
          name: "OAフロアパネル",
          unit: "枚",
          quantityPer: 1.68,
          unitPrice: 1800,
          wasteFactor: 1.03,
          note: "600×600パネル @1㎡あたり約2.78枚、端末ロス込み",
        },
        {
          materialCode: "OA-PILLAR",
          name: "OAフロア支柱",
          unit: "個",
          quantityPer: 2.78,
          unitPrice: 350,
        },
        {
          materialCode: "TILE-CARPET",
          name: "タイルカーペット 500角",
          unit: "枚",
          quantityPer: 4.0,
          unitPrice: 1200,
          wasteFactor: 1.05,
        },
        {
          materialCode: "LABOR-OA",
          name: "OAフロア施工 労務費",
          unit: "㎡",
          quantityPer: 1.0,
          unitPrice: 2800,
        },
        {
          materialCode: "LABOR-CARPET",
          name: "タイルカーペット施工 労務費",
          unit: "㎡",
          quantityPer: 1.0,
          unitPrice: 1200,
        },
      ],
    },

    // 床 フローリング直貼り
    {
      id: "floor-flooring-direct",
      name: "フローリング直貼り",
      category: "床",
      unit: "㎡",
      description: "防音フローリング直貼り工法（接着剤固定）＋巾木",
      components: [
        {
          materialCode: "FLOOR-WOOD",
          name: "防音フローリング 12mm",
          unit: "㎡",
          quantityPer: 1.0,
          unitPrice: 4500,
          wasteFactor: 1.08,
          note: "ロス8%込み",
        },
        {
          materialCode: "ADHESIVE",
          name: "フローリング用接着剤",
          unit: "kg",
          quantityPer: 0.4,
          unitPrice: 600,
        },
        {
          materialCode: "BASEBOARD",
          name: "巾木（木製 60mm高）",
          unit: "m",
          quantityPer: 0.4,
          unitPrice: 380,
          note: "周長換算（㎡→m概算）",
        },
        {
          materialCode: "LABOR-FLOOR",
          name: "フローリング施工 労務費",
          unit: "㎡",
          quantityPer: 1.0,
          unitPrice: 3200,
        },
        {
          materialCode: "LABOR-BASE",
          name: "巾木施工 労務費",
          unit: "m",
          quantityPer: 0.4,
          unitPrice: 500,
        },
      ],
    },

    // 塗装仕上げ壁
    {
      id: "wall-paint",
      name: "塗装仕上げ壁（EP塗装）",
      category: "壁仕上げ",
      unit: "㎡",
      description: "下地処理＋パテ＋シーラー＋EP塗装2回塗り",
      components: [
        {
          materialCode: "REPAIR-MORTAR",
          name: "下地処理材（ポリマーセメント）",
          unit: "kg",
          quantityPer: 0.3,
          unitPrice: 420,
        },
        {
          materialCode: "PUTTY",
          name: "パテ（石膏系）",
          unit: "kg",
          quantityPer: 0.8,
          unitPrice: 280,
          note: "全面パテ処理",
        },
        {
          materialCode: "SEALER",
          name: "シーラー（水性）",
          unit: "L",
          quantityPer: 0.1,
          unitPrice: 1200,
        },
        {
          materialCode: "EP-PAINT",
          name: "EP塗料（水性）",
          unit: "L",
          quantityPer: 0.25,
          unitPrice: 900,
          note: "2回塗り分",
        },
        {
          materialCode: "LABOR-PAINT",
          name: "塗装施工 労務費",
          unit: "㎡",
          quantityPer: 1.0,
          unitPrice: 1800,
        },
      ],
    },

    // トイレブース
    {
      id: "toilet-booth",
      name: "トイレブース",
      category: "間仕切り・ブース",
      unit: "基",
      description: "トイレブース1基（パネル＋金物＋ドア＋鍵）",
      components: [
        {
          materialCode: "BOOTH-PANEL",
          name: "ブースパネル（メラミン化粧板 12mm）",
          unit: "枚",
          quantityPer: 4.0,
          unitPrice: 18000,
          note: "側板2枚・前板1枚・後板1枚",
        },
        {
          materialCode: "BOOTH-HARDWARE",
          name: "ブース金物セット（蝶番・ブラケット等）",
          unit: "式",
          quantityPer: 1.0,
          unitPrice: 12000,
        },
        {
          materialCode: "BOOTH-DOOR",
          name: "ブースドア",
          unit: "枚",
          quantityPer: 1.0,
          unitPrice: 28000,
        },
        {
          materialCode: "BOOTH-LOCK",
          name: "鍵（コインロック）",
          unit: "個",
          quantityPer: 1.0,
          unitPrice: 6500,
        },
        {
          materialCode: "LABOR-BOOTH",
          name: "ブース組立施工 労務費",
          unit: "基",
          quantityPer: 1.0,
          unitPrice: 35000,
        },
      ],
    },
  ];
}

// ─── Custom assembly ─────────────────────────────────────────────

let _customSeq = 0;

/** Create a custom assembly */
export function createCustomAssembly(
  name: string,
  category: string,
  unit: string,
  components: AssemblyComponent[],
  description?: string,
): Assembly {
  _customSeq += 1;
  const id = `custom-${name.replace(/\s+/g, "-").toLowerCase()}-${_customSeq}`;
  return { id, name, category, unit, components, description };
}

// ─── Calculation ─────────────────────────────────────────────────

/** Calculate all component quantities and costs for a given assembly quantity */
export function calculateAssembly(
  assembly: Assembly,
  quantity: number,
): AssemblyEstimateItem {
  const componentBreakdown = assembly.components.map((comp) => {
    const factor = comp.wasteFactor ?? 1.0;
    const componentQuantity = Math.round(comp.quantityPer * factor * quantity * 100) / 100;
    const amount = Math.round(componentQuantity * comp.unitPrice);
    return {
      name: comp.name,
      unit: comp.unit,
      quantity: componentQuantity,
      unitPrice: comp.unitPrice,
      amount,
    };
  });

  const totalAmount = componentBreakdown.reduce((sum, b) => sum + b.amount, 0);

  return {
    assembly,
    quantity,
    componentBreakdown,
    totalAmount,
  };
}

/** Full estimate from multiple assemblies with overhead */
export function estimateFromAssemblies(
  items: { assemblyId: string; quantity: number }[],
  overheadRate = 0.1,
): AssemblyEstimateResult {
  const builtIn = getBuiltInAssemblies();
  const estimateItems: AssemblyEstimateItem[] = [];

  for (const item of items) {
    const assembly = builtIn.find((a) => a.id === item.assemblyId);
    if (!assembly) {
      throw new Error(`アセンブリID "${item.assemblyId}" が見つかりません`);
    }
    estimateItems.push(calculateAssembly(assembly, item.quantity));
  }

  const subtotal = estimateItems.reduce((sum, i) => sum + i.totalAmount, 0);
  const overhead = Math.round(subtotal * overheadRate);
  const total = subtotal + overhead;
  const totalWithTax = Math.round(total * 1.1);

  return { items: estimateItems, subtotal, overhead, total, totalWithTax };
}

// ─── Query helpers ───────────────────────────────────────────────

/** Filter assemblies by category */
export function findAssembliesByCategory(category: string): Assembly[] {
  return getBuiltInAssemblies().filter((a) => a.category === category);
}

/** Get total unit cost of an assembly (sum of all component costs per unit) */
export function getAssemblyUnitCost(assembly: Assembly): number {
  return assembly.components.reduce((sum, comp) => {
    const factor = comp.wasteFactor ?? 1.0;
    return sum + comp.quantityPer * factor * comp.unitPrice;
  }, 0);
}

/** Side-by-side comparison of two assemblies */
export function compareAssemblies(
  assemblyA: Assembly,
  assemblyB: Assembly,
): {
  assemblyA: { id: string; name: string; unitCost: number; componentCount: number };
  assemblyB: { id: string; name: string; unitCost: number; componentCount: number };
  costDifference: number;
  costDifferenceRate: number;
  cheaperAssemblyId: string;
} {
  const costA = getAssemblyUnitCost(assemblyA);
  const costB = getAssemblyUnitCost(assemblyB);
  const costDifference = costA - costB;
  const base = Math.min(costA, costB);
  const costDifferenceRate = base > 0 ? (Math.abs(costDifference) / base) * 100 : 0;

  return {
    assemblyA: {
      id: assemblyA.id,
      name: assemblyA.name,
      unitCost: Math.round(costA),
      componentCount: assemblyA.components.length,
    },
    assemblyB: {
      id: assemblyB.id,
      name: assemblyB.name,
      unitCost: Math.round(costB),
      componentCount: assemblyB.components.length,
    },
    costDifference: Math.round(costDifference),
    costDifferenceRate: Math.round(costDifferenceRate * 10) / 10,
    cheaperAssemblyId: costA <= costB ? assemblyA.id : assemblyB.id,
  };
}

// ─── Output helpers ──────────────────────────────────────────────

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

/** Generate printable HTML estimate from assembly calculation */
export function buildAssemblyEstimateHtml(
  result: AssemblyEstimateResult,
  config: { projectName: string; clientName: string },
): string {
  const itemRows = result.items
    .map((item) => {
      const breakdownRows = item.componentBreakdown
        .map(
          (b) => `    <tr class="breakdown">
      <td></td>
      <td>${escapeHtml(b.name)}</td>
      <td>${escapeHtml(b.unit)}</td>
      <td class="num">${b.quantity.toLocaleString("ja-JP")}</td>
      <td class="num">${formatYen(b.unitPrice)}</td>
      <td class="num">${formatYen(b.amount)}</td>
    </tr>`,
        )
        .join("\n");

      return `  <tr class="assembly">
    <td>${escapeHtml(item.assembly.name)}</td>
    <td>${escapeHtml(item.assembly.category)}</td>
    <td>${escapeHtml(item.assembly.unit)}</td>
    <td class="num">${item.quantity.toLocaleString("ja-JP")}</td>
    <td class="num">—</td>
    <td class="num">${formatYen(item.totalAmount)}</td>
  </tr>
${breakdownRows}`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>アセンブリ積算書 — ${escapeHtml(config.projectName)}</title>
  <style>
    body { font-family: "Meiryo", Arial, sans-serif; margin: 24px; color: #1f2937; }
    h1 { font-size: 1.4rem; margin-bottom: 4px; }
    .meta { font-size: 0.85rem; color: #6b7280; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.85rem; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
    th { background: #1f2937; color: white; }
    tr.assembly td { background: #f3f4f6; font-weight: bold; }
    tr.breakdown td { padding-left: 24px; font-size: 0.8rem; color: #374151; }
    .num { text-align: right; }
    .totals { margin-top: 16px; text-align: right; font-size: 0.9rem; }
    .totals td { padding: 4px 8px; }
    .totals .label { color: #6b7280; }
    .totals .grand { font-size: 1.1rem; font-weight: bold; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>アセンブリ積算書</h1>
  <div class="meta">
    <span>案件名: ${escapeHtml(config.projectName)}</span>
    <span>クライアント: ${escapeHtml(config.clientName)}</span>
    <span>作成日: ${new Date().toLocaleDateString("ja-JP")}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th>アセンブリ名 / 構成品目</th>
        <th>カテゴリ</th>
        <th>単位</th>
        <th class="num">数量</th>
        <th class="num">単価</th>
        <th class="num">金額</th>
      </tr>
    </thead>
    <tbody>
${itemRows}
    </tbody>
  </table>

  <table class="totals">
    <tbody>
      <tr><td class="label">小計</td><td class="num">${formatYen(result.subtotal)}</td></tr>
      <tr><td class="label">諸経費</td><td class="num">${formatYen(result.overhead)}</td></tr>
      <tr><td class="label">合計（税抜）</td><td class="num">${formatYen(result.total)}</td></tr>
      <tr><td class="label grand">合計（税込 10%）</td><td class="num grand">${formatYen(result.totalWithTax)}</td></tr>
    </tbody>
  </table>
</body>
</html>`;
}

/** Export estimate to CSV */
export function exportAssemblyCSV(result: AssemblyEstimateResult): string {
  const lines: string[] = [
    "アセンブリ名,カテゴリ,構成品目,単位,数量,単価,金額",
  ];

  for (const item of result.items) {
    for (const b of item.componentBreakdown) {
      const row = [
        item.assembly.name,
        item.assembly.category,
        b.name,
        b.unit,
        String(b.quantity),
        String(b.unitPrice),
        String(b.amount),
      ]
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(",");
      lines.push(row);
    }
    // blank separator between assemblies
    lines.push("");
  }

  lines.push(`"小計","","","","","","${result.subtotal}"`);
  lines.push(`"諸経費","","","","","","${result.overhead}"`);
  lines.push(`"合計（税抜）","","","","","","${result.total}"`);
  lines.push(`"合計（税込）","","","","","","${result.totalWithTax}"`);

  return lines.join("\n");
}
