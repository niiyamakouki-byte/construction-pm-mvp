import { useEffect, useMemo, useState } from "react";
import type { Project } from "../domain/types.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { navigate } from "../hooks/useHashRouter.js";
import {
  buildMockConstructionSiteForecasts,
  getConstructionRecommendation,
  getDailyWeatherRisk,
  getLocalDateLabel,
  getWeatherEmoji,
  type ConstructionSiteForecast,
  type OpenWeatherMapDailyForecast,
} from "../lib/weather.js";
import { createProjectRepository } from "../stores/project-store.js";
import { calculateRainDelay, type DailyForecast as WIForecast } from "../lib/weather-integration.js";

const riskCardMap = {
  normal: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-900",
    badge: "bg-emerald-100 text-emerald-700",
    label: "施工可",
  },
  warning: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-900",
    badge: "bg-amber-100 text-amber-700",
    label: "要注意",
  },
  danger: {
    border: "border-red-200",
    bg: "bg-red-50",
    text: "text-red-900",
    badge: "bg-red-100 text-red-700",
    label: "延期推奨",
  },
} as const;

function buildRiskSummary(days: OpenWeatherMapDailyForecast[]) {
  return days.reduce(
    (summary, day) => {
      const risk = getDailyWeatherRisk(day);
      if (risk.level === "danger") summary.danger += 1;
      else if (risk.level === "warning") summary.warning += 1;
      else summary.normal += 1;
      return summary;
    },
    { normal: 0, warning: 0, danger: 0 },
  );
}

function toWIForecast(day: OpenWeatherMapDailyForecast, date: string): WIForecast {
  const pop = day.pop ?? 0;
  const rain = day.rain ?? 0;
  const precipMm = rain > 0 ? rain : pop * 20; // estimate from probability
  const conditionMap: Record<string, WIForecast["condition"]> = {
    Thunderstorm: "storm",
    Drizzle: "rain",
    Rain: pop >= 0.8 ? "heavy_rain" : "rain",
    Snow: "snow",
    Fog: "fog",
    Mist: "fog",
    Clear: "clear",
    Clouds: "cloudy",
  };
  const mainWeather = day.weather[0]?.main ?? "Clear";
  const condition: WIForecast["condition"] = conditionMap[mainWeather] ?? (pop >= 0.6 ? "rain" : "clear");
  return {
    date,
    condition,
    tempHigh: day.temp.max,
    tempLow: day.temp.min,
    precipitationMm: precipMm,
    windSpeedKmh: day.wind_speed * 3.6,
  };
}

function ForecastDayCard({ day, date }: { day: OpenWeatherMapDailyForecast; date: string }) {
  const risk = getDailyWeatherRisk(day);
  const riskStyle = riskCardMap[risk.level];
  const weather = day.weather[0];
  const rainDelay = calculateRainDelay(toWIForecast(day, date));

  return (
    <article className={`rounded-[26px] border px-4 py-4 shadow-sm ${riskStyle.border} ${riskStyle.bg}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {getLocalDateLabel(day.dt)}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">
              {getWeatherEmoji(weather?.icon)}
            </span>
            <div>
              <p className={`text-lg font-bold ${riskStyle.text}`}>
                {Math.round(day.temp.max)}° / {Math.round(day.temp.min)}°
              </p>
              <p className="text-sm text-slate-600">
                {weather?.description ?? "forecast"}
              </p>
            </div>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${riskStyle.badge}`}>
          {riskStyle.label}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-2xl bg-white/80 px-3 py-3">
          <dt className="text-xs text-slate-500">気温</dt>
          <dd className="mt-1 font-semibold text-slate-900">{Math.round(day.temp.day)}°C</dd>
        </div>
        <div className="rounded-2xl bg-white/80 px-3 py-3">
          <dt className="text-xs text-slate-500">降水確率</dt>
          <dd className="mt-1 font-semibold text-slate-900">{Math.round(day.pop * 100)}%</dd>
        </div>
        <div className="rounded-2xl bg-white/80 px-3 py-3">
          <dt className="text-xs text-slate-500">風速</dt>
          <dd className="mt-1 font-semibold text-slate-900">{day.wind_speed.toFixed(1)}m/s</dd>
        </div>
      </dl>

      <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Construction Impact
        </p>
        <p className={`mt-1 text-sm font-semibold ${riskStyle.text}`}>
          {getConstructionRecommendation(day)}
        </p>
        {risk.reasons.length > 0 ? (
          <p className="mt-1 text-xs text-slate-600">{risk.reasons.join(" / ")}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-600">大きな天候制約は見込まれていません。</p>
        )}
        {rainDelay.delayHours > 0 && (
          <p className="mt-2 text-xs font-semibold text-amber-700">
            雨天遅延見込み: {rainDelay.delayHours}時間
            {rainDelay.canWorkIndoors ? "（屋内作業に切替可）" : ""}
          </p>
        )}
      </div>
    </article>
  );
}

