import { describe, expect, it, beforeEach } from "vitest";
import type { Task } from "../domain/types.js";
import {
  createChangeOrder,
  getChangeOrders,
  clearChangeOrders,
  assessImpact,
  generateChangeLog,
  type ChangeOrder,
} from "./change-order-tracker.js";

function makeTask(overrides: Partial<Task> & Pick<Task, "id" | "name">): Task {
  return {
    id: overrides.id,
    projectId: "proj-1",
    name: overrides.name,
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeOrder(overrides: Partial<ChangeOrder> = {}): ChangeOrder {
  return {
    id: "co-1",
    projectId: "proj-1",
    description: "Add extra wall outlet",
    requestedBy: "Owner",
    dateRequested: "2025-02-01",
    impact: {
      costDelta: 50000,
      scheduleDeltaDays: 2,
      affectedTaskIds: ["t1"],
    },
    status: "pending",
    ...overrides,
  };
}

describe("change-order-tracker", () => {
  beforeEach(() => {
    clearChangeOrders();
  });

  describe("createChangeOrder", () => {
    it("stores and returns the change order", () => {
      const order = makeOrder();
      const result = createChangeOrder(order);
      expect(result.id).toBe("co-1");
      expect(result.description).toBe("Add extra wall outlet");
    });

    it("allows multiple change orders", () => {
      createChangeOrder(makeOrder({ id: "co-1" }));
      createChangeOrder(makeOrder({ id: "co-2", description: "Change tile material" }));
      const all = getChangeOrders();
      expect(all).toHaveLength(2);
    });
  });

  describe("getChangeOrders", () => {
    it("filters by projectId", () => {
      createChangeOrder(makeOrder({ id: "co-1", projectId: "proj-1" }));
      createChangeOrder(makeOrder({ id: "co-2", projectId: "proj-2" }));
      const proj1 = getChangeOrders("proj-1");
      expect(proj1).toHaveLength(1);
      expect(proj1[0].id).toBe("co-1");
    });

    it("returns all when no projectId", () => {
      createChangeOrder(makeOrder({ id: "co-1", projectId: "proj-1" }));
      createChangeOrder(makeOrder({ id: "co-2", projectId: "proj-2" }));
      expect(getChangeOrders()).toHaveLength(2);
    });
  });

  describe("assessImpact", () => {
    it("returns cost and schedule impact", () => {
      const order = makeOrder({
        impact: { costDelta: 300000, scheduleDeltaDays: 5, affectedTaskIds: ["t1"] },
      });
      const tasks = [makeTask({ id: "t1", name: "Electrical" })];
      const result = assessImpact(order, tasks);

      expect(result.estimatedCostImpact).toBe(300000);
      expect(result.estimatedScheduleImpact).toBe(5);
      expect(result.affectedTasks).toHaveLength(1);
    });

    it("classifies low risk", () => {
      const order = makeOrder({
        impact: { costDelta: 10000, scheduleDeltaDays: 1, affectedTaskIds: [] },
      });
      const result = assessImpact(order, []);
      expect(result.riskLevel).toBe("low");
    });

    it("classifies medium risk", () => {
      const order = makeOrder({
        impact: { costDelta: 600000, scheduleDeltaDays: 3, affectedTaskIds: [] },
      });
      const result = assessImpact(order, []);
      expect(result.riskLevel).toBe("medium");
    });

    it("classifies high risk for large cost", () => {
      const order = makeOrder({
        impact: { costDelta: 2000000, scheduleDeltaDays: 1, affectedTaskIds: [] },
      });
      const result = assessImpact(order, []);
      expect(result.riskLevel).toBe("high");
    });

    it("classifies high risk for long schedule delay", () => {
      const order = makeOrder({
        impact: { costDelta: 1000, scheduleDeltaDays: 21, affectedTaskIds: [] },
      });
      const result = assessImpact(order, []);
      expect(result.riskLevel).toBe("high");
    });
  });

  describe("generateChangeLog", () => {
    it("returns entries with cumulative impact", () => {
      createChangeOrder(makeOrder({
        id: "co-1",
        dateRequested: "2025-02-01",
        impact: { costDelta: 50000, scheduleDeltaDays: 2, affectedTaskIds: [] },
      }));
      createChangeOrder(makeOrder({
        id: "co-2",
        dateRequested: "2025-02-15",
        impact: { costDelta: 100000, scheduleDeltaDays: 3, affectedTaskIds: [] },
      }));

      const log = generateChangeLog("proj-1");
      expect(log).toHaveLength(2);
      expect(log[0].cumulativeCostDelta).toBe(50000);
      expect(log[0].cumulativeScheduleDelta).toBe(2);
      expect(log[1].cumulativeCostDelta).toBe(150000);
      expect(log[1].cumulativeScheduleDelta).toBe(5);
    });

    it("returns empty for unknown project", () => {
      createChangeOrder(makeOrder({ projectId: "proj-1" }));
      const log = generateChangeLog("proj-999");
      expect(log).toEqual([]);
    });

    it("sorts by dateRequested", () => {
      createChangeOrder(makeOrder({
        id: "co-2",
        dateRequested: "2025-03-01",
      }));
      createChangeOrder(makeOrder({
        id: "co-1",
        dateRequested: "2025-01-15",
      }));
      const log = generateChangeLog("proj-1");
      expect(log[0].order.id).toBe("co-1");
      expect(log[1].order.id).toBe("co-2");
    });
  });
});
