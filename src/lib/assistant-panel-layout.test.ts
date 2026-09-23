import { describe, expect, it } from "vitest";
import { layoutOpenChatPanel, rectsOverlap, shouldSendAssistantOnEnter } from "./assistant-panel-layout.js";

describe("layoutOpenChatPanel", () => {
  it("turns a saved desktop size into a full-width sheet on a 390px phone", () => {
    const layout = layoutOpenChatPanel({
      viewportWidth: 390,
      viewportHeight: 844,
      visualViewportHeight: 844,
      visualViewportOffsetTop: 0,
      preferredWidth: 900,
      preferredHeight: 700,
      preferredX: 120,
      preferredY: 300,
    });
    expect(layout.sheet).toBe(true);
    expect(layout.w).toBe(390);
    expect(layout.x).toBe(0);
    expect(layout.h).toBe(844);
  });

  it("shrinks the sheet to the visible area when the keyboard is open", () => {
    const layout = layoutOpenChatPanel({
      viewportWidth: 412,
      viewportHeight: 915,
      visualViewportHeight: 340,
      visualViewportOffsetTop: 0,
      preferredWidth: 350,
      preferredHeight: 500,
      preferredX: 0,
      preferredY: 0,
    });
    expect(layout.h).toBe(340);
    expect(layout.w).toBe(412);
    expect(layout.y + layout.h).toBeLessThanOrEqual(340);
  });

  it("follows an iOS-style visual viewport offset", () => {
    const layout = layoutOpenChatPanel({
      viewportWidth: 390,
      viewportHeight: 844,
      visualViewportHeight: 360,
      visualViewportOffsetTop: 80,
      preferredWidth: 350,
      preferredHeight: 500,
      preferredX: 0,
      preferredY: 400,
    });
    expect(layout.y).toBe(80);
    expect(layout.h).toBe(360);
  });

  it("clamps a dragged desktop panel inside 1440px", () => {
    const layout = layoutOpenChatPanel({
      viewportWidth: 1440,
      viewportHeight: 900,
      visualViewportHeight: 900,
      visualViewportOffsetTop: 0,
      preferredWidth: 2000,
      preferredHeight: 2000,
      preferredX: -40,
      preferredY: 5000,
    });
    expect(layout.sheet).toBe(false);
    expect(layout.w).toBeLessThanOrEqual(1440 - 32);
    expect(layout.h).toBeLessThanOrEqual(900 - 32);
    expect(layout.x).toBeGreaterThanOrEqual(16);
    expect(layout.y).toBeGreaterThanOrEqual(16);
    expect(layout.x + layout.w).toBeLessThanOrEqual(1440 - 16);
    expect(layout.y + layout.h).toBeLessThanOrEqual(900 - 16);
  });
});

describe("shouldSendAssistantOnEnter", () => {
  it("ignores IME confirmation and mobile Enter, and sends on desktop", () => {
    expect(shouldSendAssistantOnEnter({
      key: "Enter", shiftKey: false, isComposing: true, keyCode: 229, viewportWidth: 1440,
    })).toBe(false);
    expect(shouldSendAssistantOnEnter({
      key: "Enter", shiftKey: false, isComposing: false, keyCode: 13, viewportWidth: 390,
    })).toBe(false);
    expect(shouldSendAssistantOnEnter({
      key: "Enter", shiftKey: true, isComposing: false, keyCode: 13, viewportWidth: 1440,
    })).toBe(false);
    expect(shouldSendAssistantOnEnter({
      key: "Enter", shiftKey: false, isComposing: false, keyCode: 13, viewportWidth: 1440,
    })).toBe(true);
  });
});

describe("rectsOverlap", () => {
  it("detects a FAB sitting on the bottom nav", () => {
    expect(rectsOverlap(
      { x: 300, y: 780, width: 56, height: 56 },
      { x: 0, y: 790, width: 390, height: 54 },
    )).toBe(true);
    expect(rectsOverlap(
      { x: 314, y: 676, width: 56, height: 56 },
      { x: 0, y: 790, width: 390, height: 54 },
    )).toBe(false);
  });
});