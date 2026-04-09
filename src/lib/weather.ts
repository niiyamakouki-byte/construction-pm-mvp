import type { Project } from "../domain/types.js";

export type OpenWeatherMapDailyForecast = {
  dt: number;
  sunrise?: number;
  sunset?: number;
  moonrise?: number;
  moonset?: number;
  moon_phase?: number;
  temp: {
    day: number;
    min: number;
    max: number;
    night?: number;
    eve?: number;
    morn?: number;
  };
  feels_like?: {
    day?: number;
    night?: number;
    eve?: number;
    morn?: number;
  };
  pressure?: number;
  humidity?: number;
  dew_point?: number;
  wind_speed: number;
  wind_deg?: number;
  wind_gust?: number;
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  clouds?: number;
  pop: number;
  rain?: number;
  uvi?: number;
};

export type OpenWeatherMapForecast = {
  lat: number;
  lon: number;
  timezone: string;
  timezone_offset: number;
  daily: OpenWeatherMapDailyForecast[];
  alerts?: Array<{
    sender_name: string;
    event: string;
    start: number;
    end: number;
    description: string;
    tags?: string[];
  }>;
};

export type ConstructionSiteForecast = {
  siteId: string;
  projectId?: string;
  siteName: string;
  locationLabel: string;
  forecast: OpenWeatherMapForecast;
};

export type WeatherRiskLevel = "normal" | "warning" | "danger";

export type DailyWeatherRisk = {
  level: WeatherRiskLevel;
  reasons: string[];
};

const DEFAULT_SITE = {
  siteId: "demo-site",
  siteName: "品川物流センター",
  locationLabel: "東京都港区港南",
  lat: 35.6285,
  lon: 139.7486,
};

