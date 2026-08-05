import { useMemo, useState } from "react";
import { CalendarPlus, MapPin } from "lucide-react";
import { EmptyState } from "../components/EmptyState.js";
import { useGoogleCalendar } from "../hooks/useGoogleCalendar.js";
import { createProjectRepository } from "../stores/project-store.js";
import { geocodeAddress } from "../infra/geocode.js";
import { navigate } from "../hooks/useHashRouter.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { writeLastProjectId } from "../lib/last-project.js";
import { readImportedEventIds, markEventImported } from "../lib/calendar-import-tracker.js";
import { toFriendlyErrorMessage } from "../lib/friendly-error.js";
import type { GoogleCalendarEvent } from "../lib/google-calendar.js";

const RANGE_DAYS = 30;

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const eventDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
});
const eventTimeFormatter = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" });

function formatEventWhen(event: GoogleCalendarEvent): string {
  const datePart = eventDateFormatter.format(event.start);
  if (event.allDay) return `${datePart}・終日`;
  return `${datePart}・${eventTimeFormatter.format(event.start)}`;
}

/**
 * カレンダー起点の案件登録導線 (bd fyi0b)。
 *
 * 設計判断:
 * 1. 予定と案件は1(案件):N(予定)を将来形として想定するが、本画面が作るのは
 *    「予定→新規の軽量案件」の一発変換のみ。既存案件へ予定を追加で紐づける
 *    機能はスコープ外(YAGNI、別票)。
 * 2. 予定→案件は作成時点の一回コピー。以降どちらかが変更されても他方は
 *    追従しない(ライブ同期なし)。カレンダーが先に確定した実務順(オーナー
 *    ワークフロー)を初期値として尊重しつつ、案件を正とする以降の編集は
 *    案件側で完結させるため。双方向同期は別票の将来対応。
 */
export function CalendarInboxPage() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(() => createProjectRepository(() => organizationId), [organizationId]);
  const range = useMemo(() => {
    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(timeMin.getDate() - 1);
    const timeMax = new Date(now);
    timeMax.setDate(timeMax.getDate() + RANGE_DAYS);
    return { timeMin, timeMax };
  }, []);
  const calendar = useGoogleCalendar(range);
  const [importedIds, setImportedIds] = useState<Set<string>>(() => readImportedEventIds());
  const [creatingEventId, setCreatingEventId] = useState<string | null>(null);
  const [createdProjectIdByEvent, setCreatedProjectIdByEvent] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const sortedEvents = useMemo(
    () => [...calendar.events].sort((a, b) => a.start.getTime() - b.start.getTime()),
    [calendar.events],
  );

  const handleCreateProject = async (event: GoogleCalendarEvent) => {
    setError(null);
    setCreatingEventId(event.id);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (event.location) {
        const geocode = await geocodeAddress(event.location);
        if (geocode) {
          latitude = geocode.lat;
          longitude = geocode.lon;
        }
      }

      const projectId = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      await projectRepository.create({
        id: projectId,
        name: event.summary,
        description: `Googleカレンダーの予定「${event.summary}」から作成`,
        address: event.location,
        latitude,
        longitude,
        status: "planning",
        mode: "memo",
        startDate: toLocalDateString(event.start),
        includeWeekends: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      markEventImported(event.id);
      setImportedIds(readImportedEventIds());
      setCreatedProjectIdByEvent((prev) => ({ ...prev, [event.id]: projectId }));
    } catch (err) {
      setError(toFriendlyErrorMessage(err, "案件の作成に失敗しました"));
    } finally {
      setCreatingEventId(null);
    }
  };

  const openProject = (projectId: string) => {
    writeLastProjectId(projectId);
    navigate(`/project/${projectId}`);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] bg-[linear-gradient(145deg,#fffaf2_0%,#f6fbff_56%,#eff6ff_100%)] px-4 py-5 shadow-sm ring-1 ring-slate-200 sm:px-6">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500">CALENDAR</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">カレンダーから案件登録</h1>
        <p className="mt-2 text-sm text-slate-500">
          現場予定はまずGoogleカレンダーに入れて、そこから1タップで案件を作る導線です。工程の作り込みは案件を開いてから。
        </p>
      </section>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!calendar.connected ? (
        <EmptyState
          icon={<CalendarPlus size={22} strokeWidth={1.75} />}
          title="Googleカレンダーと連携していません"
          description="連携すると、直近の予定がここに並び、1タップで案件化できます。連携はアカウント設定から行えます。"
        />
      ) : calendar.needsReconnect ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
          <span>Google連携の有効期限が切れました</span>
          <button
            type="button"
            onClick={() => { void calendar.reconnect(); }}
            className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700"
          >
            再連携
          </button>
        </div>
      ) : calendar.loading ? (
        <div className="flex items-center justify-center gap-2 py-16" role="status" aria-label="読み込み中">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#007AFF]/30 border-t-[#007AFF]" />
          <span className="text-sm text-slate-400">予定を取得しています…</span>
        </div>
      ) : sortedEvents.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus size={22} strokeWidth={1.75} />}
          title="直近30日に予定がありません"
          description="Googleカレンダーに現場予定を入れると、ここに並んで1タップで案件化できます。"
        />
      ) : (
        <div className="grid gap-3">
          {sortedEvents.map((event) => {
            const alreadyImported = importedIds.has(event.id);
            const createdProjectId = createdProjectIdByEvent[event.id];
            return (
              <div
                key={event.id}
                className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200 sm:px-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-400">{formatEventWhen(event)}</p>
                    <h2 className="mt-0.5 truncate text-base font-semibold text-slate-900">{event.summary}</h2>
                    {event.location ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin size={12} aria-hidden="true" />
                        {event.location}
                      </p>
                    ) : null}
                  </div>
                  {alreadyImported && createdProjectId ? (
                    <button
                      type="button"
                      onClick={() => openProject(createdProjectId)}
                      className="shrink-0 rounded-2xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600"
                    >
                      案件化済み・開く
                    </button>
                  ) : alreadyImported ? (
                    <span className="shrink-0 rounded-2xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
                      案件化済み
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleCreateProject(event)}
                      disabled={creatingEventId === event.id}
                      className="ios-btn-primary shrink-0 px-4 py-2 text-xs disabled:opacity-60"
                    >
                      {creatingEventId === event.id ? "作成中…" : "この予定を案件化"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
