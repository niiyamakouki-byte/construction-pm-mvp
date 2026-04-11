/**
 * GPS EXIF metadata management for construction site photos.
 * Supports embedding, extracting, and analyzing location data from photos.
 */

import type { BlackboardData } from "./digital-blackboard.js";

export type ExifData = {
  latitude: number; // decimal degrees, positive = N
  longitude: number; // decimal degrees, positive = E
  altitude?: number; // meters above sea level
  timestamp: string; // ISO datetime
  deviceModel?: string;
  blackboardId?: string;
};

export type PhotoWithExif = {
  id: string;
  url: string;
  exif: ExifData;
};

export type DmsCoordinate = {
  degrees: number;
  minutes: number;
  seconds: number;
  direction: "N" | "S" | "E" | "W";
};

/**
 * Embed GPS EXIF metadata into a photo record.
 * Returns a new PhotoWithExif combining the photo data and GPS info.
 */
export function embedGpsExif(
  photoData: { id: string; url: string },
  exifData: ExifData,
): PhotoWithExif {
  return {
    id: photoData.id,
    url: photoData.url,
    exif: { ...exifData },
  };
}

/**
 * Extract GPS ExifData from a BlackboardData record.
 * BlackboardData carries location as a free-text field; this parses
 * decimal-degree coordinates embedded in the location string as
 * "lat:35.6762,lng:139.6503" or falls back to zeros when absent.
 */
export function extractExifFromBlackboard(blackboardData: BlackboardData & {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  deviceModel?: string;
  blackboardId?: string;
}): ExifData {
  const lat = blackboardData.latitude ?? parseCoordFromLocation(blackboardData.location, "lat");
  const lng = blackboardData.longitude ?? parseCoordFromLocation(blackboardData.location, "lng");

  return {
    latitude: lat,
    longitude: lng,
    altitude: blackboardData.altitude,
    timestamp: blackboardData.shootDate + "T00:00:00.000Z",
    deviceModel: blackboardData.deviceModel,
    blackboardId: blackboardData.blackboardId,
  };
}

function parseCoordFromLocation(location: string, key: "lat" | "lng"): number {
  const pattern = key === "lat" ? /lat:([-\d.]+)/ : /lng:([-\d.]+)/;
  const match = location.match(pattern);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Format ExifData coordinates as human-readable degree/minute/second strings.
 * Returns an object with latDms and lngDms strings (e.g. "35°40′33.9″N").
 */
export function formatExifForDisplay(exifData: ExifData): {
  latDms: string;
  lngDms: string;
  altitude: string;
  timestamp: string;
} {
  const latDms = decimalToDms(Math.abs(exifData.latitude), exifData.latitude >= 0 ? "N" : "S");
  const lngDms = decimalToDms(Math.abs(exifData.longitude), exifData.longitude >= 0 ? "E" : "W");
  const altitude = exifData.altitude !== undefined ? `${exifData.altitude.toFixed(1)}m` : "不明";
  const timestamp = new Date(exifData.timestamp).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return { latDms, lngDms, altitude, timestamp };
}

function decimalToDms(decimal: number, direction: "N" | "S" | "E" | "W"): string {
  const degrees = Math.floor(decimal);
  const minutesDecimal = (decimal - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = (minutesDecimal - minutes) * 60;
  return `${degrees}°${minutes}′${seconds.toFixed(1)}″${direction}`;
}

/**
 * Convert decimal degrees to DMS (degree/minute/second) components.
 */
export function decimalToDmsComponents(
  decimal: number,
  isLatitude: boolean,
): DmsCoordinate {
  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutesDecimal = (abs - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = (minutesDecimal - minutes) * 60;

  let direction: "N" | "S" | "E" | "W";
  if (isLatitude) {
    direction = decimal >= 0 ? "N" : "S";
  } else {
    direction = decimal >= 0 ? "E" : "W";
  }

  return { degrees, minutes, seconds, direction };
}

const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Calculate the great-circle distance in meters between two GPS coordinates
 * using the Haversine formula.
 */
export function calculateDistance(a: ExifData, b: ExifData): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinDLng * sinDLng;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/**
 * Group photos by proximity.
 * Photos within radiusMeters of the first photo in a group are placed together.
 * Returns groups in insertion order.
 */
export function groupPhotosByLocation(
  photos: PhotoWithExif[],
  radiusMeters: number,
): Array<{ center: ExifData; photos: PhotoWithExif[] }> {
  const groups: Array<{ center: ExifData; photos: PhotoWithExif[] }> = [];

  for (const photo of photos) {
    const existing = groups.find(
      (g) => calculateDistance(g.center, photo.exif) <= radiusMeters,
    );
    if (existing) {
      existing.photos.push(photo);
    } else {
      groups.push({ center: photo.exif, photos: [photo] });
    }
  }

  return groups;
}
