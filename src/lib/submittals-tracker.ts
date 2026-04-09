export type SubmittalStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected";

export type SubmittalReviewAction =
  | "submitted"
  | "reviewed"
  | "approved"
  | "rejected";

export type SubmittalReviewEntry = {
  id: string;
  action: SubmittalReviewAction;
  actor: string;
  timestamp: string;
  comments?: string;
};

export type Submittal = {
  id: string;
  projectId: string;
  specSection: string;
  materialName: string;
  submittedBy: string;
  submittedAt: string;
  supplier?: string;
  dueDate?: string;
  status: SubmittalStatus;
  assignedReviewer?: string;
  assignedReviewerRole?: string;
  reviewHistory: SubmittalReviewEntry[];
};

export type CreateSubmittalInput = Omit<
  Submittal,
  "id" | "status" | "submittedAt" | "reviewHistory"
> & {
  id?: string;
  status?: Exclude<SubmittalStatus, "approved" | "rejected">;
  submittedAt?: string;
};

export type SubmittalReviewInput = {
  reviewer: string;
  reviewerRole?: string;
  reviewedAt?: string;
  comments?: string;
};

export type SubmittalLogEntry = {
  id: string;
  materialName: string;
  specSection: string;
  status: SubmittalStatus;
  submittedAt: string;
  dueDate?: string;
  assignedReviewer?: string;
  reviewCycles: number;
  turnaroundDays: number | null;
};

const submittals: Submittal[] = [];
let submittalCounter = 1;
let reviewCounter = 1;

function nextSubmittalId(): string {
  const id = `submittal-${submittalCounter}`;
  submittalCounter += 1;
  return id;
}

function nextReviewId(): string {
  const id = `submittal-review-${reviewCounter}`;
  reviewCounter += 1;
  return id;
}

function getNow(): string {
  return new Date().toISOString();
}

function cloneSubmittal(submittal: Submittal): Submittal {
  return {
    ...submittal,
    reviewHistory: submittal.reviewHistory.map((entry) => ({ ...entry })),
  };
}

function findSubmittalIndex(submittalId: string): number {
  return submittals.findIndex((submittal) => submittal.id === submittalId);
}

function calculateTurnaroundDays(start: string, end: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / msPerDay;
  return Math.round(diff * 10) / 10;
}

export function createSubmittal(input: CreateSubmittalInput): Submittal {
  const submittedAt = input.submittedAt ?? getNow();
  const status = input.status ?? "submitted";
  const submittal: Submittal = {
    ...input,
    id: input.id ?? nextSubmittalId(),
    submittedAt,
    status,
    reviewHistory: [
      {
        id: nextReviewId(),
        action: "submitted",
        actor: input.submittedBy,
        timestamp: submittedAt,
        comments: `${input.materialName} submitted`,
      },
    ],
  };

  submittals.push(submittal);
  return cloneSubmittal(submittal);
}

export function getSubmittals(projectId?: string): Submittal[] {
  const items = projectId
    ? submittals.filter((submittal) => submittal.projectId === projectId)
    : submittals;

  return items.map((submittal) => cloneSubmittal(submittal));
}

export function reviewSubmittal(
  submittalId: string,
  review: SubmittalReviewInput,
): Submittal {
  const submittalIndex = findSubmittalIndex(submittalId);
  if (submittalIndex < 0) {
    throw new Error(`Submittal not found: ${submittalId}`);
  }

  const reviewedAt = review.reviewedAt ?? getNow();
  const updated: Submittal = {
    ...submittals[submittalIndex],
    status: "under_review",
    assignedReviewer: review.reviewer,
    assignedReviewerRole: review.reviewerRole,
    reviewHistory: [
      ...submittals[submittalIndex].reviewHistory,
      {
        id: nextReviewId(),
        action: "reviewed",
        actor: review.reviewer,
        timestamp: reviewedAt,
        comments: review.comments,
      },
    ],
  };

  submittals[submittalIndex] = updated;
  return cloneSubmittal(updated);
}

function finalizeSubmittal(
  submittalId: string,
  status: "approved" | "rejected",
  review: SubmittalReviewInput,
): Submittal {
  const submittalIndex = findSubmittalIndex(submittalId);
  if (submittalIndex < 0) {
    throw new Error(`Submittal not found: ${submittalId}`);
  }

  const reviewedAt = review.reviewedAt ?? getNow();
  const updated: Submittal = {
    ...submittals[submittalIndex],
    status,
    assignedReviewer: review.reviewer,
    assignedReviewerRole:
      review.reviewerRole ?? submittals[submittalIndex].assignedReviewerRole,
    reviewHistory: [
      ...submittals[submittalIndex].reviewHistory,
      {
        id: nextReviewId(),
        action: status,
        actor: review.reviewer,
        timestamp: reviewedAt,
        comments: review.comments,
      },
    ],
  };

  submittals[submittalIndex] = updated;
  return cloneSubmittal(updated);
}

export function approveSubmittal(
  submittalId: string,
  review: SubmittalReviewInput,
): Submittal {
  return finalizeSubmittal(submittalId, "approved", review);
}

export function rejectSubmittal(
  submittalId: string,
  review: SubmittalReviewInput,
): Submittal {
  return finalizeSubmittal(submittalId, "rejected", review);
}

export function generateSubmittalsLog(projectId: string): SubmittalLogEntry[] {
  return getSubmittals(projectId)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    .map((submittal) => {
      const finalDecision = [...submittal.reviewHistory]
        .reverse()
        .find((entry) => entry.action === "approved" || entry.action === "rejected");

      return {
        id: submittal.id,
        materialName: submittal.materialName,
        specSection: submittal.specSection,
        status: submittal.status,
        submittedAt: submittal.submittedAt,
        dueDate: submittal.dueDate,
        assignedReviewer: submittal.assignedReviewer,
        reviewCycles: submittal.reviewHistory.filter((entry) => entry.action === "reviewed")
          .length,
        turnaroundDays: finalDecision
          ? calculateTurnaroundDays(submittal.submittedAt, finalDecision.timestamp)
          : null,
      };
    });
}

export function clearSubmittals(): void {
  submittals.length = 0;
  submittalCounter = 1;
  reviewCounter = 1;
}