function SiteSelector({
  sites,
  selectedSiteId,
  onSelect,
}: {
  sites: ConstructionSiteForecast[];
  selectedSiteId: string;
  onSelect: (siteId: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {sites.map((site) => {
        const active = site.siteId === selectedSiteId;
        return (
          <button
            key={site.siteId}
            type="button"
            onClick={() => onSelect(site.siteId)}
            className={`min-w-[14rem] rounded-2xl border px-4 py-3 text-left transition-colors ${
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-semibold">{site.siteName}</p>
            <p className={`mt-1 text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
              {site.locationLabel}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export function WeatherPage() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(
    () => createProjectRepository(() => organizationId),
    [organizationId],
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;

    async function loadProjects() {
      try {
        setLoadError(null);
        const data = await projectRepository.findAll();
        if (!disposed) {
          setProjects(data);
        }
      } catch (error) {
        if (!disposed) {
          setLoadError(error instanceof Error ? error.message : "天気情報の読み込みに失敗しました");
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    void loadProjects();
    return () => {
      disposed = true;
    };
  }, [projectRepository]);

  const siteForecasts = useMemo(
    () => buildMockConstructionSiteForecasts(projects),
    [projects],
  );

  useEffect(() => {
    if (siteForecasts.length === 0) return;
    setSelectedSiteId((current) => {
      if (current && siteForecasts.some((site) => site.siteId === current)) {
        return current;
      }
      return siteForecasts[0].siteId;
    });
  }, [siteForecasts]);

  const selectedSite = siteForecasts.find((site) => site.siteId === selectedSiteId) ?? siteForecasts[0];
  const selectedDays = selectedSite?.forecast.daily.slice(0, 7) ?? [];
  const summary = buildRiskSummary(selectedDays);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16" role="status" aria-label="天気予報を読み込み中">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        <span className="text-sm text-slate-500">天気予報を読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[30px] bg-[linear-gradient(145deg,#f4f8ff_0%,#fbfbf2_55%,#eef9f4_100%)] px-5 py-6 shadow-sm ring-1 ring-slate-200 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Weather Planning
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              現場天気
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              7日先までの降水確率と風速を見ながら、外装工事や揚重作業の可否を判断できます。現在はモックデータですが、
              `OpenWeatherMap One Call` の `daily` 形式をそのまま受け取れる構成です。
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/today")}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            今日のダッシュボードへ
          </button>
        </div>
      </section>

      {loadError ? (
        <div role="alert" className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      {selectedSite ? (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Site Selector
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">施工現場を選択</h2>
              </div>
              <p className="text-sm text-slate-500">{siteForecasts.length}現場</p>
            </div>
            <SiteSelector
              sites={siteForecasts}
              selectedSiteId={selectedSite.siteId}
              onSelect={setSelectedSiteId}
            />
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">施工可</p>
              <p className="mt-2 text-3xl font-bold text-emerald-900">{summary.normal}</p>
              <p className="mt-1 text-sm text-emerald-800">通常工程を維持できる日</p>
            </div>
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">要注意</p>
              <p className="mt-2 text-3xl font-bold text-amber-900">{summary.warning}</p>
              <p className="mt-1 text-sm text-amber-800">予備日を確保したい日</p>
            </div>
            <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">延期推奨</p>
              <p className="mt-2 text-3xl font-bold text-red-900">{summary.danger}</p>
              <p className="mt-1 text-sm text-red-800">外装工事を避けたい日</p>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Selected Site
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{selectedSite.siteName}</h2>
              </div>
              <p className="text-sm text-slate-500">{selectedSite.locationLabel}</p>
            </div>
            <div className="mt-4 rounded-[24px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              降水確率が60%を超える日は外装工程を再確認してください。80%超または風速15m/s超は延期候補として扱います。
            </div>
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            {selectedDays.map((day) => (
              <ForecastDayCard key={day.dt} day={day} date={new Date(day.dt * 1000).toISOString().slice(0, 10)} />
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
