/**
 * Crew Board module for GenbaHub.
 * Calendar-style crew assignment management — who goes to which site, when.
 * Distilled from ANDPAD's "Board" feature.
 */

export type JobType =
  | "大工"
  | "電気"
  | "配管"
  | "内装"
  | "塗装"
  | "左官"
  | "鉄筋"
  | "型枠"
  | "設備"
  | "その他";

export type CrewMember = {
  id: string;
  name: string;
  company: string;
  jobType: JobType;
  phone?: string;
  skills: string[];
};

export type CrewAssignment = {
  id: string;
  memberId: string;
  projectId: string;
  projectName: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  note?: string;
};

// In-memory store (matches pattern of other lib modules in this codebase)
const members: CrewMember[] = [];
const assignments: CrewAssignment[] = [];
let memberCounter = 0;
let assignmentCounter = 0;

// ---------------------------------------------------------------------------
// CrewMember CRUD
// ---------------------------------------------------------------------------

export function addCrewMember(
  member: Omit<CrewMember, "id">,
): CrewMember {
  if (!member.name.trim()) throw new Error("name is required");
  memberCounter += 1;
  const newMember: CrewMember = {
    ...member,
    name: member.name.trim(),
    company: member.company.trim(),
    id: `member-${memberCounter}`,
  };
  members.push(newMember);
  return { ...newMember, skills: [...newMember.skills] };
}

export function updateCrewMember(
  id: string,
  patch: Partial<Omit<CrewMember, "id">>,
): CrewMember | null {
  const member = members.find((m) => m.id === id);
  if (!member) return null;
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new Error("name is required");
    member.name = patch.name.trim();
  }
  if (patch.company !== undefined) member.company = patch.company.trim();
  if (patch.jobType !== undefined) member.jobType = patch.jobType;
  if (patch.phone !== undefined) member.phone = patch.phone;
  if (patch.skills !== undefined) member.skills = [...patch.skills];
  return { ...member, skills: [...member.skills] };
}

export function getCrewMember(id: string): CrewMember | null {
  return members.find((m) => m.id === id) ?? null;
}

export function getAllCrewMembers(): CrewMember[] {
  return [...members];
}

// ---------------------------------------------------------------------------
// CrewAssignment CRUD
// ---------------------------------------------------------------------------

export function addAssignment(
  assignment: Omit<CrewAssignment, "id">,
): CrewAssignment {
  if (!assignment.memberId) throw new Error("memberId is required");
  if (!assignment.projectId) throw new Error("projectId is required");
  if (!assignment.date) throw new Error("date is required");

  assignmentCounter += 1;
  const newAssignment: CrewAssignment = {
    ...assignment,
    id: `assign-${assignmentCounter}`,
  };
  assignments.push(newAssignment);
  return newAssignment;
}

export function removeAssignment(id: string): boolean {
  const index = assignments.findIndex((a) => a.id === id);
  if (index === -1) return false;
  assignments.splice(index, 1);
  return true;
}

export function moveAssignment(
  id: string,
  newDate: string,
  newProjectId?: string,
  newProjectName?: string,
): CrewAssignment | null {
  const index = assignments.findIndex((a) => a.id === id);
  if (index === -1) return null;
  const updated: CrewAssignment = {
    ...assignments[index],
    date: newDate,
    ...(newProjectId !== undefined && { projectId: newProjectId }),
    ...(newProjectName !== undefined && { projectName: newProjectName }),
  };
  assignments[index] = updated;
  return { ...updated };
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

export function getAssignmentsByDate(date: string): CrewAssignment[] {
  return assignments.filter((a) => a.date === date);
}

export function getAssignmentsByMember(memberId: string): CrewAssignment[] {
  return assignments.filter((a) => a.memberId === memberId);
}

export function getAssignmentsByProject(projectId: string): CrewAssignment[] {
  return assignments.filter((a) => a.projectId === projectId);
}

/**
 * Returns all assignments within an inclusive date range [startDate, endDate].
 * Dates are YYYY-MM-DD strings; lexicographic comparison works for ISO dates.
 */
export function getDateRange(
  startDate: string,
  endDate: string,
): CrewAssignment[] {
  return assignments.filter(
    (a) => a.date >= startDate && a.date <= endDate,
  );
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

/**
 * Returns existing assignments that conflict with the given memberId + date.
 * A conflict is when the same person is already assigned to a different
 * project on the same day (double-booking).
 * Pass an optional excludeId to ignore the assignment being updated.
 */
export function checkConflict(
  memberId: string,
  date: string,
  excludeId?: string,
): CrewAssignment[] {
  return assignments.filter(
    (a) =>
      a.memberId === memberId &&
      a.date === date &&
      a.id !== excludeId,
  );
}

// ---------------------------------------------------------------------------
// Utilization
// ---------------------------------------------------------------------------

/**
 * Returns the utilization rate of a member as a fraction [0, 1].
 * Utilization = assigned working days / total working days (Mon–Sat)
 * in the given date range.
 */
export function getUtilizationRate(
  memberId: string,
  startDate: string,
  endDate: string,
): number {
  const workingDays = countWorkingDays(startDate, endDate);
  if (workingDays === 0) return 0;

  // Unique dates the member is assigned within the range
  const assignedDates = new Set(
    getAssignmentsByMember(memberId)
      .filter((a) => a.date >= startDate && a.date <= endDate)
      .map((a) => a.date),
  );

  return assignedDates.size / workingDays;
}

/** Count Mon–Sat days (6-day work week typical in construction) in [start, end]. */
function countWorkingDays(startDate: string, endDate: string): number {
  let count = 0;
  const current = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  while (current <= end) {
    const day = current.getUTCDay(); // 0=Sun,6=Sat
    if (day !== 0) count += 1; // exclude Sunday only
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
}

// ---------------------------------------------------------------------------
// HTML board output
// ---------------------------------------------------------------------------

/**
 * Generates a calendar-style HTML table for the crew board.
 * Rows = crew members, columns = dates in the given range.
 */
export function buildCrewBoardHtml(
  startDate: string,
  endDate: string,
): string {
  const dates = buildDateList(startDate, endDate);
  const allMembers = getAllCrewMembers();

  const headerCells = dates
    .map((d) => {
      const label = d.slice(5); // MM-DD
      return `<th>${label}</th>`;
    })
    .join("");

  const rows = allMembers
    .map((member) => {
      const cells = dates
        .map((date) => {
          const dayAssignments = assignments.filter(
            (a) => a.memberId === member.id && a.date === date,
          );
          if (dayAssignments.length === 0) return "<td></td>";
          const content = dayAssignments
            .map((a) => `<span class="assignment">${escapeHtml(a.projectName)}</span>`)
            .join("<br>");
          return `<td>${content}</td>`;
        })
        .join("");
      return `<tr><td class="member-name">${escapeHtml(member.name)}</td><td class="job-type">${escapeHtml(member.jobType)}</td>${cells}</tr>`;
    })
    .join("");

  return `<table class="crew-board">
<thead><tr><th>氏名</th><th>職種</th>${headerCells}</tr></thead>
<tbody>${rows}</tbody>
</table>`;
}

function buildDateList(startDate: string, endDate: string): string[] {
  const result: string[] = [];
  // Parse as UTC to avoid local-timezone date shift
  const current = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  while (current <= end) {
    result.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Reset (for testing)
// ---------------------------------------------------------------------------

export function _resetCrewBoard(): void {
  members.length = 0;
  assignments.length = 0;
  memberCounter = 0;
  assignmentCounter = 0;
}
