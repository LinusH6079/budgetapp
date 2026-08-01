import {
  ExpenseOrigin,
  ExpenseType,
  FinancingDecision,
  LoanAmortizationType,
  LoanStatus,
  PayerType,
  PlanningType,
  Prisma,
} from "@prisma/client";

import {
  buildLoanSchedule,
  calculateFinancingComparison,
  nextLoanMonthKey,
} from "@/lib/loan-calculations";
import { db } from "@/lib/db";
import { assertMonthEditable } from "@/server/services/access";
import { getHouseholdForUser } from "@/server/services/households";
import { syncLoanExpenses } from "@/server/services/loan-payment-sync";

type LoanSetupInput = {
  name: string;
  principal: number;
  annualInterestBps: number;
  termMonths: number;
  setupFee: number;
  monthlyFee: number;
  amortizationType: LoanAmortizationType;
  startMonth: string;
  payerType: PayerType;
  initialCashAmount?: number;
};

async function requireLoanAccess(actorUserId: string, loanId: string) {
  const loan = await db.loan.findFirst({
    where: {
      id: loanId,
      household: { members: { some: { userId: actorUserId } } },
    },
    include: {
      household: { include: { members: true } },
      ratePeriods: { orderBy: { startMonth: "asc" } },
      installments: {
        orderBy: { sequence: "asc" },
        include: {
          expense: { include: { budgetMonth: true } },
        },
      },
      extraPayments: { include: { expense: true } },
    },
  });

  if (!loan) throw new Error("Lånet hittades inte.");
  return loan;
}

function assertPayerAvailable(payerType: PayerType, memberCount: number) {
  if (payerType !== PayerType.FIRST_PERSON && memberCount < 2) {
    throw new Error("Den andra personen har inte gått med i hushållet ännu.");
  }
}

async function createLoanWithSchedule(input: {
  tx: Prisma.TransactionClient;
  householdId: string;
  actorUserId: string;
  financingCaseId?: string | null;
  setup: LoanSetupInput;
}) {
  const loan = await input.tx.loan.create({
    data: {
      householdId: input.householdId,
      financingCaseId: input.financingCaseId ?? null,
      name: input.setup.name,
      initialPrincipal: input.setup.principal,
      termMonths: input.setup.termMonths,
      setupFee: input.setup.setupFee,
      monthlyFee: input.setup.monthlyFee,
      amortizationType: input.setup.amortizationType,
      startMonth: input.setup.startMonth,
      payerType: input.setup.payerType,
      updatedByUserId: input.actorUserId,
      ratePeriods: {
        create: {
          startMonth: input.setup.startMonth,
          annualInterestBps: input.setup.annualInterestBps,
          updatedByUserId: input.actorUserId,
        },
      },
    },
  });
  if ((input.setup.initialCashAmount ?? 0) > 0) {
    const startMonth = await input.tx.budgetMonth.findUnique({
      where: {
        householdId_monthKey: {
          householdId: input.householdId,
          monthKey: input.setup.startMonth,
        },
      },
    });
    if (!startMonth) {
      throw new Error("Skapa lånets första budgetmånad innan lånet aktiveras.");
    }
    assertMonthEditable(startMonth.isLocked);
    await input.tx.expense.create({
      data: {
        budgetMonthId: startMonth.id,
        name: `Kontantinsats: ${input.setup.name}`,
        amount: input.setup.initialCashAmount!,
        category: "Finansiering",
        expenseType: ExpenseType.ONE_TIME,
        origin: ExpenseOrigin.FINANCING_CASH,
        planningType: PlanningType.PLANNED,
        payerType: input.setup.payerType,
        updatedByUserId: input.actorUserId,
      },
    });
  }
  const schedule = buildLoanSchedule({
    principal: input.setup.principal,
    termMonths: input.setup.termMonths,
    amortizationType: input.setup.amortizationType,
    monthlyFee: input.setup.monthlyFee,
    startMonth: input.setup.startMonth,
    rates: [{
      startMonth: input.setup.startMonth,
      annualInterestBps: input.setup.annualInterestBps,
    }],
  });
  await input.tx.loanInstallment.createMany({
    data: schedule.map((row) => ({
      loanId: loan.id,
      sequence: row.sequence,
      monthKey: row.monthKey,
      openingPrincipal: row.openingPrincipal,
      principalAmount: row.principalAmount,
      interestAmount: row.interestAmount,
      feeAmount: row.feeAmount,
      totalAmount: row.totalAmount,
    })),
  });
  await syncLoanExpenses({
    tx: input.tx,
    householdId: input.householdId,
    actorUserId: input.actorUserId,
  });
  return loan;
}

