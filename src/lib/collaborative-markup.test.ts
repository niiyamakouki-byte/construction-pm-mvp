import { beforeEach, describe, expect, it } from "vitest";
import {
  addLayer,
  addMarkup,
  addReply,
  buildMarkupReportHtml,
  createSession,
  exportMarkupsCSV,
  getMarkupsByAuthor,
  getMarkupsByLayer,
  getMarkupsByStatus,
  getMarkupSummary,
  getUnresolvedMarkups,
  lockLayer,
  mergeMarkupSessions,
  resetCounters,
  toggleLayerVisibility,
  updateMarkupStatus,
} from "./collaborative-markup.js";

describe("collaborative-markup", () => {
  beforeEach(() => {
    resetCounters();
  });

  // ---- Session creation ---------------------------------------------------

  describe("createSession", () => {
    it("creates a session with generated id and creator as participant", () => {
      const session = createSession("drawing-1", "proj-1", "Alice");
      expect(session.id).toBe("session-1");
      expect(session.drawingId).toBe("drawing-1");
      expect(session.projectId).toBe("proj-1");
      expect(session.participants).toContain("Alice");
      expect(session.layers).toHaveLength(0);
      expect(session.markups).toHaveLength(0);
    });

    it("assigns sequential ids to multiple sessions", () => {
      const s1 = createSession("d-1", "p-1", "Alice");
      const s2 = createSession("d-2", "p-1", "Bob");
      expect(s1.id).toBe("session-1");
      expect(s2.id).toBe("session-2");
    });
  });

  // ---- Layer management --------------------------------------------------

  describe("addLayer", () => {
    it("adds a layer to the session", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Structural", "#ff0000", "Alice");
      expect(session.layers).toHaveLength(1);
      expect(session.layers[0].name).toBe("Structural");
      expect(session.layers[0].id).toBe("layer-1");
      expect(session.layers[0].visible).toBe(true);
      expect(session.layers[0].locked).toBe(false);
    });

    it("adds multiple layers with sequential ids", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Layer A", "#ff0000", "Alice");
      session = addLayer(session, "Layer B", "#00ff00", "Bob");
      expect(session.layers).toHaveLength(2);
      expect(session.layers[0].id).toBe("layer-1");
      expect(session.layers[1].id).toBe("layer-2");
    });
  });

  describe("toggleLayerVisibility", () => {
    it("toggles layer visible flag", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "MEP", "#0000ff", "Alice");
      const layerId = session.layers[0].id;

      session = toggleLayerVisibility(session, layerId);
      expect(session.layers[0].visible).toBe(false);

      session = toggleLayerVisibility(session, layerId);
      expect(session.layers[0].visible).toBe(true);
    });

    it("throws on unknown layer id", () => {
      const session = createSession("drawing-1", "proj-1", "Alice");
      expect(() => toggleLayerVisibility(session, "layer-999")).toThrow(
        "Layer not found: layer-999",
      );
    });
  });

  describe("lockLayer", () => {
    it("locks a layer", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Approved", "#cccccc", "Alice");
      const layerId = session.layers[0].id;
      session = lockLayer(session, layerId);
      expect(session.layers[0].locked).toBe(true);
    });

    it("throws on unknown layer id", () => {
      const session = createSession("drawing-1", "proj-1", "Alice");
      expect(() => lockLayer(session, "layer-999")).toThrow(
        "Layer not found: layer-999",
      );
    });
  });

  // ---- Markup CRUD -------------------------------------------------------

  describe("addMarkup", () => {
    it("adds a markup to the session", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Review", "#ff0000", "Alice");
      session = addMarkup(session, {
        pageNumber: 1,
        type: "callout",
        position: { x: 100, y: 200 },
        content: "Check this detail",
        author: "Alice",
        status: "open",
        color: "#ff0000",
        layer: "Review",
      });
      expect(session.markups).toHaveLength(1);
      expect(session.markups[0].id).toBe("markup-1");
      expect(session.markups[0].drawingId).toBe("drawing-1");
      expect(session.markups[0].replies).toHaveLength(0);
    });

    it("defaults status to open when not provided", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Layer A", "#aaa", "Alice");
      session = addMarkup(session, {
        pageNumber: 1,
        type: "highlight",
        position: { x: 0, y: 0 },
        content: "Highlight this",
        author: "Alice",
        color: "#ffff00",
        layer: "Layer A",
      });
      expect(session.markups[0].status).toBe("open");
    });

    it("adds new author to participants", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Layer A", "#aaa", "Alice");
      session = addMarkup(session, {
        pageNumber: 1,
        type: "text",
        position: { x: 0, y: 0 },
        content: "Note",
        author: "Bob",
        color: "#000",
        layer: "Layer A",
      });
      expect(session.participants).toContain("Bob");
    });

    it("throws when layer does not exist", () => {
      const session = createSession("drawing-1", "proj-1", "Alice");
      expect(() =>
        addMarkup(session, {
          pageNumber: 1,
          type: "cloud",
          position: { x: 0, y: 0 },
          content: "Invalid",
          author: "Alice",
          color: "#ff0000",
          layer: "NonExistent",
        }),
      ).toThrow("Layer does not exist: NonExistent");
    });

    it("throws when layer is locked", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Locked Layer", "#ccc", "Alice");
      const layerId = session.layers[0].id;
      session = lockLayer(session, layerId);

      expect(() =>
        addMarkup(session, {
          pageNumber: 1,
          type: "arrow",
          position: { x: 0, y: 0 },
          content: "Should fail",
          author: "Alice",
          color: "#ff0000",
          layer: "Locked Layer",
        }),
      ).toThrow("Layer is locked: Locked Layer");
    });
  });

  describe("updateMarkupStatus", () => {
    it("updates markup status", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Review", "#ff0000", "Alice");
      session = addMarkup(session, {
        pageNumber: 1,
        type: "callout",
        position: { x: 0, y: 0 },
        content: "Review item",
        author: "Alice",
        color: "#ff0000",
        layer: "Review",
      });
      const markupId = session.markups[0].id;
      session = updateMarkupStatus(session, markupId, "accepted", "Bob");
      expect(session.markups[0].status).toBe("accepted");
    });

    it("throws on unknown markup id", () => {
      const session = createSession("drawing-1", "proj-1", "Alice");
      expect(() =>
        updateMarkupStatus(session, "markup-999", "resolved", "Alice"),
      ).toThrow("Markup not found: markup-999");
    });

    it("throws when markup layer is locked", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Approved", "#ccc", "Alice");
      session = addMarkup(session, {
        pageNumber: 1,
        type: "stamp",
        position: { x: 0, y: 0 },
        content: "Approved stamp",
        author: "Alice",
        color: "#ccc",
        layer: "Approved",
      });
      const markupId = session.markups[0].id;
      const layerId = session.layers[0].id;
      session = lockLayer(session, layerId);

      expect(() =>
        updateMarkupStatus(session, markupId, "rejected", "Bob"),
      ).toThrow("Layer is locked: Approved");
    });
  });

  describe("addReply", () => {
    it("adds a reply to a markup thread", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Review", "#ff0000", "Alice");
      session = addMarkup(session, {
        pageNumber: 2,
        type: "cloud",
        position: { x: 50, y: 50 },
        content: "Needs clarification",
        author: "Alice",
        color: "#ff0000",
        layer: "Review",
      });
      const markupId = session.markups[0].id;
      session = addReply(session, markupId, "Bob", "Clarified in RFI-42");
      expect(session.markups[0].replies).toHaveLength(1);
      expect(session.markups[0].replies[0].id).toBe("reply-1");
      expect(session.markups[0].replies[0].author).toBe("Bob");
      expect(session.markups[0].replies[0].content).toBe("Clarified in RFI-42");
    });

    it("adds replier to participants", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Layer A", "#aaa", "Alice");
      session = addMarkup(session, {
        pageNumber: 1,
        type: "text",
        position: { x: 0, y: 0 },
        content: "Note",
        author: "Alice",
        color: "#000",
        layer: "Layer A",
      });
      const markupId = session.markups[0].id;
      session = addReply(session, markupId, "Carol", "Acknowledged");
      expect(session.participants).toContain("Carol");
    });

    it("throws on unknown markup id", () => {
      const session = createSession("drawing-1", "proj-1", "Alice");
      expect(() =>
        addReply(session, "markup-999", "Bob", "Reply"),
      ).toThrow("Markup not found: markup-999");
    });
  });

  // ---- Filtering ---------------------------------------------------------

  describe("getMarkupsByStatus", () => {
    it("filters markups by status", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Layer A", "#aaa", "Alice");
      session = addMarkup(session, {
        pageNumber: 1,
        type: "callout",
        position: { x: 0, y: 0 },
        content: "Open item",
        author: "Alice",
        status: "open",
        color: "#f00",
        layer: "Layer A",
      });
      session = addMarkup(session, {
        pageNumber: 2,
        type: "cloud",
        position: { x: 10, y: 10 },
        content: "Resolved item",
        author: "Bob",
        status: "resolved",
        color: "#0f0",
        layer: "Layer A",
      });

      const open = getMarkupsByStatus(session, "open");
      expect(open).toHaveLength(1);
      expect(open[0].content).toBe("Open item");

      const resolved = getMarkupsByStatus(session, "resolved");
      expect(resolved).toHaveLength(1);
    });
  });

  describe("getMarkupsByAuthor", () => {
    it("filters markups by author", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Layer A", "#aaa", "Alice");
      session = addMarkup(session, {
        pageNumber: 1,
        type: "text",
        position: { x: 0, y: 0 },
        content: "Alice markup",
        author: "Alice",
        color: "#f00",
        layer: "Layer A",
      });
      session = addMarkup(session, {
        pageNumber: 1,
        type: "arrow",
        position: { x: 5, y: 5 },
        content: "Bob markup",
        author: "Bob",
        color: "#00f",
        layer: "Layer A",
      });

      expect(getMarkupsByAuthor(session, "Alice")).toHaveLength(1);
      expect(getMarkupsByAuthor(session, "Bob")).toHaveLength(1);
      expect(getMarkupsByAuthor(session, "Carol")).toHaveLength(0);
    });
  });

  describe("getMarkupsByLayer", () => {
    it("filters markups by layer name", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Structural", "#f00", "Alice");
      session = addLayer(session, "MEP", "#00f", "Alice");
      session = addMarkup(session, {
        pageNumber: 1,
        type: "dimension",
        position: { x: 0, y: 0 },
        content: "Beam depth",
        author: "Alice",
        color: "#f00",
        layer: "Structural",
      });
      session = addMarkup(session, {
        pageNumber: 1,
        type: "callout",
        position: { x: 5, y: 5 },
        content: "Pipe conflict",
        author: "Alice",
        color: "#00f",
        layer: "MEP",
      });

      expect(getMarkupsByLayer(session, "Structural")).toHaveLength(1);
      expect(getMarkupsByLayer(session, "MEP")).toHaveLength(1);
      expect(getMarkupsByLayer(session, "Nonexistent")).toHaveLength(0);
    });
  });

  describe("getUnresolvedMarkups", () => {
    it("returns open and for_review markups only", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Layer A", "#aaa", "Alice");
      const statuses = [
        "open",
        "for_review",
        "accepted",
        "rejected",
        "resolved",
      ] as const;
      for (const status of statuses) {
        session = addMarkup(session, {
          pageNumber: 1,
          type: "text",
          position: { x: 0, y: 0 },
          content: `${status} item`,
          author: "Alice",
          status,
          color: "#000",
          layer: "Layer A",
        });
      }

      const unresolved = getUnresolvedMarkups(session);
      expect(unresolved).toHaveLength(2);
      expect(unresolved.map((m) => m.status)).toEqual(
        expect.arrayContaining(["open", "for_review"]),
      );
    });
  });

  // ---- Summary statistics ------------------------------------------------

  describe("getMarkupSummary", () => {
    it("returns correct counts for empty session", () => {
      const session = createSession("drawing-1", "proj-1", "Alice");
      const summary = getMarkupSummary(session);
      expect(summary.total).toBe(0);
      expect(summary.byStatus.open).toBe(0);
      expect(summary.byStatus.resolved).toBe(0);
    });

    it("correctly aggregates by status, author, type, and layer", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Structural", "#f00", "Alice");
      session = addLayer(session, "MEP", "#00f", "Alice");

      session = addMarkup(session, {
        pageNumber: 1,
        type: "callout",
        position: { x: 0, y: 0 },
        content: "Item 1",
        author: "Alice",
        status: "open",
        color: "#f00",
        layer: "Structural",
      });
      session = addMarkup(session, {
        pageNumber: 2,
        type: "cloud",
        position: { x: 10, y: 10 },
        content: "Item 2",
        author: "Alice",
        status: "resolved",
        color: "#0f0",
        layer: "Structural",
      });
      session = addMarkup(session, {
        pageNumber: 3,
        type: "callout",
        position: { x: 20, y: 20 },
        content: "Item 3",
        author: "Bob",
        status: "for_review",
        color: "#00f",
        layer: "MEP",
      });

      const summary = getMarkupSummary(session);
      expect(summary.total).toBe(3);
      expect(summary.byStatus.open).toBe(1);
      expect(summary.byStatus.resolved).toBe(1);
      expect(summary.byStatus.for_review).toBe(1);
      expect(summary.byStatus.accepted).toBe(0);
      expect(summary.byAuthor["Alice"]).toBe(2);
      expect(summary.byAuthor["Bob"]).toBe(1);
      expect(summary.byType["callout"]).toBe(2);
      expect(summary.byType["cloud"]).toBe(1);
      expect(summary.byLayer["Structural"]).toBe(2);
      expect(summary.byLayer["MEP"]).toBe(1);
    });
  });

  // ---- CSV export --------------------------------------------------------

  describe("exportMarkupsCSV", () => {
    it("generates CSV header and rows", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Layer A", "#aaa", "Alice");
      session = addMarkup(session, {
        pageNumber: 3,
        type: "highlight",
        position: { x: 0, y: 0 },
        content: "Check dimensions",
        author: "Alice",
        status: "open",
        color: "#ff0",
        layer: "Layer A",
      });

      const csv = exportMarkupsCSV(session);
      const lines = csv.split("\n");
      expect(lines[0]).toBe("id,page,type,content,author,status,date");
      expect(lines[1]).toContain("markup-1");
      expect(lines[1]).toContain("highlight");
      expect(lines[1]).toContain("Alice");
      expect(lines[1]).toContain("open");
    });

    it("quotes content with commas", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Layer A", "#aaa", "Alice");
      session = addMarkup(session, {
        pageNumber: 1,
        type: "text",
        position: { x: 0, y: 0 },
        content: "See detail, page 5",
        author: "Bob",
        color: "#000",
        layer: "Layer A",
      });

      const csv = exportMarkupsCSV(session);
      expect(csv).toContain('"See detail, page 5"');
    });

    it("returns only header for empty session", () => {
      const session = createSession("drawing-1", "proj-1", "Alice");
      const csv = exportMarkupsCSV(session);
      expect(csv).toBe("id,page,type,content,author,status,date");
    });
  });

  // ---- HTML report -------------------------------------------------------

  describe("buildMarkupReportHtml", () => {
    it("generates HTML with project and drawing name", () => {
      const session = createSession("drawing-1", "proj-1", "Alice");
      const html = buildMarkupReportHtml(session, {
        projectName: "KDX Minami-Aoyama",
        drawingName: "Floor Plan A1",
      });
      expect(html).toContain("KDX Minami-Aoyama");
      expect(html).toContain("Floor Plan A1");
      expect(html).toContain("<!DOCTYPE html>");
    });

    it("escapes HTML special characters in content", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Layer A", "#aaa", "Alice");
      session = addMarkup(session, {
        pageNumber: 1,
        type: "callout",
        position: { x: 0, y: 0 },
        content: "<script>alert('xss')</script>",
        author: "Attacker <evil>",
        color: "#f00",
        layer: "Layer A",
      });

      const html = buildMarkupReportHtml(session, {
        projectName: "Proj & Co",
        drawingName: "Sheet \"A\"",
      });
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain("Proj &amp; Co");
      expect(html).toContain("Sheet &quot;A&quot;");
      expect(html).toContain("Attacker &lt;evil&gt;");
    });

    it("groups markups by status with reply threads", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Review", "#f00", "Alice");
      session = addMarkup(session, {
        pageNumber: 1,
        type: "cloud",
        position: { x: 0, y: 0 },
        content: "Open item",
        author: "Alice",
        status: "open",
        color: "#f00",
        layer: "Review",
      });
      const markupId = session.markups[0].id;
      session = addReply(session, markupId, "Bob", "Will fix tomorrow");

      const html = buildMarkupReportHtml(session, {
        projectName: "Test Project",
        drawingName: "Sheet 01",
      });
      expect(html).toContain("Open item");
      expect(html).toContain("Will fix tomorrow");
      expect(html).toContain("class=\"replies\"");
    });
  });

  // ---- Session merging ---------------------------------------------------

  describe("mergeMarkupSessions", () => {
    it("merges markups and layers from multiple sessions", () => {
      let s1 = createSession("drawing-1", "proj-1", "Alice");
      s1 = addLayer(s1, "Structural", "#f00", "Alice");
      s1 = addMarkup(s1, {
        pageNumber: 1,
        type: "callout",
        position: { x: 0, y: 0 },
        content: "S1 item",
        author: "Alice",
        color: "#f00",
        layer: "Structural",
      });

      let s2 = createSession("drawing-2", "proj-1", "Bob");
      s2 = addLayer(s2, "MEP", "#00f", "Bob");
      s2 = addMarkup(s2, {
        pageNumber: 2,
        type: "cloud",
        position: { x: 5, y: 5 },
        content: "S2 item",
        author: "Bob",
        color: "#00f",
        layer: "MEP",
      });

      const merged = mergeMarkupSessions([s1, s2]);
      expect(merged.markups).toHaveLength(2);
      expect(merged.layers).toHaveLength(2);
      expect(merged.participants).toContain("Alice");
      expect(merged.participants).toContain("Bob");
    });

    it("deduplicates layers with the same name across sessions", () => {
      let s1 = createSession("drawing-1", "proj-1", "Alice");
      s1 = addLayer(s1, "Shared", "#f00", "Alice");
      s1 = addMarkup(s1, {
        pageNumber: 1,
        type: "text",
        position: { x: 0, y: 0 },
        content: "Item from s1",
        author: "Alice",
        color: "#f00",
        layer: "Shared",
      });

      let s2 = createSession("drawing-2", "proj-1", "Bob");
      s2 = addLayer(s2, "Shared", "#00f", "Bob");
      s2 = addMarkup(s2, {
        pageNumber: 2,
        type: "arrow",
        position: { x: 5, y: 5 },
        content: "Item from s2",
        author: "Bob",
        color: "#00f",
        layer: "Shared",
      });

      const merged = mergeMarkupSessions([s1, s2]);
      expect(merged.layers.filter((l) => l.name === "Shared")).toHaveLength(1);
      expect(merged.markups).toHaveLength(2);
    });

    it("throws when given zero sessions", () => {
      expect(() => mergeMarkupSessions([])).toThrow(
        "Cannot merge zero sessions",
      );
    });
  });

  // ---- Edge cases --------------------------------------------------------

  describe("edge cases", () => {
    it("empty session summary has all statuses at zero", () => {
      const session = createSession("drawing-1", "proj-1", "Alice");
      const summary = getMarkupSummary(session);
      expect(summary.byStatus.open).toBe(0);
      expect(summary.byStatus.accepted).toBe(0);
      expect(summary.byStatus.rejected).toBe(0);
      expect(summary.byStatus.resolved).toBe(0);
      expect(summary.byStatus.for_review).toBe(0);
    });

    it("getUnresolvedMarkups returns empty array for fully resolved session", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Layer A", "#aaa", "Alice");
      session = addMarkup(session, {
        pageNumber: 1,
        type: "stamp",
        position: { x: 0, y: 0 },
        content: "Done",
        author: "Alice",
        status: "resolved",
        color: "#0f0",
        layer: "Layer A",
      });
      expect(getUnresolvedMarkups(session)).toHaveLength(0);
    });

    it("supports point-based markup types", () => {
      let session = createSession("drawing-1", "proj-1", "Alice");
      session = addLayer(session, "Layer A", "#aaa", "Alice");
      session = addMarkup(session, {
        pageNumber: 1,
        type: "polyline",
        position: { x: 0, y: 0 },
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 50 },
          { x: 200, y: 0 },
        ],
        content: "Polyline markup",
        author: "Alice",
        color: "#f00",
        layer: "Layer A",
      });
      expect(session.markups[0].points).toHaveLength(3);
    });
  });
});
