import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { PersonaProvider, usePersona } from "./PersonaContext.js";

describe("PersonaProvider", () => {
  it("defaults to supervisor for field-first GenbaHub sessions", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PersonaProvider>{children}</PersonaProvider>
    );

    const { result } = renderHook(() => usePersona(), { wrapper });

    expect(result.current.persona).toBe("supervisor");
  });
});
