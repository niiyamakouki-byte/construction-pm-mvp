import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, fireEvent } from "@testing-library/react";
import { VoiceInput } from "./VoiceInput.js";

describe("VoiceInput", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders nothing when SpeechRecognition is not supported", () => {
    const { container } = render(
      <VoiceInput onTranscript={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  describe("with SpeechRecognition supported", () => {
    const mockStop = vi.fn();
    const mockStart = vi.fn();
    let mockRecognition: {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      onresult: ((e: unknown) => void) | null;
      onerror: ((e: unknown) => void) | null;
      onend: (() => void) | null;
      start: typeof mockStart;
      stop: typeof mockStop;
    };

    beforeEach(() => {
      cleanup();
      mockStop.mockClear();
      mockStart.mockClear();
      mockRecognition = {
        lang: "",
        interimResults: false,
        continuous: false,
        onresult: null,
        onerror: null,
        onend: null,
        start: mockStart,
        stop: mockStop,
      };
      const MockSpeechRecognition = vi.fn(() => mockRecognition);
      Object.defineProperty(window, "SpeechRecognition", {
        value: MockSpeechRecognition,
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      // @ts-ignore
      delete window.SpeechRecognition;
      vi.clearAllMocks();
    });

    it("renders microphone button", () => {
      render(<VoiceInput onTranscript={vi.fn()} />);
      expect(screen.getByRole("button", { name: "音声入力を開始" })).toBeDefined();
    });

    it("starts listening on click", () => {
      render(<VoiceInput onTranscript={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "音声入力を開始" }));
      expect(mockStart).toHaveBeenCalledTimes(1);
      expect(mockRecognition.lang).toBe("ja-JP");
      expect(screen.getByRole("button", { name: "音声入力を停止" })).toBeDefined();
    });

    it("stops listening on second click", () => {
      render(<VoiceInput onTranscript={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "音声入力を開始" }));
      fireEvent.click(screen.getByRole("button", { name: "音声入力を停止" }));
      expect(mockStop).toHaveBeenCalledTimes(1);
    });

    it("calls onTranscript when results arrive", () => {
      const onTranscript = vi.fn();
      render(<VoiceInput onTranscript={onTranscript} />);
      fireEvent.click(screen.getByRole("button", { name: "音声入力を開始" }));

      const event = {
        results: {
          length: 1,
          0: { 0: { transcript: "テストメッセージ" }, isFinal: true },
        },
        resultIndex: 0,
      };
      mockRecognition.onresult?.(event);

      expect(onTranscript).toHaveBeenCalledWith("テストメッセージ");
    });

    it("is disabled when disabled prop is true", () => {
      render(<VoiceInput onTranscript={vi.fn()} disabled />);
      const button = screen.getByRole("button");
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });

    it("resets listening state when recognition ends", () => {
      const { getByRole } = render(<VoiceInput onTranscript={vi.fn()} />);
      fireEvent.click(getByRole("button", { name: "音声入力を開始" }));
      expect(getByRole("button", { name: "音声入力を停止" })).toBeDefined();
      // Simulate recognition ending (browser fires onend after completion/error)
      act(() => { mockRecognition.onend?.(); });
      expect(getByRole("button", { name: "音声入力を開始" })).toBeDefined();
    });
  });
});
