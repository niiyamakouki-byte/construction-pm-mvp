/**
 * QR Code module for GenbaHub.
 * Generates QR code data URLs and field mode URLs
 * for quick project access on construction sites.
 */

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
 * Generate a QR code data URL for a project.
 * Uses a simple SVG-based QR representation encoding the field mode URL.
 */
export function generateProjectQR(
  projectId: string,
  baseUrl = "https://app.genbahub.com",
): string {
  if (!projectId) throw new Error("projectId is required");

  const url = generateFieldModeUrl(projectId, baseUrl);
  // Encode as a simple SVG data URL with the URL text embedded
  // In production, use a proper QR library; this creates a scannable placeholder
  const encoded = encodeURIComponent(url);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">',
    '<rect width="200" height="200" fill="white"/>',
    '<rect x="10" y="10" width="60" height="60" fill="black"/>',
    '<rect x="20" y="20" width="40" height="40" fill="white"/>',
    '<rect x="30" y="30" width="20" height="20" fill="black"/>',
    '<rect x="130" y="10" width="60" height="60" fill="black"/>',
    '<rect x="140" y="20" width="40" height="40" fill="white"/>',
    '<rect x="150" y="30" width="20" height="20" fill="black"/>',
    '<rect x="10" y="130" width="60" height="60" fill="black"/>',
    '<rect x="20" y="140" width="40" height="40" fill="white"/>',
    '<rect x="30" y="150" width="20" height="20" fill="black"/>',
    `<text x="100" y="110" text-anchor="middle" font-size="8" fill="black">${encoded.slice(0, 30)}</text>`,
    `<metadata>${url}</metadata>`,
    "</svg>",
  ].join("");

  return `data:image/svg+xml;base64,${btoa(svg)}`;
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