export async function createFinancingCaseForUser(input: {
  actorUserId: string;
  name: string;
  purchasePrice: number;
  downPayment: number;
  annualInterestBps: number;
  termMonths: number;
  setupFee: number;
  monthlyFee: number;
  amortizationType: LoanAmortizationType;
  startMonth: string;
  payerType: PayerType;
}) {
  const household = await getHouseholdForUser(input.actorUserId);
  if (!household) throw new Error("Du behöver ett hushåll först.");
  assertPayerAvailable(input.payerType, household.members.length);

  return db.financingCase.create({
    data: {
      householdId: household.id,
      name: input.name,
      purchasePrice: input.purchasePrice,
      downPayment: input.downPayment,
      annualInterestBps: input.annualInterestBps,
      termMonths: input.termMonths,
      setupFee: input.setupFee,
      monthlyFee: input.monthlyFee,
      amortizationType: input.amortizationType,
      startMonth: input.startMonth,
      payerType: input.payerType,
      updatedByUserId: input.actorUserId,
    },
  });
}

export async function deleteFinancingCaseForUser(input: {
  actorUserId: string;
  caseId: string;
}) {
  const financingCase = await db.financingCase.findFirst({
    where: {
      id: input.caseId,
      household: { members: { some: { userId: input.actorUserId } } },
    },
  });
  if (!financingCase) throw new Error("Jämförelsen hittades inte.");
  if (financingCase.decision !== FinancingDecision.UNDECIDED) {
    throw new Error("En aktiverad jämförelse kan inte tas bort från historiken.");
  }
  return db.financingCase.delete({ where: { id: financingCase.id } });
}

export async function activateFinancingCaseForUser(input: {
  actorUserId: string;
  caseId: string;
  decision: "LOAN" | "CASH";
  monthId?: string | null;
}) {
  const financingCase = await db.financingCase.findFirst({
    where: {
      id: input.caseId,
      household: { members: { some: { userId: input.actorUserId } } },
    },
    include: { household: { include: { members: true } } },
  });
  if (!financingCase) throw new Error("Jämförelsen hittades inte.");
  if (financingCase.decision !== FinancingDecision.UNDECIDED) {
    throw new Error("Jämförelsen har redan aktiverats.");
  }

  return db.$transaction(async (tx) => {
    if (input.decision === "CASH") {
      const month = input.monthId
        ? await tx.budgetMonth.findFirst({
            where: { id: input.monthId, householdId: financingCase.householdId },
          })
        : null;
      if (!month) throw new Error("Budgetmånaden hittades inte.");
      assertMonthEditable(month.isLocked);
      const expense = await tx.expense.create({
        data: {
          budgetMonthId: month.id,
          name: financingCase.name,
          amount: financingCase.purchasePrice,
          category: "Finansiering",
          expenseType: ExpenseType.ONE_TIME,
          origin: ExpenseOrigin.FINANCING_CASH,
          planningType: PlanningType.PLANNED,
          payerType: financingCase.payerType,
          updatedByUserId: input.actorUserId,
        },
      });
      return tx.financingCase.update({
        where: { id: financingCase.id },
        data: {
          decision: FinancingDecision.CASH,
          cashExpenseId: expense.id,
          updatedByUserId: input.actorUserId,
        },
      });
    }

    const loan = await createLoanWithSchedule({
      tx,
      householdId: financingCase.householdId,
      actorUserId: input.actorUserId,
      financingCaseId: financingCase.id,
      setup: {
        name: financingCase.name,
        principal: financingCase.purchasePrice - financingCase.downPayment,
        annualInterestBps: financingCase.annualInterestBps,
        termMonths: financingCase.termMonths,
        setupFee: financingCase.setupFee,
        monthlyFee: financingCase.monthlyFee,
        amortizationType: financingCase.amortizationType,
        startMonth: financingCase.startMonth,
        payerType: financingCase.payerType,
        initialCashAmount: financingCase.downPayment + financingCase.setupFee,
      },
    });
    await tx.financingCase.update({
      where: { id: financingCase.id },
      data: {
        decision: FinancingDecision.LOAN,
        updatedByUserId: input.actorUserId,
      },
    });
    return loan;
  });
}

