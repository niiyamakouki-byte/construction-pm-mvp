/**
 * Alert rules — budget, deadline, and safety alerts for construction projects.
 */

export type AlertType = "budget" | "deadline" | "safety";

export type AlertRule = {
  id: string;
  type: AlertType;
  projectId: string;
  condition: string;
  threshold: number;
  createdAt: string;
};

export type TriggeredAlert = {
  rule: AlertRule;
  message: string;
  triggeredAt: string;
};

export type ProjectData = {
  projectId: string;
  budget?: number;
  spent?: number;
  endDate?: string;
  safetyIncidents?: number;
};

let nextId = 1;

export function createBudgetAlert(
  projectId: string,
  threshold: number,
): AlertRule {
  return {
    id: `alert-${nextId++}`,
    type: "budget",
    projectId,
    condition: `spending exceeds ${threshold}% of budget`,
    threshold,
    createdAt: new Date().toISOString(),
  };
}

export function createDeadlineAlert(
  projectId: string,
  daysBefore: number,
): AlertRule {
  return {
    id: `alert-${nextId++}`,
    type: "deadline",
    projectId,
    condition: `deadline within ${daysBefore} days`,
    threshold: daysBefore,
    createdAt: new Date().toISOString(),
  };
}

export function createSafetyAlert(
  siteId: string,
  condition: string,
): AlertRule {
  return {
    id: `alert-${nextId++}`,
    type: "safety",
    projectId: siteId,
    condition,
    threshold: 1,
    createdAt: new Date().toISOString(),
  };
}

export function evaluateAlerts(
  rules: AlertRule[],
  projectData: ProjectData,
): TriggeredAlert[] {
  const triggered: TriggeredAlert[] = [];
  const now = new Date();

  for (const rule of rules) {
    if (rule.projectId !== projectData.projectId) continue;

    if (rule.type === "budget") {
      const budget = projectData.budget ?? 0;
      const spent = projectData.spent ?? 0;
      if (budget > 0) {
        const pct = (spent / budget) * 100;
        if (pct >= rule.threshold) {
          triggered.push({
            rule,
            message: `Budget alert: ${pct.toFixed(1)}% spent (threshold: ${rule.threshold}%)`,
            triggeredAt: now.toISOString(),
          });
        }
      }
    }

    if (rule.type === "deadline") {
      if (projectData.endDate) {
        const end = new Date(projectData.endDate);
        const daysLeft = Math.ceil(
          (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysLeft <= rule.threshold) {
          triggered.push({
            rule,
            message: `Deadline alert: ${daysLeft} days remaining (threshold: ${rule.threshold})`,
            triggeredAt: now.toISOString(),
          });
        }
      }
    }

    if (rule.type === "safety") {
      const incidents = projectData.safetyIncidents ?? 0;
      if (incidents >= rule.threshold) {
        triggered.push({
          rule,
          message: `Safety alert: ${incidents} incident(s) — ${rule.condition}`,
          triggeredAt: now.toISOString(),
        });
      }
    }
  }

  return triggered;
}

export function resetAlertIds(): void {
  nextId = 1;
}
