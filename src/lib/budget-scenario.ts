import { ExpenseOrigin } from "@prisma/client";

export function isSystemScenarioOrigin(origin: ExpenseOrigin) {
  return origin !== ExpenseOrigin.STANDARD;
}

export function editableScenarioExpenses<T extends { isSystemGenerated: boolean }>(expenses: T[]) {
  return expenses.filter((expense) => !expense.isSystemGenerated);
}

export function moveScenarioDueDate(dueDate: Date | null, targetMonthKey: string) {
  if (!dueDate) return null;
  const [year, month] = targetMonthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1, Math.min(dueDate.getUTCDate(), lastDay), 12));
}