const WEATHER_PATTERNS = [
  {
    icon: "10d",
    weather: { id: 500, main: "Rain", description: "light rain" },
    min: 23,
    max: 29,
    pop: 0.35,
    windSpeed: 5,
  },
  {
    icon: "04d",
    weather: { id: 803, main: "Clouds", description: "broken clouds" },
    min: 22,
    max: 28,
    pop: 0.2,
    windSpeed: 6,
  },
  {
    icon: "10d",
    weather: { id: 501, main: "Rain", description: "moderate rain" },
    min: 21,
    max: 27,
    pop: 0.68,
    windSpeed: 9,
  },
  {
    icon: "09d",
    weather: { id: 502, main: "Rain", description: "heavy rain" },
    min: 20,
    max: 25,
    pop: 0.84,
    windSpeed: 11,
  },
  {
    icon: "13d",
    weather: { id: 600, main: "Snow", description: "light snow" },
    min: 18,
    max: 24,
    pop: 0.15,
    windSpeed: 16.5,
  },
  {
    icon: "01d",
    weather: { id: 800, main: "Clear", description: "clear sky" },
    min: 24,
    max: 31,
    pop: 0.05,
    windSpeed: 4,
  },
  {
    icon: "02d",
    weather: { id: 801, main: "Clouds", description: "few clouds" },
    min: 25,
    max: 32,
    pop: 0.12,
    windSpeed: 7,
  },
] as const;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getLocalDateLabel(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getMonth() + 1}/${date.getDate()} (${weekdays[date.getDay()]})`;
}

export function getWeatherEmoji(iconCode: string | undefined): string {
  const icon = iconCode ?? "";
  if (icon.startsWith("01")) return "☀";
  if (icon.startsWith("02")) return "🌤";
  if (icon.startsWith("03") || icon.startsWith("04")) return "☁";
  if (icon.startsWith("09") || icon.startsWith("10")) return "🌧";
  if (icon.startsWith("11")) return "⛈";
  if (icon.startsWith("13")) return "❄";
  if (icon.startsWith("50")) return "🌫";
  return "🌡";
}

export function getDailyWeatherRisk(day: Pick<OpenWeatherMapDailyForecast, "pop" | "wind_speed">): DailyWeatherRisk {
  const reasons: string[] = [];

  if (day.pop > 0.8) {
    reasons.push(`降水確率 ${Math.round(day.pop * 100)}%`);
  } else if (day.pop > 0.6) {
    reasons.push(`雨に注意 ${Math.round(day.pop * 100)}%`);
  }

  if (day.wind_speed > 15) {
    reasons.push(`強風 ${day.wind_speed.toFixed(1)}m/s`);
  }

  if (day.pop > 0.8 || day.wind_speed > 15) {
    return { level: "danger", reasons };
  }

  if (day.pop > 0.6) {
    return { level: "warning", reasons };
  }

  return { level: "normal", reasons };
}

export function getConstructionRecommendation(day: Pick<OpenWeatherMapDailyForecast, "pop" | "wind_speed">): string {
  const risk = getDailyWeatherRisk(day);
  if (risk.level === "danger") {
    return "外装・揚重作業は延期推奨";
  }
  if (risk.level === "warning") {
    return "外装作業は予備日を確保";
  }
  return "通常施工を計画可能";
}

function createMockForecast(lat: number, lon: number, offset: number, baseDate: Date): OpenWeatherMapForecast {
  const dayZero = startOfDay(baseDate).getTime();

  return {
    lat,
    lon,
    timezone: "Asia/Tokyo",
    timezone_offset: 32400,
    daily: WEATHER_PATTERNS.map((pattern, index) => {
      const shifted = WEATHER_PATTERNS[(index + offset) % WEATHER_PATTERNS.length];
      const dt = Math.floor((dayZero + index * 24 * 60 * 60 * 1000) / 1000);
      const min = shifted.min + (offset % 2);
      const max = shifted.max + (offset % 3);
      return {
        dt,
        temp: {
          min,
          max,
          day: Math.round((min + max) / 2),
        },
        pop: Math.min(shifted.pop + (offset % 2) * 0.03, 0.95),
        wind_speed: Number((shifted.windSpeed + (offset % 3) * 0.6).toFixed(1)),
        weather: [
          {
            ...shifted.weather,
            icon: shifted.icon,
          },
        ],
        rain: shifted.pop > 0.2 ? Number((shifted.pop * 6).toFixed(1)) : undefined,
      };
    }),
  };
}

export function buildMockConstructionSiteForecasts(
  projects: Project[],
  baseDate = new Date(),
): ConstructionSiteForecast[] {
  const activeProjects = projects.filter(
    (project) => project.status === "active" || project.status === "planning",
  );

  const sites = activeProjects.length > 0
    ? activeProjects.map((project, index) => ({
        siteId: `weather-${project.id}`,
        projectId: project.id,
        siteName: project.name,
        locationLabel: project.address ?? "現場住所未設定",
        lat: project.latitude ?? DEFAULT_SITE.lat + index * 0.03,
        lon: project.longitude ?? DEFAULT_SITE.lon + index * 0.03,
        offset: index,
      }))
    : [
        {
          ...DEFAULT_SITE,
          offset: 0,
        },
      ];

  return sites.map((site) => ({
    siteId: site.siteId,
    projectId: "projectId" in site ? site.projectId : undefined,
    siteName: site.siteName,
    locationLabel: site.locationLabel,
    forecast: createMockForecast(site.lat, site.lon, site.offset, baseDate),
  }));
}

export type WeatherWarningItem = {
  siteId: string;
  projectId?: string;
  siteName: string;
  locationLabel: string;
  dateLabel: string;
  day: OpenWeatherMapDailyForecast;
  risk: DailyWeatherRisk;
};

export function collectWeatherWarnings(
  siteForecasts: ConstructionSiteForecast[],
  dayLimit = 3,
): WeatherWarningItem[] {
  return siteForecasts.flatMap((site) =>
    site.forecast.daily.slice(0, dayLimit).flatMap((day) => {
      const risk = getDailyWeatherRisk(day);
      if (risk.level === "normal") return [];
      return [
        {
          siteId: site.siteId,
          projectId: site.projectId,
          siteName: site.siteName,
          locationLabel: site.locationLabel,
          dateLabel: getLocalDateLabel(day.dt),
          day,
          risk,
        },
      ];
    }),
  );
}
