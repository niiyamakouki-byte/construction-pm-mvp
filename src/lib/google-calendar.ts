/**
 * Google Calendar REST v3 を呼び出す薄いラッパー。
 * Supabase OAuth で取得した provider_token を渡して `primary` カレンダーの
 * 予定を取得する。失敗時のハンドリングは呼び出し側で行う。
 *
 * - 401 → GoogleAuthExpiredError（再連携バナー表示の判定に使う）
 * - その他のエラー → GoogleCalendarError
 */

/** Google Calendar 連携で再ログイン（再連携）が必要な状態 */
export class GoogleAuthExpiredError extends Error {
  constructor(message = "Google authentication expired") {
    super(message);
    this.name = "GoogleAuthExpiredError";
  }
}

/** Google Calendar API がそれ以外のエラーを返した時 */
export class GoogleCalendarError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GoogleCalendarError";
    this.status = status;
  }
}

/** UI/重なり判定で扱いやすい正規化済みイベント */
export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  start: Date;
  end: Date;
  /** 終日イベント（Google API では start.date / end.date のみ来る） */
  allDay: boolean;
};

/** Google Calendar API の event レスポンス（必要な部分だけ） */
type RawGoogleEvent = {
  id?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
};

type RawEventsResponse = {
  items?: RawGoogleEvent[];
};

function normalizeEvent(raw: RawGoogleEvent): GoogleCalendarEvent | null {
  if (!raw.id) return null;
  const summary = raw.summary ?? "(無題)";

  // 終日イベント: start.date / end.date は YYYY-MM-DD 形式（end は exclusive）
  if (raw.start?.date && raw.end?.date) {
    const start = new Date(`${raw.start.date}T00:00:00`);
    const end = new Date(`${raw.end.date}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { id: raw.id, summary, start, end, allDay: true };
  }

  // 時刻指定イベント
  if (raw.start?.dateTime && raw.end?.dateTime) {
    const start = new Date(raw.start.dateTime);
    const end = new Date(raw.end.dateTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { id: raw.id, summary, start, end, allDay: false };
  }

  return null;
}

/**
 * primary カレンダーの予定を期間指定で取得する。
 * @param accessToken Supabase OAuth で受け取った provider_token
 * @param timeMin 開始日時（含む）
 * @param timeMax 終了日時（含む）
 */
export async function fetchPrimaryCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401) {
    throw new GoogleAuthExpiredError();
  }
  if (!response.ok) {
    throw new GoogleCalendarError(response.status, `Google Calendar API error: ${response.status}`);
  }

  const body = (await response.json()) as RawEventsResponse;
  const items = body.items ?? [];
  const normalized: GoogleCalendarEvent[] = [];
  for (const raw of items) {
    const ev = normalizeEvent(raw);
    if (ev) normalized.push(ev);
  }
  return normalized;
}
