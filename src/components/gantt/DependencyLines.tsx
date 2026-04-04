type DependencyLine = {
  fromTaskId: string;
  toTaskId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type Props = {
  lines: DependencyLine[];
  totalDays: number;
  dayWidth: number;
};

export function DependencyLines({ lines, totalDays, dayWidth }: Props) {
  if (lines.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: totalDays * dayWidth, height: "100%" }}
      overflow="visible"
    >
      <defs>
        <marker
          id="dep-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#7c3aed" opacity="0.7" />
        </marker>
      </defs>
      {lines.map((line) => {
        const cx = (line.x1 + line.x2) / 2;
        const d = `M ${line.x1} ${line.y1} C ${cx} ${line.y1} ${cx} ${line.y2} ${line.x2} ${line.y2}`;
        return (
          <path
            key={`${line.fromTaskId}-${line.toTaskId}`}
            d={d}
            fill="none"
            stroke="#7c3aed"
            strokeWidth="1.5"
            strokeOpacity="0.6"
            markerEnd="url(#dep-arrow)"
          />
        );
      })}
    </svg>
  );
}
