/**
 * Types smoke tests — ensure all types and constants are importable.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_GENERATION_OPTIONS,
  type ProposalDocument,
  type ProposalSection,
  type LaportaStrength,
  type CaseStudy,
  type DifferentiationPoint,
  type ProposalGenerationInput,
  type ProposalGenerationOptions,
} from "../types.js";

describe("DEFAULT_GENERATION_OPTIONS", () => {
  it("includeCases is true by default", () => {
    expect(DEFAULT_GENERATION_OPTIONS.includeCases).toBe(true);
  });

  it("includeDifferentiation is true by default", () => {
    expect(DEFAULT_GENERATION_OPTIONS.includeDifferentiation).toBe(true);
  });

  it("language is ja", () => {
    expect(DEFAULT_GENERATION_OPTIONS.language).toBe("ja");
  });
});