export async function registerExistingLoanForUser(input: {
  actorUserId: string;
  setup: LoanSetupInput;
}) {
  const household = await getHouseholdForUser(input.actorUserId);
  if (!household) throw new Error("Du behöver ett hushåll först.");
  assertPayerAvailable(input.setup.payerType, household.members.length);

  return db.$transaction((tx) =>
    createLoanWithSchedule({
      tx,
      householdId: household.id,
      actorUserId: input.actorUserId,
      setup: input.setup,
    }),
  );
}

export async function getLoanDashboardForUser(actorUserId: string) {
  const household = await getHouseholdForUser(actorUserId);
  if (!household) return null;
  await db.$transaction((tx) =>
    syncLoanExpenses({ tx, householdId: household.id, actorUserId }),
  );
  const [cases, loans, months] = await Promise.all([
    db.financingCase.findMany({
      where: { householdId: household.id, isArchived: false },
      orderBy: { updatedAt: "desc" },
    }),
    db.loan.findMany({
      where: { householdId: household.id },
      include: {
        ratePeriods: { orderBy: { startMonth: "asc" } },
        installments: {
          orderBy: { sequence: "asc" },
          include: { expense: true },
        },
        extraPayments: { include: { expense: true } },
        updatedByUser: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.budgetMonth.findMany({
      where: { householdId: household.id, isLocked: false },
      select: { id: true, monthKey: true },
      orderBy: { monthKey: "asc" },
    }),
  ]);

  return {
    household,
    months,
    cases: cases.map((item) => ({
      ...item,
      comparison: calculateFinancingComparison({
        purchasePrice: item.purchasePrice,
        downPayment: item.downPayment,
        annualInterestBps: item.annualInterestBps,
        termMonths: item.termMonths,
        setupFee: item.setupFee,
        monthlyFee: item.monthlyFee,
        amortizationType: item.amortizationType,
        startMonth: item.startMonth,
      }),
    })),
    loans: loans.map((loan) => {
      const nextInstallment = loan.installments.find(
        (installment) => !installment.expense?.isPaid,
      );
      const paidPrincipal = loan.installments.reduce(
        (sum, installment) =>
          sum + (installment.expense?.isPaid ? installment.principalAmount : 0),
        0,
      );
      const paidExtras = loan.extraPayments.reduce(
        (sum, payment) => sum + (payment.expense?.isPaid ? payment.amount : 0),
        0,
      );
      return {
        ...loan,
        remainingPrincipal: Math.max(
          0,
          loan.initialPrincipal - paidPrincipal - paidExtras,
        ),
        nextInstallment: nextInstallment ?? null,
      };
    }),
  };
}

export async function changeLoanRateForUser(input: {
  actorUserId: string;
  loanId: string;
  startMonth: string;
  annualInterestBps: number;
}) {
  const loan = await requireLoanAccess(input.actorUserId, input.loanId);
  if (loan.status !== LoanStatus.ACTIVE) throw new Error("Lånet är inte aktivt.");
  const target = loan.installments.find((row) => row.monthKey === input.startMonth);
  if (!target) throw new Error("Startmånaden finns inte i den återstående planen.");
  const replaced = loan.installments.filter((row) => row.sequence >= target.sequence);
  if (replaced.some((row) => row.expense?.isPaid || row.expense?.budgetMonth.isLocked)) {
    throw new Error("Räntan kan inte ändras över en betald eller låst månad.");
  }

  return db.$transaction(async (tx) => {
    const expenseIds = replaced.flatMap((row) => row.expenseId ? [row.expenseId] : []);
    if (expenseIds.length) await tx.expense.deleteMany({ where: { id: { in: expenseIds } } });
    await tx.loanInstallment.deleteMany({
      where: { loanId: loan.id, sequence: { gte: target.sequence } },
    });
    await tx.loanRatePeriod.deleteMany({
      where: { loanId: loan.id, startMonth: { gte: input.startMonth } },
    });
    await tx.loanRatePeriod.create({
      data: {
        loanId: loan.id,
        startMonth: input.startMonth,
        annualInterestBps: input.annualInterestBps,
        updatedByUserId: input.actorUserId,
      },
    });
    const schedule = buildLoanSchedule({
      principal: target.openingPrincipal,
      termMonths: loan.termMonths - target.sequence + 1,
      amortizationType: loan.amortizationType,
      monthlyFee: loan.monthlyFee,
      startMonth: input.startMonth,
      rates: [{ startMonth: input.startMonth, annualInterestBps: input.annualInterestBps }],
    });
    await tx.loanInstallment.createMany({
      data: schedule.map((row) => ({
        loanId: loan.id,
        sequence: target.sequence + row.sequence - 1,
        monthKey: row.monthKey,
        openingPrincipal: row.openingPrincipal,
        principalAmount: row.principalAmount,
        interestAmount: row.interestAmount,
        feeAmount: row.feeAmount,
        totalAmount: row.totalAmount,
      })),
    });
    await tx.loan.update({
      where: { id: loan.id },
      data: { updatedByUserId: input.actorUserId },
    });
    await syncLoanExpenses({ tx, householdId: loan.householdId, actorUserId: input.actorUserId });
  });
}

export async function addLoanExtraPaymentForUser(input: {
  actorUserId: string;
  loanId: string;
  monthId: string;
  amount: number;
}) {
  const loan = await requireLoanAccess(input.actorUserId, input.loanId);
  const month = await db.budgetMonth.findFirst({
    where: { id: input.monthId, householdId: loan.householdId },
  });
  if (!month) throw new Error("Budgetmånaden hittades inte.");
  assertMonthEditable(month.isLocked);

  return db.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        budgetMonthId: month.id,
        name: `Extra amortering: ${loan.name}`,
        amount: input.amount,
        category: "Lån",
        expenseType: ExpenseType.ONE_TIME,
        origin: ExpenseOrigin.LOAN_EXTRA_PAYMENT,
        planningType: PlanningType.PLANNED,
        payerType: loan.payerType,
        updatedByUserId: input.actorUserId,
      },
    });
    return tx.loanExtraPayment.create({
      data: {
        loanId: loan.id,
        monthKey: month.monthKey,
        amount: input.amount,
        expenseId: expense.id,
        updatedByUserId: input.actorUserId,
      },
    });
  });
}

