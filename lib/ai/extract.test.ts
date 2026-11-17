import { describe, it, expect } from "vitest";
import {
  extractBranchTerms,
  extractCategory,
  extractCutoffQuery,
  extractQuota,
  extractRound,
  extractYear,
  isQueryTooVague,
  matchInstitutes,
} from "./extract";

const NAMES = [
  "IIT Bombay",
  "IIT Delhi",
  "NIT Durgapur",
  "NIT Tiruchirappalli",
  "NIT Allahabad (MNNIT)",
  "IIIT Hyderabad",
  "NIT Calicut",
];

describe("matchInstitutes", () => {
  it("matches the full name", () => {
    expect(matchInstitutes("What is the cutoff for NIT Durgapur CSE?", NAMES)).toEqual(["NIT Durgapur"]);
  });

  it("matches on the place name alone", () => {
    expect(matchInstitutes("closing rank at Bombay?", NAMES)).toEqual(["IIT Bombay"]);
  });

  it("returns several institutes when several are named", () => {
    const r = matchInstitutes("compare IIT Bombay and IIT Delhi cutoff", NAMES);
    expect(r).toContain("IIT Bombay");
    expect(r).toContain("IIT Delhi");
  });

  it("does not confuse IIT and IIIT", () => {
    expect(matchInstitutes("IIIT Hyderabad cutoff", NAMES)).toEqual(["IIIT Hyderabad"]);
  });

  it("returns nothing for a vague question", () => {
    expect(matchInstitutes("what is a good closing rank?", NAMES)).toEqual([]);
  });
});

describe("matchInstitutes with official long names (as in real JoSAA data)", () => {
  const LONG = [
    "Indian Institute of Technology Bombay",
    "Indian Institute of Technology Delhi",
    "National Institute of Technology Durgapur",
    "National Institute of Technology, Rourkela",
    "National Institute of Technology Karnataka, Surathkal",
    "National Institute of Technology, Tiruchirappalli",
    "Motilal Nehru National Institute of Technology Allahabad",
    "Indian Institute of Information Technology, Allahabad",
    "Visvesvaraya National Institute of Technology, Nagpur",
  ];

  it("maps the short form students type to the official name", () => {
    expect(matchInstitutes("IIT Bombay CSE cutoff", LONG)).toEqual(["Indian Institute of Technology Bombay"]);
    expect(matchInstitutes("closing rank NIT Durgapur", LONG)).toEqual(["National Institute of Technology Durgapur"]);
    expect(matchInstitutes("NIT Rourkela ECE", LONG)).toEqual(["National Institute of Technology, Rourkela"]);
  });

  it("understands nicknames and place-only mentions", () => {
    expect(matchInstitutes("NIT Trichy CSE", LONG)).toEqual(["National Institute of Technology, Tiruchirappalli"]);
    expect(matchInstitutes("what about surathkal?", LONG)).toEqual([
      "National Institute of Technology Karnataka, Surathkal",
    ]);
    expect(matchInstitutes("VNIT Nagpur cutoff", LONG)).toEqual(["Visvesvaraya National Institute of Technology, Nagpur"]);
    expect(matchInstitutes("MNNIT cutoff", LONG)).toEqual([
      "Motilal Nehru National Institute of Technology Allahabad",
    ]);
  });

  it("accepts the full official name too", () => {
    expect(matchInstitutes("cutoff for Indian Institute of Technology Delhi", LONG)).toEqual([
      "Indian Institute of Technology Delhi",
    ]);
  });

  it("does not mix up IIIT and MNNIT in Allahabad", () => {
    expect(matchInstitutes("IIIT Allahabad cutoff", LONG)).toEqual([
      "Indian Institute of Information Technology, Allahabad",
    ]);
  });

  it("returns both when only the city is given", () => {
    expect(matchInstitutes("cutoff Allahabad", LONG).sort()).toEqual([
      "Indian Institute of Information Technology, Allahabad",
      "Motilal Nehru National Institute of Technology Allahabad",
    ]);
  });
});

describe("field extraction", () => {
  it("finds branches", () => {
    expect(extractBranchTerms("CSE cutoff")).toContain("CSE");
    expect(extractBranchTerms("mechanical engineering")).toContain("ME");
    expect(extractBranchTerms("hello there")).toEqual([]);
  });

  it("finds category, quota, year and round", () => {
    expect(extractCategory("OBC-NCL rank")).toBe("OBC-NCL");
    expect(extractCategory("for EWS students")).toBe("EWS");
    expect(extractQuota("home state quota")).toBe("HS");
    expect(extractQuota("all india seats")).toBe("AI");
    expect(extractQuota("tell me about the AI counselor")).toBeUndefined();
    expect(extractYear("2024 cutoffs")).toBe(2024);
    expect(extractRound("in round 3")).toBe(3);
    expect(extractRound("round 99")).toBeUndefined();
  });
});

describe("extractCutoffQuery / isQueryTooVague", () => {
  it("builds a specific query", () => {
    const q = extractCutoffQuery("NIT Durgapur CSE closing rank round 2 2024 OPEN", NAMES);
    expect(q.instituteNames).toEqual(["NIT Durgapur"]);
    expect(q.branchTerms).toContain("CSE");
    expect(q.year).toBe(2024);
    expect(q.round).toBe(2);
    expect(isQueryTooVague(q)).toBe(false);
  });

  it("flags a vague question instead of fetching arbitrary rows", () => {
    expect(isQueryTooVague(extractCutoffQuery("what are the cutoffs?", NAMES))).toBe(true);
  });
});
