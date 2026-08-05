import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContractorRequestResponsePage } from "./ContractorRequestResponsePage.js";

const verifySignedToken = vi.fn();
const respondToContractorRequest = vi.fn();

vi.mock("../lib/share-token.js", () => ({
  verifySignedToken: (...args: unknown[]) => verifySignedToken(...args),
  respondToContractorRequest: (...args: unknown[]) => respondToContractorRequest(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  verifySignedToken.mockResolvedValue({
    valid: true,
    projectId: "proj-1",
    purpose: "contractor_request",
    notificationId: "request-1",
    taskName: "軽鉄下地組み",
  });
  respondToContractorRequest.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("ContractorRequestResponsePage", () => {
  it.each([
    ["承諾する", "accepted", "依頼を承諾しました"],
    ["辞退する", "rejected", "依頼を辞退しました"],
  ])("%sで署名トークン付き回答を保存する", async (button, response, message) => {
    render(<ContractorRequestResponsePage token="signed-token" />);
    expect(await screen.findByText("軽鉄下地組み")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: button }));
    await waitFor(() => expect(respondToContractorRequest).toHaveBeenCalledWith("signed-token", response));
    expect(await screen.findByText(message)).toBeDefined();
  });

  it("依頼スコープでないトークンを拒否する", async () => {
    verifySignedToken.mockResolvedValueOnce({ valid: true, projectId: "proj-1" });
    render(<ContractorRequestResponsePage token="owner-token" />);
    expect((await screen.findByRole("alert")).textContent).toContain("無効");
  });
});
