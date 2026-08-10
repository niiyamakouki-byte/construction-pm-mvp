/**
 * QR Code module for GenbaHub.
 * Generates QR code data URLs and field mode URLs
 * for quick project access on construction sites.
 */

import QRCode from "qrcode";

const FIELD_MODE_PATH = "/field";
const QR_PREFIX = "genbahub://project/";

/**
 * Generate a field mode URL for a project.
 */
export function generateFieldModeUrl(projectId: string, baseUrl = ""): string {
  if (!projectId) throw new Error("projectId is required");
  return `${baseUrl}${FIELD_MODE_PATH}/${encodeURIComponent(projectId)}`;
}

/**
 * Generate a real, scannable QR code data URL for a project's field mode URL.
 * Pass the real origin (e.g. `window.location.origin`) as baseUrl — this
 * module does not hardcode a production domain (see generateSiteEntryQR).
 */
export async function generateProjectQR(
  projectId: string,
  baseUrl = "",
): Promise<string> {
  if (!projectId) throw new Error("projectId is required");

  const url = generateFieldModeUrl(projectId, baseUrl);
  return QRCode.toDataURL(url, { width: 200 });
}

/**
 * Parse a QR code scan result to extract the projectId.
 * Supports both field mode URLs and genbahub:// protocol.
 */
export function parseProjectQR(data: string): string | null {
  if (!data) return null;

  // Handle genbahub:// protocol
  if (data.startsWith(QR_PREFIX)) {
    const id = data.slice(QR_PREFIX.length);
    return id ? decodeURIComponent(id) : null;
  }

  // Handle field mode URL pattern: .../field/{projectId}
  const fieldMatch = data.match(/\/field\/([^/?#]+)/);
  if (fieldMatch) {
    return decodeURIComponent(fieldMatch[1]);
  }

  return null;
}
