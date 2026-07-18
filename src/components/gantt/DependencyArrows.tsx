import type { DependencyType } from "../../domain/types.js";
import type { GanttTask } from "./types.js";
import { daysBetween } from "./utils.js";
import { gantt } from "../../theme/index.js";

type VisibleRow =
  | { type: "phase"; group: { projectId: string; tasks: GanttTask[]; collapsed: boolean } }
  | { type: "task"; task: GanttTask };

type Props = {
  tasks: GanttTask[];
  chartStart: string;
  dayWidth: number;
  totalDays: number;
  /** P2.5: visibleRows でフェーズ行を考慮した正確な Y 座標計算に使用 */
  visibleRows?: VisibleRow[];
  /** P2.5: 依存線クリック時に呼ばれ、先行(predecessorId)→後続(successorId)の依存を削除する */
  onRemoveDependency?: (predecessorId: string, successorId: string) => void;
};

type ArrowSpec = {
  key: string;
  predecessorId: string;
  successorId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depType: DependencyType;
};

// Visual style per dependency type
const DEP_STYLE: Record<DependencyType, { stroke: string; dasharray?: string; markerId: string }> = {
  FS:   { stroke: "#94a3b8", markerId: "dep-arrow-FS" },
  FF:   { stroke: "#6366f1", dasharray: "5 3", markerId: "dep-arrow-FF" },
  SS:   { stroke: "#587b56", dasharray: "2 2 8 2", markerId: "dep-arrow-SS" },
  SF:   { stroke: "#f59e0b", dasharray: "1 0 4 0", markerId: "dep-arrow-SF" },
  none: { stroke: "transparent", markerId: "dep-arrow-none" },
};

function ArrowheadMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="5"
      markerHeight="5"
      orient="auto"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} opacity="0.85" />
    </marker>
  );
}

