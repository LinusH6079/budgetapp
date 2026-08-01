import {
  AnnualBudgetRecurrence,
  AnnualSavingMode,
  ExpenseOrigin,
  ExpenseType,
  PayerType,
  PlanningType,
} from "@prisma/client";
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

export const spendingPaceSettingsSchema = z.object({
  monthlyLimit: moneyField.refine(
    (value) => value > 0,
    "Månadsbeloppet måste vara större än 0.",
  ),
  weeklyLimit: moneyField.refine(
    (value) => value > 0,
    "Veckobeloppet måste vara större än 0.",
  ),
});

export const spendingPaceEntrySchema = z.object({
  amount: moneyField.refine(
    (value) => value > 0,
    "Beloppet måste vara större än 0.",
  ),
});

export const annualBudgetItemSchema = z.object({
  itemId: z.string().cuid().optional().or(z.literal("")),
  name: z
    .string()
    .trim()
    .min(1, "Namn krävs.")
    .max(120, "Namnet är för långt."),
  targetAmount: moneyField.refine(
    (value) => value > 0,
    "Målbeloppet måste vara större än 0.",
  ),
  dueMonth: z
    .string()
    .refine(isMonthKey, "Välj en giltig förfallomånad."),
  category: z.string().trim().max(50, "Kategorin är för lång."),
  recurrence: z.nativeEnum(AnnualBudgetRecurrence),
  savingMode: z.nativeEnum(AnnualSavingMode),
  initialSavingMonth: z
    .string()
    .optional()
    .or(z.literal("")),
  initialMonthlyAmount: moneyField.optional(),
}).superRefine((value, ctx) => {
  if (value.savingMode !== AnnualSavingMode.CUSTOM_SCHEDULE) {
    return;
  }

  if (!value.initialSavingMonth || !isMonthKey(value.initialSavingMonth)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["initialSavingMonth"],
      message: "Välj när den första spartakten ska börja.",
    });
  }

  if (!value.initialMonthlyAmount || value.initialMonthlyAmount <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["initialMonthlyAmount"],
      message: "Ange ett månadsbelopp för spartrappan.",
    });
  }
});

export const annualSavingRateSchema = z.object({
  itemId: z.string().cuid(),
  startMonth: z.string().refine(isMonthKey, "Välj en giltig startmånad."),
  monthlyAmount: moneyField.refine(
    (value) => value > 0,
    "Månadsbeloppet måste vara större än 0.",
  ),
});

export const deleteAnnualSavingRateSchema = z.object({
  itemId: z.string().cuid(),
  rateId: z.string().cuid(),
});

export const annualContributionSchema = z.object({
  itemId: z.string().cuid(),
  amount: moneyField.refine(
    (value) => value > 0,
    "Beloppet måste vara större än 0.",
  ),
});

export const annualItemIdSchema = z.object({
  itemId: z.string().cuid(),
});

export const settleAnnualBudgetItemSchema = z.object({
  itemId: z.string().cuid(),
  monthId: z.string().cuid(),
  amount: moneyField.refine(
    (value) => value > 0,
    "Kostnaden måste vara större än 0.",
  ),
  payerType: z.nativeEnum(PayerType),
});

export const expenseSchema = z.object({
  monthId: z.string().cuid(),
  expenseId: z.string().cuid().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Namn krävs.").max(120, "Namnet är för långt."),
  amount: moneyField,
  category: z.string().trim().min(1, "Kategori krävs.").max(50, "Kategorin är för lång."),
  expenseType: z.nativeEnum(ExpenseType),
  origin: z.nativeEnum(ExpenseOrigin).optional(),
  payerType: z.nativeEnum(PayerType),
  annualBudgetItemId: z.string().cuid().optional().or(z.literal("")),
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
  selections: z
    .array(
      z.object({
        expenseId: z.string().cuid(),
        targetPayerType: z
          .enum([PayerType.FIRST_PERSON, PayerType.SECOND_PERSON])
          .optional(),
      }),
    )
    .min(1, "Välj minst en utgift eller persondel.")
    .superRefine((selections, ctx) => {
      const keys = selections.map(
        (selection) =>
          `${selection.expenseId}:${selection.targetPayerType ?? "FULL"}`,
      );

      if (new Set(keys).size !== keys.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Samma utgiftsdel kan bara väljas en gång.",
        });
      }
    }),
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
  annualBudgetItemBackupKey: z.string().nullable().optional(),
  swishId: z.string().nullable().optional(),
  name: z.string(),
  amount: z.number().int().nonnegative(),
  category: z.string(),
  expenseType: z.nativeEnum(ExpenseType),
  origin: z.nativeEnum(ExpenseOrigin).optional(),
  planningType: z.nativeEnum(PlanningType),
  payerType: z.nativeEnum(PayerType),
  dueDate: z.string().nullable(),
  isPaid: z.boolean(),
  paidAt: z.string().nullable(),
  firstPersonPaidAt: z.string().nullable().optional(),
  secondPersonPaidAt: z.string().nullable().optional(),
  firstPersonSwishId: z.string().nullable().optional(),
  secondPersonSwishId: z.string().nullable().optional(),
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
  spendingPace: z
    .object({
      settings: z
        .object({
          monthlyLimit: z.number().int().positive(),
          weeklyLimit: z.number().int().positive(),
        })
        .nullable(),
      entries: z.array(
        z.object({
          cycleStartKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          weekStartKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          amount: z.number().int().nonnegative(),
        }),
      ),
    })
    .optional(),
  annualBudget: z
    .array(
      z.object({
        backupKey: z.string().optional(),
        name: z.string(),
        targetAmount: z.number().int().positive(),
        dueMonth: z.string().refine(isMonthKey),
        category: z.string().nullable(),
        recurrence: z.nativeEnum(AnnualBudgetRecurrence).optional(),
        savingMode: z.nativeEnum(AnnualSavingMode).optional(),
        isArchived: z.boolean(),
        savingRates: z
          .array(
            z.object({
              startMonth: z.string().refine(isMonthKey),
              monthlyAmount: z.number().int().positive(),
            }),
          )
          .optional(),
        entries: z.array(
          z.object({
            amount: z.number().int().positive(),
            entryType: z.enum(["CONTRIBUTION", "WITHDRAWAL"]),
            createdAt: z.string(),
          }),
        ),
      }),
    )
    .optional(),
  months: z.array(
    z.object({
      monthKey: z.string().refine(isMonthKey),
      note: z.string().nullable(),
      isLocked: z.boolean(),
      createdAt: z.string(),
      updatedAt: z.string(),
      annualSavingOverrideBackupKeys: z.array(z.string()).optional(),
      snapshots: z.array(importSnapshotSchema).max(2),
      expenses: z.array(importExpenseSchema),
    }),
  ),
});
