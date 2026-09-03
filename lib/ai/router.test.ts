import { describe, it, expect } from "vitest";
import { routeIntent } from "./router";

describe("routeIntent", () => {
  it("routes freeze/float/slide/withdraw/refund questions to RULE", () => {
    expect(routeIntent("What does freeze mean?")).toBe("RULE");
    expect(routeIntent("Should I float or slide?")).toBe("RULE");
    expect(routeIntent("How do I withdraw from counseling?")).toBe("RULE");
    expect(routeIntent("What's the refund policy?")).toBe("RULE");
  });

  it("routes rank/cutoff questions to CUTOFF", () => {
    expect(routeIntent("What's the closing rank for NIT Trichy CSE?")).toBe("CUTOFF");
    expect(routeIntent("Can I get IIT Bombay with my rank?")).toBe("CUTOFF");
  });

  it("routes choice-list questions to RECOMMENDATION", () => {
    expect(routeIntent("Can you reorder my list?")).toBe("RECOMMENDATION");
    expect(routeIntent("Is my list safer than before?")).toBe("RECOMMENDATION");
  });

  it("falls back to GENERAL for anything else", () => {
    expect(routeIntent("Hi, how are you?")).toBe("GENERAL");
    expect(routeIntent("Tell me about NIT Durgapur")).toBe("GENERAL");
  });

  it("is case-insensitive", () => {
    expect(routeIntent("WHAT DOES FREEZE MEAN")).toBe("RULE");
    expect(routeIntent("CLOSING RANK for IIT Delhi")).toBe("CUTOFF");
  });
});