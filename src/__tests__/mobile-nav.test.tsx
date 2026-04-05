import { useState } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNav } from "../components/MobileNav.js";

type HarnessProps = {
  onNavigate?: (path: string) => void;
  onTogglePersona?: () => void;
  onSignOut?: () => void;
};

function MobileNavHarness({
  onNavigate = vi.fn(),
  onTogglePersona = vi.fn(),
  onSignOut = vi.fn(),
}: HarnessProps) {
  const [open, setOpen] = useState(false);

  return (
    <MobileNav
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      items={[
        {
          key: "today",
          label: "今日",
          icon: "📋",
          path: "/today",
          active: false,
        },
        {
          key: "gantt",
          label: "工程表",
          icon: "📊",
          path: "/gantt",
          active: true,
          dataTour: "nav-contractors",
        },
      ]}
      onNavigate={onNavigate}
      personaLabel="現場監督"
      onTogglePersona={onTogglePersona}
      userLabel="demo@example.com"
      onSignOut={onSignOut}
    />
  );
}

describe("MobileNav", () => {
  beforeEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("opens from the hamburger button and navigates through drawer items", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<MobileNavHarness onNavigate={onNavigate} />);

    await user.click(screen.getByRole("button", { name: "メニューを開く" }));

    const dialog = screen.getByRole("dialog", { name: "モバイルナビゲーション" });
    const activeItem = within(dialog).getByRole("button", { name: "工程表" });
    expect(activeItem).toBeDefined();
    expect(activeItem.getAttribute("aria-current")).toBe("page");

    await user.click(within(dialog).getByRole("button", { name: "今日" }));

    expect(onNavigate).toHaveBeenCalledWith("/today");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "モバイルナビゲーション" })).toBeNull(),
    );
  });

  it("closes on escape and restores body scrolling", async () => {
    const user = userEvent.setup();

    render(<MobileNavHarness />);

    await user.click(screen.getByRole("button", { name: "メニューを開く" }));
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "モバイルナビゲーション" })).toBeNull(),
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("runs drawer actions for persona toggle and sign out", async () => {
    const user = userEvent.setup();
    const onTogglePersona = vi.fn();
    const onSignOut = vi.fn();

    render(
      <MobileNavHarness onTogglePersona={onTogglePersona} onSignOut={onSignOut} />,
    );

    await user.click(screen.getByRole("button", { name: "メニューを開く" }));
    const dialog = screen.getByRole("dialog", { name: "モバイルナビゲーション" });

    await user.click(within(dialog).getByRole("button", { name: /表示モード/ }));
    expect(onTogglePersona).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "メニューを開く" }));
    await user.click(screen.getByRole("button", { name: /サインアウト/ }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
