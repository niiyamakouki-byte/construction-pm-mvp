import { useMemo, useState } from "react";
import type { AssignableMember } from "../lib/project-tasks-store.js";

export type AssigneeRoleFilter = "all" | "代表" | "専務" | "メンバー";

const ROLE_FILTERS: AssigneeRoleFilter[] = ["all", "代表", "専務", "メンバー"];

function normalizeRoleText(role: string | null | undefined): string {
  return (role ?? "").trim().toLowerCase();
}

export function classifyAssigneeRole(role: string | null | undefined): Exclude<AssigneeRoleFilter, "all"> {
  const normalizedRole = normalizeRoleText(role);

  if (["代表", "owner", "オーナー", "representative"].some((keyword) => normalizedRole.includes(keyword.toLowerCase()))) {
    return "代表";
  }

  if (["専務", "admin", "管理者", "director"].some((keyword) => normalizedRole.includes(keyword.toLowerCase()))) {
    return "専務";
  }

  return "メンバー";
}

function roleFilterLabel(filter: AssigneeRoleFilter): string {
  if (filter === "all") {
    return "全員";
  }
  return filter;
}

export interface AssigneeSelectorProps {
  members: AssignableMember[];
  value?: string;
  disabled?: boolean;
  onChange: (assigneeId: string | undefined) => void;
}

export function AssigneeSelector({
  members,
  value,
  disabled = false,
  onChange,
}: AssigneeSelectorProps) {
  const [roleFilter, setRoleFilter] = useState<AssigneeRoleFilter>("all");

  const visibleMembers = useMemo(() => {
    const selectedMember = members.find((member) => member.id === value);
    const filteredMembers = members.filter((member) => {
      if (roleFilter === "all") {
        return true;
      }
      return classifyAssigneeRole(member.role) === roleFilter;
    });

    if (selectedMember && !filteredMembers.some((member) => member.id === selectedMember.id)) {
      return [selectedMember, ...filteredMembers];
    }

    return filteredMembers;
  }, [members, roleFilter, value]);

  return (
    <div className="space-y-2" data-testid="assignee-selector">
      <div className="flex flex-wrap gap-1.5">
        {ROLE_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            data-testid={`assignee-role-filter-${filter}`}
            disabled={disabled}
            onClick={() => setRoleFilter(filter)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              roleFilter === filter
                ? "bg-[#7BA88A]/15 text-[#5E8A6C]"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {roleFilterLabel(filter)}
          </button>
        ))}
      </div>

      <select
        data-testid="assignee-select"
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || undefined)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-[#7BA88A] focus:outline-none disabled:bg-slate-50"
      >
        <option value="">未割当</option>
        {visibleMembers.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name} ({classifyAssigneeRole(member.role)})
          </option>
        ))}
      </select>
    </div>
  );
}
