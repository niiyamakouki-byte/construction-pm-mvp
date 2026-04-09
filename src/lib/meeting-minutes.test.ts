import { beforeEach, describe, expect, it } from "vitest";
import {
  addMeetingActionItem,
  addMeetingAttendee,
  clearMeetingMinutes,
  createMeetingMinutes,
  generateMinutesReport, // used in tests below
  getMeetingMinutes, // used in tests below
} from "./meeting-minutes.js";

describe("meeting-minutes", () => {
  beforeEach(() => {
    clearMeetingMinutes();
  });

  it("creates meeting minutes records with generated ids", () => {
    const meeting = createMeetingMinutes({
      projectId: "proj-1",
      meetingDate: "2025-04-08",
      meetingType: "Weekly Coordination",
      facilitator: "PM",
      location: "Site Office",
      discussionPoints: ["Review slab pour sequence"],
    });

    expect(meeting.id).toBe("meeting-1");
    expect(meeting.attendees).toEqual([]);
    expect(meeting.actionItems).toEqual([]);
  });

  it("adds attendees and action items", () => {
    const meeting = createMeetingMinutes({
      projectId: "proj-1",
      meetingDate: "2025-04-08",
      meetingType: "Safety Walk",
      facilitator: "Superintendent",
      discussionPoints: ["Housekeeping", "Access routes"],
    });

    addMeetingAttendee(meeting.id, {
      name: "Aya Tanaka",
      company: "GC",
      role: "PM",
    });
    const updated = addMeetingActionItem(meeting.id, {
      description: "Install additional edge protection at west stair",
      owner: "Safety Manager",
      dueDate: "2025-04-10",
      status: "in_progress",
    });

    expect(updated.attendees).toHaveLength(1);
    expect(updated.actionItems).toHaveLength(1);
    expect(updated.actionItems[0].id).toBe("meeting-action-1");
    expect(updated.actionItems[0].status).toBe("in_progress");
  });

  it("filters by project and generates a printable report", () => {
    const meeting = createMeetingMinutes({
      projectId: "proj-1",
      meetingDate: "2025-04-09",
      meetingType: "Owner Meeting",
      facilitator: "Owner Rep",
      location: "Conference Room",
      discussionPoints: ["Approve mockup <A>", "Finalize lobby finishes"],
    });

    addMeetingAttendee(meeting.id, {
      name: "Ken Sato",
      company: "Architect",
      role: "Designer",
    });
    addMeetingActionItem(meeting.id, {
      description: "Issue revised finish schedule",
      owner: "Architect",
      dueDate: "2025-04-12",
    });

    const report = generateMinutesReport(meeting.id);

    expect(getMeetingMinutes("proj-1")).toHaveLength(1);
    expect(report).toContain("Meeting Minutes");
    expect(report).toContain("Ken Sato");
    expect(report).toContain("&lt;A&gt;");
    expect(report).toContain("Issue revised finish schedule");
  });

  it("retrieves meeting minutes filtered by projectId", () => {
    createMeetingMinutes({
      projectId: "proj-2",
      meetingDate: "2025-04-08",
      meetingType: "Safety Meeting",
      facilitator: "Safety Officer",
      discussionPoints: ["PPE compliance"],
    });
    createMeetingMinutes({
      projectId: "proj-99",
      meetingDate: "2025-04-09",
      meetingType: "Other",
      facilitator: "Other",
      discussionPoints: [],
    });

    const proj2 = getMeetingMinutes("proj-2");
    expect(proj2).toHaveLength(1);
    expect(proj2[0].meetingType).toBe("Safety Meeting");

    const all = getMeetingMinutes();
    expect(all).toHaveLength(2);
  });

  it("returns empty array for non-existent projectId", () => {
    expect(getMeetingMinutes("no-such-project")).toEqual([]);
  });

  it("generates HTML report with all sections", () => {
    const meeting = createMeetingMinutes({
      projectId: "proj-3",
      meetingDate: "2025-04-10",
      meetingType: "Weekly",
      facilitator: "PM",
      discussionPoints: ["Slab schedule"],
    });

    addMeetingAttendee(meeting.id, { name: "Niiyama", company: "Laporta" });
    addMeetingActionItem(meeting.id, {
      description: "Order concrete",
      owner: "Niiyama",
      dueDate: "2025-04-15",
    });

    const html = generateMinutesReport(meeting.id);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Niiyama");
    expect(html).toContain("Order concrete");
    expect(html).toContain("Slab schedule");
    expect(html).toContain("Weekly");
  });

  it("escapes HTML entities in generated report", () => {
    const meeting = createMeetingMinutes({
      projectId: "proj-4",
      meetingDate: "2025-04-10",
      meetingType: "<script>alert(1)</script>",
      facilitator: "PM",
      discussionPoints: ['Item with "quotes" & <tags>'],
    });

    const html = generateMinutesReport(meeting.id);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;tags&gt;");
  });
});
