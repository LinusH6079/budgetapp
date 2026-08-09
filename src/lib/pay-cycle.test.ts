import { describe, expect, it } from "vitest";

import {
  adjustedPayday,
  calendarDateKey,
  getBudgetMonthKeyForPayCycle,
  getPayCycle,
} from "@/lib/pay-cycle";

describe("pay cycle", () => {
  it("flyttar lördag och söndag till fredag", () => {
    expect(calendarDateKey(adjustedPayday(2026, 7))).toBe("2026-07-24");
    expect(calendarDateKey(adjustedPayday(2027, 4))).toBe("2027-04-23");
  });

  it("behåller den 25:e på vardagar", () => {
    expect(calendarDateKey(adjustedPayday(2026, 8))).toBe("2026-08-25");
  });

  it("väljer rätt löneperiod efter en helglön", () => {
    const cycle = getPayCycle(new Date("2026-07-29T10:00:00Z"));

    expect(calendarDateKey(cycle.startDate)).toBe("2026-07-24");
    expect(calendarDateKey(cycle.endDate)).toBe("2026-08-25");
    expect(cycle.totalDays).toBe(32);
    expect(cycle.elapsedDays).toBe(6);
  });

  it("aktiverar nästa budgetmånad när lönen har kommit", () => {
    expect(
      getBudgetMonthKeyForPayCycle(new Date("2026-08-24T10:00:00Z")),
    ).toBe("2026-08");
    expect(
      getBudgetMonthKeyForPayCycle(new Date("2026-08-26T10:00:00Z")),
    ).toBe("2026-09");
  });

  it("aktiverar nästa budgetmånad på fredagen när den 25:e är helg", () => {
    expect(
      getBudgetMonthKeyForPayCycle(new Date("2026-07-23T10:00:00Z")),
    ).toBe("2026-07");
    expect(
      getBudgetMonthKeyForPayCycle(new Date("2026-07-24T10:00:00Z")),
    ).toBe("2026-08");
  });
});