/** SVG overlay that draws dependency arrows between task bars, styled by type. */
export function DependencyArrows({ tasks, chartStart, dayWidth, totalDays, visibleRows, onRemoveDependency }: Props) {
  const { rowHeight, headerHeight, phaseRowHeight } = gantt;

  // P2.5: visibleRows があればフェーズ行を考慮した row index を使用
  const taskMap = new Map<string, { task: GanttTask; index: number }>();
  if (visibleRows && visibleRows.length > 0) {
    let taskRowIndex = 0;
    for (const row of visibleRows) {
      if (row.type === "phase") {
        // phaseRowHeight 分だけ Y オフセットを加算するため専用カウンタは不要
        // task index の代わりに pixel Y を直接計算する方式に切り替える
        // → 後段の index 計算を Y ピクセル方式に変える
      } else {
        taskMap.set(row.task.id, { task: row.task, index: taskRowIndex });
        taskRowIndex += 1;
      }
    }
  } else {
    for (const [i, t] of tasks.entries()) {
      taskMap.set(t.id, { task: t, index: i });
    }
  }

  // P2.5: visibleRows からタスクの Y ピクセル中心を正確に求める
  const taskYMap = new Map<string, number>();
  if (visibleRows && visibleRows.length > 0) {
    let y = headerHeight;
    for (const row of visibleRows) {
      if (row.type === "phase") {
        y += phaseRowHeight;
      } else {
        taskYMap.set(row.task.id, y + rowHeight / 2);
        y += rowHeight;
      }
    }
  }

  const arrows: ArrowSpec[] = [];

  for (const { task: successor, index: successorIndex } of taskMap.values()) {
    const depType: DependencyType = successor.dependencyType ?? "FS";

    // none = no arrow
    if (depType === "none") continue;

    for (const predecessorId of successor.dependencies ?? []) {
      const predecessorEntry = taskMap.get(predecessorId);
      if (!predecessorEntry) continue;

      const { task: predecessor, index: predecessorIndex } = predecessorEntry;

      let x1: number;
      let y1: number;
      let x2: number;
      let y2: number;

      const predStart = daysBetween(chartStart, predecessor.startDate);
      const predEnd = daysBetween(chartStart, predecessor.endDate);
      const succStart = daysBetween(chartStart, successor.startDate);
      const succEnd = daysBetween(chartStart, successor.endDate);

      // P2.5: visibleRows 有りの場合は正確な Y 座標、なければ旧方式
      const predRowY = taskYMap.get(predecessorId) ?? (headerHeight + predecessorIndex * rowHeight + rowHeight / 2);
      const succRowY = taskYMap.get(successor.id) ?? (headerHeight + successorIndex * rowHeight + rowHeight / 2);

      switch (depType) {
        case "FF":
          // predecessor right edge -> successor right edge
          x1 = predEnd * dayWidth + dayWidth;
          x2 = succEnd * dayWidth + dayWidth - 4;
          y1 = predRowY;
          y2 = succRowY;
          break;
        case "SS":
          // predecessor left edge -> successor left edge
          x1 = predStart * dayWidth;
          x2 = succStart * dayWidth + 4;
          y1 = predRowY;
          y2 = succRowY;
          break;
        case "SF":
          // predecessor left edge -> successor right edge
          x1 = predStart * dayWidth;
          x2 = succEnd * dayWidth + dayWidth - 4;
          y1 = predRowY;
          y2 = succRowY;
          break;
        case "FS":
        default:
          // predecessor right edge -> successor left edge
          x1 = predEnd * dayWidth + dayWidth;
          x2 = succStart * dayWidth + 4;
          y1 = predRowY;
          y2 = succRowY;
          break;
      }

      arrows.push({
        key: `${predecessorId}-${successor.id}`,
        predecessorId,
        successorId: successor.id,
        x1,
        y1,
        x2,
        y2,
        depType,
      });
    }
  }

  if (arrows.length === 0) return null;

  const chartWidth = (totalDays + 1) * dayWidth;
  const clipId = "dep-arrows-clip";

  const handleClick = (predecessorId: string, successorId: string, predName: string, succName: string) => {
    if (!onRemoveDependency) return;
    // 削除確認: 誤タップ防止
    const ok = typeof window !== "undefined" && window.confirm
      ? window.confirm(`依存関係を解除しますか？\n先行: ${predName}\n後続: ${succName}`)
      : true;
    if (ok) onRemoveDependency(predecessorId, successorId);
  };

  return (
    // ルート SVG は pointer-events-none（バー本体のクリックを塞がない）。
    // 個別の <path> だけ pointer-events-auto でクリック可能にする。
    <svg
      className="pointer-events-none absolute inset-0 z-10"
      style={{ width: chartWidth, height: "100%" }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={chartWidth} height="100%" />
        </clipPath>
        {(Object.entries(DEP_STYLE) as Array<[DependencyType, typeof DEP_STYLE[DependencyType]]>).map(
          ([type, style]) => (
            <ArrowheadMarker key={type} id={style.markerId} color={style.stroke} />
          ),
        )}
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {arrows.map(({ key, predecessorId, successorId, x1, y1, x2, y2, depType }) => {
          const style = DEP_STYLE[depType];
          const cx = (x1 + x2) / 2;
          const d = `M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`;
          const predName = tasks.find((t) => t.id === predecessorId)?.name ?? predecessorId;
          const succName = tasks.find((t) => t.id === successorId)?.name ?? successorId;
          const clickable = Boolean(onRemoveDependency);
          return (
            <g key={key}>
              {/* 目視用の細い曲線 */}
              <path
                data-testid={`dep-arrow-${predecessorId}-${successorId}`}
                d={d}
                fill="none"
                stroke={style.stroke}
                strokeWidth="1.5"
                strokeOpacity="0.85"
                strokeDasharray={style.dasharray}
                markerEnd={`url(#${style.markerId})`}
                pointerEvents="none"
              />
              {/* クリック用の太い透明パス（ヒットエリア）。 */}
              {clickable && (
                <path
                  data-testid={`dep-arrow-hit-${predecessorId}-${successorId}`}
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="14"
                  className="pointer-events-auto cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleClick(predecessorId, successorId, predName, succName);
                  }}
                >
                  <title>{`依存: ${predName} → ${succName}（クリックで解除）`}</title>
                </path>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
