export type KyActivity = {
  id: string;
  date: string;
  participants: string[];
  hazards: string[];
  countermeasures: string[];
  createdAt: string;
};

export type NearMissReport = {
  id: string;
  datetime: string;
  location: string;
  description: string;
  severity: "high" | "medium" | "low";
  causeAnalysis: string;
  countermeasure: string;
  createdAt: string;
};

// In-memory stores
const kyActivities: KyActivity[] = [];
const nearMissReports: NearMissReport[] = [];

export function listKyActivities(): KyActivity[] {
  return [...kyActivities].sort((a, b) => b.date.localeCompare(a.date));
}

export function addKyActivity(
  entry: Omit<KyActivity, "id" | "createdAt">,
): KyActivity {
  const record: KyActivity = {
    ...entry,
    id: `ky-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  kyActivities.push(record);
  return record;
}

export function listNearMissReports(): NearMissReport[] {
  return [...nearMissReports].sort((a, b) =>
    b.datetime.localeCompare(a.datetime),
  );
}

export function addNearMissReport(
  entry: Omit<NearMissReport, "id" | "createdAt">,
): NearMissReport {
  const record: NearMissReport = {
    ...entry,
    id: `nm-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  nearMissReports.push(record);
  return record;
}

export function clearAllRecords(): void {
  kyActivities.length = 0;
  nearMissReports.length = 0;
}
