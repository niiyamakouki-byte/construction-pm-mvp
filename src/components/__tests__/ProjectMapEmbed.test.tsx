import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProjectMapEmbed } from "../ProjectMapEmbed.js";

describe("ProjectMapEmbed", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders iframe when address is provided", () => {
    render(<ProjectMapEmbed address="東京都港区南青山1-1-1" />);
    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
  });

  it("shows 住所未登録 when address is empty string", () => {
    render(<ProjectMapEmbed address="" />);
    expect(screen.getByText("住所未登録")).toBeDefined();
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeNull();
  });

  it("iframe src contains encoded address", () => {
    render(<ProjectMapEmbed address="東京都港区南青山1-1-1" />);
    const iframe = document.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toContain(encodeURIComponent("東京都港区南青山1-1-1"));
  });

  it("ルート案内 link has correct URL", () => {
    render(<ProjectMapEmbed address="東京都港区南青山1-1-1" />);
    const link = screen.getByText("ルート案内");
    const href = link.getAttribute("href");
    expect(href).toContain("maps/dir/?api=1&destination=");
    expect(href).toContain(encodeURIComponent("東京都港区南青山1-1-1"));
  });

  it("ストリートビュー link has correct URL", () => {
    render(<ProjectMapEmbed address="東京都港区南青山1-1-1" />);
    const link = screen.getByText("ストリートビュー");
    const href = link.getAttribute("href");
    expect(href).toContain("map_action=pano");
    expect(href).toContain(encodeURIComponent("東京都港区南青山1-1-1"));
  });

  it("renders all nearby search buttons", () => {
    render(<ProjectMapEmbed address="東京都港区南青山1-1-1" />);
    expect(screen.getByText("建材店")).toBeDefined();
    expect(screen.getByText("コンビニ")).toBeDefined();
    expect(screen.getByText("駐車場")).toBeDefined();
    expect(screen.getByText("ホームセンター")).toBeDefined();
  });
});
