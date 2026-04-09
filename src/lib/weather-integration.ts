/**
 * Weather integration: forecast fetching, rain delay calculation, schedule adjustment.
 */

export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "rain"
  | "heavy_rain"
  | "storm"
  | "snow"
  | "fog";

export type DailyForecast = {
  date: string;
  condition: WeatherCondition;
  tempHigh: number;
  tempLow: number;
  precipitationMm: number;
  windSpeedKmh: number;
};

export type RainDelay = {
  date: string;
  delayHours: number;
  reason: string;
  canWorkIndoors: boolean;
};

export type ScheduleAdjustment = {
  originalDate: string;
  suggestedDate: string;
  reason: string;
  severity: "low" | "medium" | "high";
};

export type ForecastResult = {
  location: string;
  fetchedAt: string;
  forecasts: DailyForecast[];
};

// ── Fetch forecast (mock wrapper) ─────────────────────

export function fetchForecast(
  location: string,
  days: number = 7,
  mockData?: DailyForecast[],
): ForecastResult {
  const forecasts = mockData ?? generateDefaultForecast(days);
  return {
    location,
    fetchedAt: new Date().toISOString(),
    forecasts: forecasts.slice(0, days),
  };
}

function generateDefaultForecast(days: number): DailyForecast[] {
  const conditions: WeatherCondition[] = [
    "clear",
    "cloudy",
    "rain",
    "clear",
    "clear",
    "cloudy",
    "clear",
  ];
  const result: DailyForecast[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    result.push({
      date: d.toISOString().slice(0, 10),
      condition: conditions[i % conditions.length],
      tempHigh: 25 + (i % 3),
      tempLow: 15 + (i % 2),
      precipitationMm: conditions[i % conditions.length] === "rain" ? 12 : 0,
      windSpeedKmh: 10 + i * 2,
    });
  }
  return result;
}

// ── Rain delay calculator ─────────────────────────────

export function calculateRainDelay(forecast: DailyForecast): RainDelay {
  let delayHours = 0;
  let reason = "No delay";
  let canWorkIndoors = true;

  if (
    forecast.condition === "heavy_rain" ||
    forecast.condition === "storm"
  ) {
    delayHours = 8; // Full day
    reason = `${forecast.condition} — outdoor work suspended`;
    canWorkIndoors = forecast.condition !== "storm";
  } else if (forecast.condition === "rain") {
    if (forecast.precipitationMm > 20) {
      delayHours = 6;
      reason = "Heavy rain — most outdoor work delayed";
    } else if (forecast.precipitationMm > 5) {
      delayHours = 3;
      reason = "Moderate rain — exterior finishing delayed";
    } else {
      delayHours = 1;
      reason = "Light rain — minor delays";
    }
  } else if (forecast.condition === "snow") {
    delayHours = 4;
    reason = "Snow — outdoor work limited";
  } else if (forecast.windSpeedKmh > 50) {
    delayHours = 4;
    reason = "High wind — crane and elevated work suspended";
  }

  return {
    date: forecast.date,
    delayHours,
    reason,
    canWorkIndoors,
  };
}

// ── Schedule adjustment suggestion ────────────────────

export function suggestScheduleAdjustment(
  forecasts: DailyForecast[],
  taskDate: string,
  isOutdoorWork: boolean = true,
): ScheduleAdjustment | null {
  const taskForecast = forecasts.find((f) => f.date === taskDate);
  if (!taskForecast) return null;

  const delay = calculateRainDelay(taskForecast);
  if (delay.delayHours === 0) return null;
  if (!isOutdoorWork && delay.canWorkIndoors) return null;

  // Find next clear day
  const taskIdx = forecasts.indexOf(taskForecast);
  let suggestedDate = taskDate;
  let severity: "low" | "medium" | "high" = "low";

  for (let i = taskIdx + 1; i < forecasts.length; i++) {
    const nextDelay = calculateRainDelay(forecasts[i]);
    if (nextDelay.delayHours <= 1) {
      suggestedDate = forecasts[i].date;
      break;
    }
  }

  if (delay.delayHours >= 6) severity = "high";
  else if (delay.delayHours >= 3) severity = "medium";

  return {
    originalDate: taskDate,
    suggestedDate,
    reason: delay.reason,
    severity,
  };
}
