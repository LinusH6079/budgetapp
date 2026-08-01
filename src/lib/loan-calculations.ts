export type LoanAmortization = "ANNUITY" | "STRAIGHT";

export type LoanRateInput = {
  startMonth: string;
  annualInterestBps: number;
};

export type LoanScheduleRow = {
  sequence: number;
  monthKey: string;
  annualInterestBps: number;
  openingPrincipal: number;
  principalAmount: number;
  interestAmount: number;
  feeAmount: number;
  totalAmount: number;
  closingPrincipal: number;
};

export function nextLoanMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function effectiveRate(rates: LoanRateInput[], monthKey: string) {
  return [...rates]
    .filter((rate) => rate.startMonth <= monthKey)
    .sort((left, right) => right.startMonth.localeCompare(left.startMonth))[0]
    ?.annualInterestBps ?? 0;
}

function annuityPrincipalAndInterest(
  principal: number,
  annualInterestBps: number,
  months: number,
) {
  if (months <= 0 || principal <= 0) return 0;
  const monthlyRate = annualInterestBps / 10_000 / 12;
  if (monthlyRate === 0) return Math.ceil(principal / months);
  return Math.round(
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months)),
  );
}

export function buildLoanSchedule(input: {
  principal: number;
  termMonths: number;
  amortizationType: LoanAmortization;
  monthlyFee: number;
  startMonth: string;
  rates: LoanRateInput[];
  extraPayments?: Record<string, number>;
  annuityPaymentAmount?: number;
  straightPrincipalAmount?: number;
}) {
  if (input.principal <= 0 || input.termMonths <= 0) return [];

  const rows: LoanScheduleRow[] = [];
  const straightPrincipal =
    input.straightPrincipalAmount ??
    Math.ceil(input.principal / input.termMonths);
  let principal = input.principal;
  let monthKey = input.startMonth;
  let activeRate = -1;
  let annuityAmount = 0;

  for (let index = 0; index < input.termMonths && principal > 0; index += 1) {
    const annualInterestBps = effectiveRate(input.rates, monthKey);
    const monthsRemaining = input.termMonths - index;
    if (input.amortizationType === "ANNUITY" && annualInterestBps !== activeRate) {
      annuityAmount =
        index === 0 && input.annuityPaymentAmount
          ? input.annuityPaymentAmount
          : annuityPrincipalAndInterest(
              principal,
              annualInterestBps,
              monthsRemaining,
            );
      activeRate = annualInterestBps;
    }

    const openingPrincipal = principal;
    const interestAmount = Math.round(
      (openingPrincipal * annualInterestBps) / 10_000 / 12,
    );
    const scheduledPrincipal =
      index === input.termMonths - 1
        ? openingPrincipal
        : input.amortizationType === "STRAIGHT"
          ? straightPrincipal
          : Math.max(0, annuityAmount - interestAmount);
    const principalAmount = Math.min(openingPrincipal, scheduledPrincipal);
    const totalAmount = principalAmount + interestAmount + input.monthlyFee;
    const extraPayment = Math.max(0, input.extraPayments?.[monthKey] ?? 0);
    principal = Math.max(0, openingPrincipal - principalAmount - extraPayment);

    rows.push({
      sequence: index + 1,
      monthKey,
      annualInterestBps,
      openingPrincipal,
      principalAmount,
      interestAmount,
      feeAmount: input.monthlyFee,
      totalAmount,
      closingPrincipal: principal,
    });
    monthKey = nextLoanMonthKey(monthKey);
  }

  return rows;
}

export function calculateFinancingComparison(input: {
  purchasePrice: number;
  downPayment: number;
  annualInterestBps: number;
  termMonths: number;
  setupFee: number;
  monthlyFee: number;
  amortizationType: LoanAmortization;
  startMonth: string;
}) {
  const principal = Math.max(0, input.purchasePrice - input.downPayment);
  const schedule = buildLoanSchedule({
    principal,
    termMonths: input.termMonths,
    amortizationType: input.amortizationType,
    monthlyFee: input.monthlyFee,
    startMonth: input.startMonth,
    rates: [{
      startMonth: input.startMonth,
      annualInterestBps: input.annualInterestBps,
    }],
  });
  const totalInterest = schedule.reduce(
    (sum, row) => sum + row.interestAmount,
    0,
  );
  const totalFees =
    input.setupFee + schedule.reduce((sum, row) => sum + row.feeAmount, 0);
  const totalLoanCost =
    input.downPayment +
    input.setupFee +
    schedule.reduce((sum, row) => sum + row.totalAmount, 0);

  return {
    principal,
    schedule,
    initialCashPayment: input.downPayment + input.setupFee,
    firstMonthlyPayment: schedule[0]?.totalAmount ?? 0,
    averageMonthlyPayment:
      schedule.length > 0
        ? Math.round(
            schedule.reduce((sum, row) => sum + row.totalAmount, 0) /
              schedule.length,
          )
        : 0,
    lastMonthlyPayment: schedule.at(-1)?.totalAmount ?? 0,
    totalInterest,
    totalFees,
    totalLoanCost,
    extraCostComparedWithCash: Math.max(0, totalLoanCost - input.purchasePrice),
  };
}
