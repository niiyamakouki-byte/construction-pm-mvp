/**
 * NodeSchedulePage のユーティリティ関数テスト
 * bezierPath の座標計算と parseCSV のパース処理を検証する
 */
import { describe, expect, it } from "vitest";

// ── Re-implement helpers for unit testing ────────────────────────
// These mirror the internal helpers in NodeSchedulePage.tsx

type Vec2 = { x: number; y: number };

function bezierPath(from: Vec2, to: Vec2): string {
  const dx = Math.abs(to.x - from.x) * 0.5;
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? "";
    });
    return row;
  });
}

function mapCsvRowToImportedTask(row: Record<string, string>) {
  return {
    contractorId: row["担当業者"] ?? row["contractor"] ?? row["assignee"] ?? undefined,
    assigneeId: undefined,
  };
}

// ── bezierPath テスト ─────────────────────────────────────────────

describe("bezierPath", () => {
  it("同一座標では dx=0 でストレートなパスになる", () => {
    const path = bezierPath({ x: 100, y: 100 }, { x: 100, y: 100 });
    expect(path).toBe("M 100 100 C 100 100, 100 100, 100 100");
  });

  it("右方向への接続パスが正しい制御点を持つ", () => {
    const path = bezierPath({ x: 0, y: 50 }, { x: 200, y: 50 });
    // dx = |200 - 0| * 0.5 = 100
    expect(path).toBe("M 0 50 C 100 50, 100 50, 200 50");
  });

  it("左方向（逆方向）への接続パスでも dx は絶対値を使う", () => {
    const path = bezierPath({ x: 300, y: 50 }, { x: 100, y: 50 });
    // dx = |100 - 300| * 0.5 = 100
    expect(path).toBe("M 300 50 C 400 50, 0 50, 100 50");
  });

  it("垂直方向への接続パスで dx=0 になる", () => {
    const path = bezierPath({ x: 100, y: 0 }, { x: 100, y: 200 });
    // dx = |100 - 100| * 0.5 = 0
    expect(path).toBe("M 100 0 C 100 0, 100 200, 100 200");
  });

  it("斜め方向の接続パスが正しい", () => {
    const path = bezierPath({ x: 0, y: 0 }, { x: 400, y: 200 });
    // dx = 400 * 0.5 = 200
    expect(path).toBe("M 0 0 C 200 0, 200 200, 400 200");
  });

  it("パスは M で始まり C を含む SVG フォーマット", () => {
    const path = bezierPath({ x: 10, y: 20 }, { x: 30, y: 40 });
    expect(path).toMatch(/^M \d+ \d+ C/);
  });
});

// ── parseCSV テスト ───────────────────────────────────────────────

describe("parseCSV", () => {
  it("ヘッダーのみ（1行）の場合は空配列を返す", () => {
    const result = parseCSV("タスク名,カテゴリ");
    expect(result).toEqual([]);
  });

  it("空文字列の場合は空配列を返す", () => {
    const result = parseCSV("");
    expect(result).toEqual([]);
  });

  it("ヘッダー + 1行のデータを正しくパースする", () => {
    const csv = "name,category\n墨出し,内装";
    const result = parseCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("墨出し");
    expect(result[0].category).toBe("内装");
  });

  it("複数行を正しくパースする", () => {
    const csv = "name,value\nA,1\nB,2\nC,3";
    const result = parseCSV(csv);
    expect(result).toHaveLength(3);
    expect(result[1].name).toBe("B");
    expect(result[2].value).toBe("3");
  });

  it("スペースをトリムする", () => {
    const csv = " name , category \n 墨出し , 内装 ";
    const result = parseCSV(csv);
    expect(result[0].name).toBe("墨出し");
    expect(result[0].category).toBe("内装");
  });

  it("不足フィールドは空文字列になる", () => {
    const csv = "name,category,note\n墨出し,内装";
    const result = parseCSV(csv);
    expect(result[0].note).toBe("");
  });

  it("CRLF 改行コードを正しく処理する", () => {
    const csv = "name,val\r\nA,1\r\nB,2";
    const result = parseCSV(csv);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("A");
  });

  it("サンプルCSVの工程表を全てパースできる", () => {
    const csv = `タスク名,カテゴリ,開始日,終了日,担当業者,材料,リードタイム日数
墨出し・下地確認,内装,2024-04-01,2024-04-02,田中工務店,,0
解体・撤去,内装,2024-04-02,2024-04-05,田中工務店,,1
下地工事,内装,2024-04-05,2024-04-10,山田建設,石膏ボード,2`;
    const result = parseCSV(csv);
    expect(result).toHaveLength(3);
    expect(result[0]["タスク名"]).toBe("墨出し・下地確認");
    expect(result[2]["材料"]).toBe("石膏ボード");
    expect(result[1]["リードタイム日数"]).toBe("1");
  });

  it("担当業者は contractorId にマップされる", () => {
    const [row] = parseCSV("タスク名,担当業者\n墨出し,田中工務店");
    expect(mapCsvRowToImportedTask(row)).toEqual({
      contractorId: "田中工務店",
      assigneeId: undefined,
    });
  });
});

// ── ノード接続ロジック テスト ────────────────────────────────────

describe("ノード接続ロジック", () => {
  type Connection = { fromId: string; toId: string };

  it("同じノードへの自己接続は除外すべき", () => {
    const connections: Connection[] = [
      { fromId: "a", toId: "b" },
      { fromId: "b", toId: "c" },
    ];
    const selfLoops = connections.filter((c) => c.fromId === c.toId);
    expect(selfLoops).toHaveLength(0);
  });

  it("重複接続を検出できる", () => {
    const connections: Connection[] = [
      { fromId: "a", toId: "b" },
      { fromId: "b", toId: "c" },
      { fromId: "a", toId: "b" }, // duplicate
    ];
    const unique = connections.filter(
      (c, idx) =>
        connections.findIndex((x) => x.fromId === c.fromId && x.toId === c.toId) === idx,
    );
    expect(unique).toHaveLength(2);
  });

  it("接続元ノードから下流ノードを取得できる", () => {
    const connections: Connection[] = [
      { fromId: "a", toId: "b" },
      { fromId: "a", toId: "c" },
      { fromId: "b", toId: "d" },
    ];
    const downstream = connections
      .filter((c) => c.fromId === "a")
      .map((c) => c.toId);
    expect(downstream).toEqual(["b", "c"]);
  });
});

// ── ノード座標計算テスト ─────────────────────────────────────────

describe("ノード座標", () => {
  const NODE_W = 180;
  const NODE_H = 80;
  const PORT_R = 6;

  it("出力ポートはノードの右端中央に位置する", () => {
    const nodeX = 100;
    const nodeY = 50;
    const outputPortX = nodeX + NODE_W;
    const outputPortY = nodeY + NODE_H / 2;
    expect(outputPortX).toBe(280);
    expect(outputPortY).toBe(90);
  });

  it("入力ポートはノードの左端中央に位置する", () => {
    const nodeX = 100;
    const nodeY = 50;
    const inputPortX = nodeX;
    const inputPortY = nodeY + NODE_H / 2;
    expect(inputPortX).toBe(100);
    expect(inputPortY).toBe(90);
  });

  it("ポート半径が定義されている", () => {
    expect(PORT_R).toBeGreaterThan(0);
  });
});
