import { ExpenseOrigin } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  editableScenarioExpenses,
  isSystemScenarioOrigin,
  moveScenarioDueDate,
} from "@/lib/budget-scenario";

describe("budget scenario rules", () => {
  it("locks every system-managed expense origin", () => {
    expect(isSystemScenarioOrigin(ExpenseOrigin.STANDARD)).toBe(false);
    expect(isSystemScenarioOrigin(ExpenseOrigin.ANNUAL_SAVING)).toBe(true);
    expect(isSystemScenarioOrigin(ExpenseOrigin.LOAN_PAYMENT)).toBe(true);
    expect(isSystemScenarioOrigin(ExpenseOrigin.LOAN_EXTRA_PAYMENT)).toBe(true);
    expect(isSystemScenarioOrigin(ExpenseOrigin.FINANCING_CASH)).toBe(true);
  });

  it("only promotes editable scenario rows", () => {
    const rows = editableScenarioExpenses([
      { id: "manual", isSystemGenerated: false },
      { id: "automatic", isSystemGenerated: true },
    ]);
    expect(rows.map((row) => row.id)).toEqual(["manual"]);
  });

  it("clamps a copied due date to the target month's final day", () => {
    const january31 = new Date(Date.UTC(2027, 0, 31, 12));
    expect(moveScenarioDueDate(january31, "2027-02")?.toISOString()).toBe(
      "2027-02-28T12:00:00.000Z",
    );
    expect(moveScenarioDueDate(null, "2027-02")).toBeNull();
  });
});