export async function adjustLoanInstallmentForUser(input: {
  actorUserId: string;
  loanId: string;
  installmentId: string;
  monthId: string;
  totalAmount: number;
}) {
  const loan = await requireLoanAccess(input.actorUserId, input.loanId);
  if (loan.status !== LoanStatus.ACTIVE) throw new Error("Lånet är inte aktivt.");
  const target = loan.installments.find((row) => row.id === input.installmentId);
  if (!target) throw new Error("Betalningen hittades inte.");
  if (target.expense?.isPaid || target.expense?.budgetMonth.isLocked) {
    throw new Error("En betald eller låst betalning kan inte justeras.");
  }
  const destinationMonth = await db.budgetMonth.findFirst({
    where: { id: input.monthId, householdId: loan.householdId },
  });
  if (!destinationMonth) throw new Error("Budgetmånaden hittades inte.");
  assertMonthEditable(destinationMonth.isLocked);
  if (destinationMonth.monthKey < loan.startMonth) {
    throw new Error("Betalningen kan inte flyttas före lånets startmånad.");
  }
  const minimumAmount = target.interestAmount + target.feeAmount + 1;
  if (input.totalAmount < minimumAmount) {
    throw new Error("Beloppet måste täcka ränta, avgift och minst en krona amortering.");
  }
  const principalAmount = Math.min(
    target.openingPrincipal,
    input.totalAmount - target.interestAmount - target.feeAmount,
  );
  const normalizedTotal = principalAmount + target.interestAmount + target.feeAmount;
  const future = loan.installments.filter((row) => row.sequence > target.sequence);
  if (future.some((row) => row.expense?.isPaid || row.expense?.budgetMonth.isLocked)) {
    throw new Error("Framtida betalda eller låsta månader hindrar omräkningen.");
  }

  return db.$transaction(async (tx) => {
    const futureExpenseIds = future.flatMap((row) => row.expenseId ? [row.expenseId] : []);
    if (futureExpenseIds.length) {
      await tx.expense.deleteMany({ where: { id: { in: futureExpenseIds } } });
    }
    await tx.loanInstallment.deleteMany({
      where: { loanId: loan.id, sequence: { gt: target.sequence } },
    });
    let expenseId = target.expenseId;
    if (expenseId) {
      await tx.expense.update({
        where: { id: expenseId },
        data: {
          budgetMonthId: destinationMonth.id,
          amount: normalizedTotal,
          updatedByUserId: input.actorUserId,
        },
      });
    } else {
      const expense = await tx.expense.create({
        data: {
          budgetMonthId: destinationMonth.id,
          name: `Lån: ${loan.name}`,
          amount: normalizedTotal,
          category: "Lån",
          expenseType: ExpenseType.ONE_TIME,
          origin: ExpenseOrigin.LOAN_PAYMENT,
          planningType: PlanningType.PLANNED,
          payerType: loan.payerType,
          updatedByUserId: input.actorUserId,
        },
      });
      expenseId = expense.id;
    }
    await tx.loanInstallment.update({
      where: { id: target.id },
      data: {
        monthKey: destinationMonth.monthKey,
        principalAmount,
        totalAmount: normalizedTotal,
        expenseId,
      },
    });

    const remainingPrincipal = target.openingPrincipal - principalAmount;
    if (remainingPrincipal > 0) {
      const nextMonth = nextLoanMonthKey(destinationMonth.monthKey);
      const rate = [...loan.ratePeriods]
        .filter((item) => item.startMonth <= nextMonth)
        .at(-1)?.annualInterestBps ?? 0;
      const schedule = buildLoanSchedule({
        principal: remainingPrincipal,
        termMonths: Math.max(1, loan.termMonths - target.sequence),
        amortizationType: loan.amortizationType,
        monthlyFee: loan.monthlyFee,
        startMonth: nextMonth,
        rates: [{ startMonth: nextMonth, annualInterestBps: rate }],
      });
      await tx.loanInstallment.createMany({
        data: schedule.map((row) => ({
          loanId: loan.id,
          sequence: target.sequence + row.sequence,
          monthKey: row.monthKey,
          openingPrincipal: row.openingPrincipal,
          principalAmount: row.principalAmount,
          interestAmount: row.interestAmount,
          feeAmount: row.feeAmount,
          totalAmount: row.totalAmount,
        })),
      });
    }
    await tx.loan.update({
      where: { id: loan.id },
      data: { updatedByUserId: input.actorUserId },
    });
    await syncLoanExpenses({ tx, householdId: loan.householdId, actorUserId: input.actorUserId });
  });
}

