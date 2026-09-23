import { checkLockCode, describeLockWait } from "./lockCode";

describe("checkLockCode", () => {
  it("accepts a code of six to twelve digits", () => {
    expect(checkLockCode("123456")).toEqual({ ok: true, code: "123456" });
    expect(checkLockCode("123456789012")).toEqual({ ok: true, code: "123456789012" });
  });

  it("trims what a person pasted, and does not count the spaces", () => {
    expect(checkLockCode("  123456  ")).toEqual({ ok: true, code: "123456" });
  });

  it("refuses letters, symbols and an empty code", () => {
    expect(checkLockCode("12345a")).toEqual({ ok: false, reason: "Use digits only." });
    expect(checkLockCode("1234 56")).toEqual({ ok: false, reason: "Use digits only." });
    expect(checkLockCode("")).toEqual({ ok: false, reason: "Use digits only." });
  });

  it("refuses a code that is too short, and one that is too long", () => {
    expect(checkLockCode("12345")).toEqual({ ok: false, reason: "Use at least 6 digits." });
    expect(checkLockCode("1234567890123")).toEqual({ ok: false, reason: "Use at most 12 digits." });
  });
});

describe("describeLockWait", () => {
  it("says nothing when there is no wait", () => {
    expect(describeLockWait(0)).toBe("");
    expect(describeLockWait(-5)).toBe("");
    expect(describeLockWait(NaN)).toBe("");
  });

  it("counts in seconds below a minute and in minutes above it", () => {
    expect(describeLockWait(1)).toBe("Try again in 1 second.");
    expect(describeLockWait(30)).toBe("Try again in 30 seconds.");
    expect(describeLockWait(60)).toBe("Try again in 1 minute.");
    expect(describeLockWait(61)).toBe("Try again in 2 minutes.");
  });
});
