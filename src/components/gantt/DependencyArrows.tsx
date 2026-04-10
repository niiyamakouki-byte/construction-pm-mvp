import type { DependencyType } from "../../domain/types.js";
import type { GanttTask } from "./types.js";
import { daysBetween } from "./utils.js";
import { gantt } from "../../theme/index.js";

type Props = {
  tasks: GanttTask[];
  chartStart: string;
  dayWidth: number;
  totalDays: number;
};

type ArrowSpec = {
  key: string;
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
  SS:   { stroke: "#10b981", dasharray: "2 2 8 2", markerId: "dep-arrow-SS" },
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
export function DependencyArrows({ tasks, chartStart, dayWidth, totalDays }: Props) {
  const { rowHeight, headerHeight } = gantt;
  const taskMap = new Map(tasks.map((t, i) => [t.id, { task: t, index: i }]));

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

      const predRowY = headerHeight + predecessorIndex * rowHeight + rowHeight / 2;
      const succRowY = headerHeight + successorIndex * rowHeight + rowHeight / 2;

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

      arrows.push({ key: `${predecessorId}-${successor.id}`, x1, y1, x2, y2, depType });
    }
  }

  if (arrows.length === 0) return null;

  const chartWidth = (totalDays + 1) * dayWidth;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10"
      style={{ width: chartWidth, height: "100%" }}
      overflow="visible"
    >
      <defs>
        {(Object.entries(DEP_STYLE) as Array<[DependencyType, typeof DEP_STYLE[DependencyType]]>).map(
          ([type, style]) => (
            <ArrowheadMarker key={type} id={style.markerId} color={style.stroke} />
          ),
        )}
      </defs>
      {arrows.map(({ key, x1, y1, x2, y2, depType }) => {
        const style = DEP_STYLE[depType];
        const cx = (x1 + x2) / 2;
        const d = `M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`;
        return (
          <path
            key={key}
            d={d}
            fill="none"
            stroke={style.stroke}
            strokeWidth="1.5"
            strokeOpacity="0.85"
            strokeDasharray={style.dasharray}
            markerEnd={`url(#${style.markerId})`}
          />
        );
      })}
    </svg>
  );
}