export async function rebuildLoanAfterExtraPayment(input: {
  tx: Prisma.TransactionClient;
  actorUserId: string;
  loanId: string;
  monthKey: string;
}) {
  const loan = await input.tx.loan.findUnique({
    where: { id: input.loanId },
    include: {
      ratePeriods: { orderBy: { startMonth: "asc" } },
      installments: {
        orderBy: { sequence: "asc" },
        include: { expense: { include: { budgetMonth: true } } },
      },
      extraPayments: { include: { expense: true } },
    },
  });
  if (!loan || loan.status === LoanStatus.CANCELLED) return;
  const current = loan.installments.find((row) => row.monthKey === input.monthKey);
  if (!current) return;
  const nextMonth = nextLoanMonthKey(input.monthKey);
  const future = loan.installments.filter((row) => row.sequence > current.sequence);
  if (future.some((row) => row.expense?.isPaid || row.expense?.budgetMonth.isLocked)) {
    throw new Error("Framtida betalda eller låsta månader hindrar omräkningen.");
  }
  const paidExtra = loan.extraPayments
    .filter((payment) => payment.monthKey === input.monthKey && payment.expense?.isPaid)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const principal = Math.max(
    0,
    current.openingPrincipal - current.principalAmount - paidExtra,
  );

  const expenseIds = future.flatMap((row) => row.expenseId ? [row.expenseId] : []);
  if (expenseIds.length) await input.tx.expense.deleteMany({ where: { id: { in: expenseIds } } });
  await input.tx.loanInstallment.deleteMany({
    where: { loanId: loan.id, sequence: { gt: current.sequence } },
  });
  if (principal === 0) {
    const allScheduledPaymentsPaid = loan.installments
      .filter((row) => row.sequence <= current.sequence)
      .every((row) => row.expense?.isPaid);
    await input.tx.loan.update({
      where: { id: loan.id },
      data: {
        status: allScheduledPaymentsPaid
          ? LoanStatus.PAID_OFF
          : LoanStatus.ACTIVE,
        updatedByUserId: input.actorUserId,
      },
    });
    return;
  }
  const activeRate = [...loan.ratePeriods]
    .filter((rate) => rate.startMonth <= nextMonth)
    .at(-1)?.annualInterestBps ?? 0;
  const firstFuture = future[0];
  const schedule = buildLoanSchedule({
    principal,
    termMonths: Math.max(1, loan.termMonths - current.sequence),
    amortizationType: loan.amortizationType,
    monthlyFee: loan.monthlyFee,
    startMonth: nextMonth,
    rates: [{ startMonth: nextMonth, annualInterestBps: activeRate }],
    annuityPaymentAmount:
      loan.amortizationType === LoanAmortizationType.ANNUITY && firstFuture
        ? firstFuture.totalAmount - firstFuture.feeAmount
        : undefined,
    straightPrincipalAmount:
      loan.amortizationType === LoanAmortizationType.STRAIGHT && firstFuture
        ? firstFuture.principalAmount
        : undefined,
  });
  await input.tx.loanInstallment.createMany({
    data: schedule.map((row) => ({
      loanId: loan.id,
      sequence: current.sequence + row.sequence,
      monthKey: row.monthKey,
      openingPrincipal: row.openingPrincipal,
      principalAmount: row.principalAmount,
      interestAmount: row.interestAmount,
      feeAmount: row.feeAmount,
      totalAmount: row.totalAmount,
    })),
  });
  await input.tx.loan.update({
    where: { id: loan.id },
    data: { status: LoanStatus.ACTIVE, updatedByUserId: input.actorUserId },
  });
  await syncLoanExpenses({
    tx: input.tx,
    householdId: loan.householdId,
    actorUserId: input.actorUserId,
  });
}

export async function syncLoanStatusFromInstallments(input: {
  tx: Prisma.TransactionClient;
  actorUserId: string;
  loanId: string;
}) {
  const loan = await input.tx.loan.findUnique({
    where: { id: input.loanId },
    include: {
      installments: {
        include: { expense: { select: { isPaid: true } } },
      },
    },
  });
  if (!loan || loan.status === LoanStatus.CANCELLED) return;
  const isPaidOff =
    loan.installments.length > 0 &&
    loan.installments.every((row) => row.expense?.isPaid);
  await input.tx.loan.update({
    where: { id: loan.id },
    data: {
      status: isPaidOff ? LoanStatus.PAID_OFF : LoanStatus.ACTIVE,
      updatedByUserId: input.actorUserId,
    },
  });
}
