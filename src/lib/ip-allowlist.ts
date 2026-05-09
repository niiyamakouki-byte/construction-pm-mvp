/**
 * ip-allowlist.ts — IP アドレスのアクセス制御
 *
 * CIDR 表記（IPv4 のみ）と完全一致の両方をサポートする。
 * allowedIps が空配列の場合は全許可（opt-in 制）。
 */

/**
 * IPv4 アドレスを 32bit 整数に変換する。
 * 不正な形式の場合は null を返す。
 */
function ipToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255 || String(n) !== part) return null;
    result = (result << 8) | n;
  }
  // ビットシフトで符号が付く場合を unsigned に戻す
  return result >>> 0;
}

/**
 * CIDR 表記（例: "192.168.1.0/24"）を { networkInt, mask } に分解する。
 * CIDR でない場合は null を返す。
 */
function parseCidr(
  cidr: string,
): { networkInt: number; mask: number } | null {
  const slashIdx = cidr.indexOf("/");
  if (slashIdx === -1) return null;

  const networkIp = cidr.slice(0, slashIdx);
  const prefixLen = parseInt(cidr.slice(slashIdx + 1), 10);

  if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return null;

  const networkInt = ipToInt(networkIp);
  if (networkInt === null) return null;

  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return { networkInt: (networkInt & mask) >>> 0, mask };
}

/**
 * 現在の IP が許可リストに含まれているか判定する。
 *
 * @param currentIp チェック対象の IPv4 アドレス（例: "192.168.1.100"）
 * @param allowedIps 許可する IP またはCIDR の配列
 * @returns allowedIps が空配列の場合は true（全許可）。
 *          いずれかの条件にマッチすれば true。
 */
export function isIpAllowed(
  currentIp: string,
  allowedIps: string[],
): boolean {
  // 空配列 → 全許可（opt-in 制）
  if (allowedIps.length === 0) return true;

  const currentInt = ipToInt(currentIp);

  for (const entry of allowedIps) {
    const cidr = parseCidr(entry);
    if (cidr !== null) {
      // CIDR マッチ
      if (currentInt !== null) {
        if ((currentInt & cidr.mask) >>> 0 === cidr.networkInt) {
          return true;
        }
      }
    } else {
      // 完全一致
      if (currentIp === entry) return true;
    }
  }

  return false;
}
