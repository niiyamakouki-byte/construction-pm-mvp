import type { GanttTask } from "./types.js";
import { daysBetween } from "./utils.js";
import { gantt } from "../../theme/index.js";

type Props = {
  tasks: GanttTask[];
  chartStart: string;
  dayWidth: number;
  totalDays: number;
};

/** SVG overlay that draws FS dependency arrows between task bars. */
export function DependencyArrows({ tasks, chartStart, dayWidth, totalDays }: Props) {
  const { rowHeight, headerHeight } = gantt;
  const taskMap = new Map(tasks.map((t, i) => [t.id, { task: t, index: i }]));

  const arrows: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }> = [];

  for (const { task: successor, index: successorIndex } of taskMap.values()) {
    for (const predecessorId of successor.dependencies ?? []) {
      const predecessorEntry = taskMap.get(predecessorId);
      if (!predecessorEntry) continue;

      const { task: predecessor, index: predecessorIndex } = predecessorEntry;

      // x1 = right edge of predecessor bar
      const predEnd = daysBetween(chartStart, predecessor.endDate);
      const x1 = predEnd * dayWidth + dayWidth;

      // x2 = left edge of successor bar
      const succStart = daysBetween(chartStart, successor.startDate);
      const x2 = succStart * dayWidth + 4;

      // y center of each bar row (accounting for header)
      const y1 = headerHeight + predecessorIndex * rowHeight + rowHeight / 2;
      const y2 = headerHeight + successorIndex * rowHeight + rowHeight / 2;

      arrows.push({ key: `${predecessorId}-${successor.id}`, x1, y1, x2, y2 });
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
        <marker
          id="dep-arrowhead"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" opacity="0.85" />
        </marker>
      </defs>
      {arrows.map(({ key, x1, y1, x2, y2 }) => {
        const cx = (x1 + x2) / 2;
        const d = `M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`;
        return (
          <path
            key={key}
            d={d}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeOpacity="0.75"
            markerEnd="url(#dep-arrowhead)"
          />
        );
      })}
    </svg>
  );
}
