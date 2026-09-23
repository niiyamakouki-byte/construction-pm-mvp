const MOBILE_BREAKPOINT = 768;
const PANEL_EDGE_GAP = 16;
const MIN_W = 320;
const MIN_H = 400;
const MIN_SHEET_H = 240;

export type OpenChatLayout = {
  sheet: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * 開いている秘書パネルを、見える範囲に収める。
 * モバイルはキーボード分だけ縮む visual viewport いっぱいのシート。
 * デスクトップは保存サイズを画面内にクランプする。
 */
export function layoutOpenChatPanel(input: {
  viewportWidth: number;
  viewportHeight: number;
  visualViewportHeight: number;
  visualViewportOffsetTop: number;
  preferredWidth: number;
  preferredHeight: number;
  preferredX: number;
  preferredY: number;
}): OpenChatLayout {
  const sheet = input.viewportWidth < MOBILE_BREAKPOINT;
  if (sheet) {
    const h = Math.max(MIN_SHEET_H, Math.round(input.visualViewportHeight));
    const y = Math.max(0, Math.round(input.visualViewportOffsetTop));
    return {
      sheet: true,
      x: 0,
      y,
      w: Math.max(0, Math.round(input.viewportWidth)),
      h,
    };
  }

  const availableW = Math.max(0, input.viewportWidth - PANEL_EDGE_GAP * 2);
  const availableH = Math.max(0, input.viewportHeight - PANEL_EDGE_GAP * 2);
  const w = Math.min(Math.max(input.preferredWidth, Math.min(MIN_W, availableW)), availableW);
  const h = Math.min(Math.max(input.preferredHeight, Math.min(MIN_H, availableH)), availableH);
  const x = Math.max(PANEL_EDGE_GAP, Math.min(input.preferredX, input.viewportWidth - w - PANEL_EDGE_GAP));
  const y = Math.max(PANEL_EDGE_GAP, Math.min(input.preferredY, input.viewportHeight - h - PANEL_EDGE_GAP));
  return { sheet: false, x, y, w, h };
}

/** 日本語変換中の Enter と、モバイルの改行 Enter では送らない。 */
export function shouldSendAssistantOnEnter(event: {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  keyCode: number;
  viewportWidth: number;
}): boolean {
  if (event.isComposing || event.keyCode === 229) return false;
  if (event.key !== "Enter" || event.shiftKey) return false;
  if (event.viewportWidth < 768) return false;
  return true;
}

export function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
