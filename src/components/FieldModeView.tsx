/**
 * FieldModeView - Touch-friendly interface for field workers.
 * Designed for large buttons, glove-friendly interaction,
 * and minimal navigation on construction sites.
 */

type FieldModeAction = {
  key: string;
  label: string;
  icon: string;
  onClick: () => void;
};

type FieldModeViewProps = {
  projectName: string;
  projectId: string;
  onTakePhoto: () => void;
  onCheckSchedule: () => void;
  onDailyReport: () => void;
  onBack?: () => void;
  extraActions?: FieldModeAction[];
};

const fieldModeStyles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f5f5f5",
    padding: "16px",
    fontFamily: "sans-serif",
    fontSize: "18px",
  },
  header: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: "24px",
    padding: "16px",
    backgroundColor: "#1a56db",
    borderRadius: "12px",
    color: "white",
  },
  projectName: {
    fontSize: "24px",
    fontWeight: "bold" as const,
    margin: 0,
  },
  backButton: {
    fontSize: "18px",
    padding: "12px 20px",
    backgroundColor: "rgba(255,255,255,0.2)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
  actionsGrid: {
    display: "grid" as const,
    gridTemplateColumns: "1fr",
    gap: "16px",
    maxWidth: "600px",
    margin: "0 auto",
  },
  actionButton: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: "16px",
    minHeight: "80px",
    fontSize: "22px",
    fontWeight: "bold" as const,
    border: "none",
    borderRadius: "16px",
    cursor: "pointer",
    padding: "20px",
    color: "white",
  },
  icon: {
    fontSize: "32px",
  },
} as const;

const ACTION_COLORS = ["#059669", "#2563eb", "#d97706"] as const;

export function FieldModeView({
  projectName,
  projectId,
  onTakePhoto,
  onCheckSchedule,
  onDailyReport,
  onBack,
  extraActions,
}: FieldModeViewProps) {
  const coreActions: FieldModeAction[] = [
    { key: "photo", label: "写真撮影", icon: "📷", onClick: onTakePhoto },
    { key: "schedule", label: "工程確認", icon: "📋", onClick: onCheckSchedule },
    { key: "report", label: "日報入力", icon: "📝", onClick: onDailyReport },
  ];

  const allActions = extraActions
    ? [...coreActions, ...extraActions]
    : coreActions;

  return (
    <div style={fieldModeStyles.container} data-testid="field-mode-view">
      <div style={fieldModeStyles.header}>
        <div>
          <h1 style={fieldModeStyles.projectName}>{projectName}</h1>
          <span style={{ fontSize: "14px", opacity: 0.8 }}>
            現場モード - {projectId}
          </span>
        </div>
        {onBack && (
          <button
            type="button"
            style={fieldModeStyles.backButton}
            onClick={onBack}
            aria-label="戻る"
          >
            ← 戻る
          </button>
        )}
      </div>

      <div style={fieldModeStyles.actionsGrid}>
        {allActions.map((action, i) => (
          <button
            key={action.key}
            type="button"
            style={{
              ...fieldModeStyles.actionButton,
              backgroundColor:
                ACTION_COLORS[i % ACTION_COLORS.length],
            }}
            onClick={action.onClick}
            data-testid={`field-action-${action.key}`}
          >
            <span style={fieldModeStyles.icon}>{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
