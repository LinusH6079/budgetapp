import { ExpenseType, PayerType, PlanningType } from "@prisma/client";
import { z } from "zod";

import { isMonthKey } from "@/lib/date";
import { parseCurrencyInput } from "@/lib/money";

const moneyField = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    try {
      const parsed = parseCurrencyInput(value);

      if (parsed < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Belopp kan inte vara negativt.",
        });
        return z.NEVER;
      }

      return parsed;
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Ogiltigt belopp.",
      });
      return z.NEVER;
    }
  });

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Namn måste vara minst 2 tecken."),
  email: z.string().trim().toLowerCase().email("Ange en giltig e-postadress."),
  password: z
    .string()
    .min(8, "Lösenordet måste vara minst 8 tecken.")
    .max(72, "Lösenordet är för långt."),
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .max(32, "Invite-koden är för lång.")
    .optional()
    .or(z.literal("")),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ange en giltig e-postadress."),
  password: z.string().min(1, "Ange lösenord."),
});

export const createHouseholdSchema = z.object({
  name: z.string().trim().min(2, "Hushållets namn måste vara minst 2 tecken."),
});

export const joinHouseholdSchema = z.object({
  code: z.string().trim().toUpperCase().min(4, "Ange en giltig invite-kod."),
});

export const createMonthSchema = z.object({
  monthKey: z
    .string()
    .refine(isMonthKey, "Månad måste anges som ÅÅÅÅ-MM, till exempel 2026-04."),
  copyRecurringFromMonthId: z.string().cuid().optional().or(z.literal("")),
});

export const updateMonthNoteSchema = z.object({
  monthId: z.string().cuid(),
  note: z.string().trim().max(2000, "Anteckningen är för lång."),
});

export const toggleMonthLockSchema = z.object({
  monthId: z.string().cuid(),
  nextLockedState: z.enum(["lock", "unlock"]),
});

export const deleteMonthSchema = z.object({
  monthId: z.string().cuid(),
  monthKey: z.string().refine(isMonthKey, "Ogiltig månad."),
});

export const snapshotValueSchema = z.object({
  monthId: z.string().cuid(),
  userId: z.string().cuid(),
  incomeAmount: moneyField,
  carryOverAmount: moneyField,
});

export const expenseSchema = z.object({
  monthId: z.string().cuid(),
  expenseId: z.string().cuid().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Namn krävs.").max(120, "Namnet är för långt."),
  amount: moneyField,
  category: z.string().trim().min(1, "Kategori krävs.").max(50, "Kategorin är för lång."),
  expenseType: z.nativeEnum(ExpenseType),
  payerType: z.nativeEnum(PayerType),
});

export const deleteExpenseSchema = z.object({
  expenseId: z.string().cuid(),
  monthId: z.string().cuid(),
});

export const toggleExpensePaidSchema = z.object({
  expenseId: z.string().cuid(),
  monthId: z.string().cuid(),
  nextPaidState: z.enum(["paid", "unpaid"]),
  targetPayerType: z
    .enum([PayerType.FIRST_PERSON, PayerType.SECOND_PERSON])
    .optional(),
});

export const settleExpensesWithSwishSchema = z.object({
  monthId: z.string().cuid(),
  expenseIds: z.array(z.string().cuid()).min(1, "Välj minst en utgift."),
  swishId: z
    .string()
    .trim()
    .min(1, "Ange ett Swish ID.")
    .max(64, "Swish ID är för långt.")
    .transform((value) => value.toUpperCase()),
});

export const swishSearchSchema = z.object({
  swishId: z
    .string()
    .trim()
    .min(1, "Ange ett Swish ID.")
    .max(64, "Swish ID är för långt.")
    .transform((value) => value.toUpperCase()),
});

const importExpenseSchema = z.object({
  recurringSourceExpenseId: z.string().cuid().nullable().optional(),
  swishId: z.string().nullable().optional(),
  name: z.string(),
  amount: z.number().int().nonnegative(),
  category: z.string(),
  expenseType: z.nativeEnum(ExpenseType),
  planningType: z.nativeEnum(PlanningType),
  payerType: z.nativeEnum(PayerType),
  dueDate: z.string().nullable(),
  isPaid: z.boolean(),
  paidAt: z.string().nullable(),
  firstPersonPaidAt: z.string().nullable().optional(),
  secondPersonPaidAt: z.string().nullable().optional(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const importSnapshotSchema = z.object({
  slot: z.enum(["FIRST_PERSON", "SECOND_PERSON"]),
  incomeAmount: z.number().int().nonnegative(),
  carryOverAmount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const householdImportSchema = z.object({
  version: z.literal(1),
  householdName: z.string(),
  exportedAt: z.string(),
  members: z
    .array(
      z.object({
        slot: z.enum(["FIRST_PERSON", "SECOND_PERSON"]),
        name: z.string(),
        email: z.string().email(),
        role: z.string(),
        joinedAt: z.string(),
      }),
    )
    .max(2),
  months: z.array(
    z.object({
      monthKey: z.string().refine(isMonthKey),
      note: z.string().nullable(),
      isLocked: z.boolean(),
      createdAt: z.string(),
      updatedAt: z.string(),
      snapshots: z.array(importSnapshotSchema).max(2),
      expenses: z.array(importExpenseSchema),
    }),
  ),
});
