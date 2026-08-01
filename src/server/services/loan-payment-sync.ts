import {
  ExpenseOrigin,
  ExpenseType,
  LoanStatus,
  PlanningType,
  Prisma,
} from "@prisma/client";

export async function syncLoanExpenses(input: {
  tx: Prisma.TransactionClient;
  householdId: string;
  actorUserId: string;
}) {
  const [loans, months] = await Promise.all([
    input.tx.loan.findMany({
      where: {
        householdId: input.householdId,
        status: LoanStatus.ACTIVE,
      },
      include: {
        installments: {
          include: {
            expense: true,
          },
        },
      },
    }),
    input.tx.budgetMonth.findMany({
      where: {
        householdId: input.householdId,
      },
      select: {
        id: true,
        monthKey: true,
        isLocked: true,
      },
    }),
  ]);
  const monthByKey = new Map(months.map((month) => [month.monthKey, month]));

  for (const loan of loans) {
    for (const installment of loan.installments) {
      const month = monthByKey.get(installment.monthKey);
      if (!month || month.isLocked) continue;

      const data = {
        budgetMonthId: month.id,
        name: `Lån: ${loan.name}`,
        amount: installment.totalAmount,
        category: "Lån",
        expenseType: ExpenseType.ONE_TIME,
        origin: ExpenseOrigin.LOAN_PAYMENT,
        planningType: PlanningType.PLANNED,
        payerType: loan.payerType,
        dueDate: null,
        note: null,
        updatedByUserId: input.actorUserId,
      } as const;

      if (installment.expense) {
        if (!installment.expense.isPaid) {
          await input.tx.expense.update({
            where: { id: installment.expense.id },
            data,
          });
        }
        continue;
      }

      const expense = await input.tx.expense.create({ data });
      await input.tx.loanInstallment.update({
        where: { id: installment.id },
        data: { expenseId: expense.id },
      });
    }
  }
}
