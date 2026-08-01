import { describe, expect, it } from "vitest";

import {
  buildRecurringExpenseCopies,
  filterExpenseItems,
  getRedirectMonthKeyAfterDeletion,
} from "@/server/services/budget-months";

describe("buildRecurringExpenseCopies", () => {
  it("kopierar bara återkommande utgifter och återställer betalstatus", () => {
    const copies = buildRecurringExpenseCopies(
      {
        expenses: [
          {
            id: "1",
            budgetMonthId: "old",
            recurringSourceExpenseId: null,
            name: "Hyra",
            amount: 145000,
            category: "Boende",
            expenseType: "RECURRING",
            origin: "STANDARD",
            planningType: "PLANNED",
            payerType: "SHARED",
            dueDate: new Date("2026-03-31"),
            isPaid: true,
            paidAt: new Date("2026-03-30"),
            note: null,
            createdAt: new Date("2026-03-01"),
            updatedAt: new Date("2026-03-02"),
            updatedByUserId: "u1",
            updatedByUser: null,
          },
          {
            id: "2",
            budgetMonthId: "old",
            recurringSourceExpenseId: null,
            name: "Bilservice",
            amount: 80000,
            category: "Bil",
            expenseType: "ONE_TIME",
            origin: "STANDARD",
            planningType: "PLANNED",
            payerType: "FIRST_PERSON",
            dueDate: new Date("2026-03-10"),
            isPaid: false,
            paidAt: null,
            note: null,
            createdAt: new Date("2026-03-01"),
            updatedAt: new Date("2026-03-02"),
            updatedByUserId: "u1",
            updatedByUser: null,
          },
          {
            id: "3",
            budgetMonthId: "old",
            recurringSourceExpenseId: null,
            name: "Spara till bilskatt",
            amount: 15000,
            category: "Årssparande",
            expenseType: "RECURRING",
            origin: "ANNUAL_SAVING",
            planningType: "PLANNED",
            payerType: "SHARED",
            dueDate: null,
            isPaid: false,
            paidAt: null,
            note: null,
            createdAt: new Date("2026-03-01"),
            updatedAt: new Date("2026-03-02"),
            updatedByUserId: "u1",
            updatedByUser: null,
          },
        ],
      },
      "new-month",
      "2026-04",
      "u2",
    );

    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({
      budgetMonthId: "new-month",
      recurringSourceExpenseId: "1",
      name: "Hyra",
      isPaid: false,
      paidAt: null,
      updatedByUserId: "u2",
    });
    expect(copies[0]?.dueDate?.toISOString().slice(0, 10)).toBe("2026-04-30");
  });
});

describe("filterExpenseItems", () => {
  it("kan filtrera utgifter per person", () => {
    const filtered = filterExpenseItems(
      [
        {
          isPaid: false,
          expenseType: "RECURRING",
          origin: "STANDARD",
          category: "Boende",
          planningType: "PLANNED",
          payerType: "FIRST_PERSON",
        },
        {
          isPaid: true,
          expenseType: "ONE_TIME",
          origin: "STANDARD",
          category: "Mat",
          planningType: "UNPLANNED",
          payerType: "SECOND_PERSON",
        },
      ],
      {
        payer: "SECOND_PERSON",
      },
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.payerType).toBe("SECOND_PERSON");
  });

  it("behandlar automatiskt årssparande som en egen filtertyp", () => {
    const expenses = [
      {
        isPaid: false,
        expenseType: "ONE_TIME",
        origin: "STANDARD",
        category: "Bil",
        payerType: "SHARED",
      },
      {
        isPaid: false,
        expenseType: "ONE_TIME",
        origin: "ANNUAL_SAVING",
        category: "Årssparande",
        payerType: "SHARED",
      },
    ];

    expect(filterExpenseItems(expenses, { type: "ONE_TIME" })).toHaveLength(1);
    expect(
      filterExpenseItems(expenses, { type: "ANNUAL_SAVING" }),
    ).toEqual([expenses[1]]);
  });
});

describe("getRedirectMonthKeyAfterDeletion", () => {
  it("skickar tillbaka användaren till närmast föregående månad om den finns", () => {
    expect(getRedirectMonthKeyAfterDeletion(["2026-02", "2026-03", "2026-04"], "2026-04")).toBe(
      "2026-03",
    );
  });

  it("faller tillbaka till nästa månad om ingen tidigare månad finns", () => {
    expect(getRedirectMonthKeyAfterDeletion(["2026-02", "2026-03"], "2026-02")).toBe("2026-03");
  });
});
