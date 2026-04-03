import bcrypt from "bcryptjs";
import { ExpenseType, HouseholdRole, PayerType, PlanningType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed ska bara köras i utvecklingsmiljö.");
  }

  await prisma.expense.deleteMany();
  await prisma.monthlyPersonSnapshot.deleteMany();
  await prisma.budgetMonth.deleteMany();
  await prisma.householdInvite.deleteMany();
  await prisma.householdMember.deleteMany();
  await prisma.household.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("demo12345", 12);

  const [linus, alex] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Linus",
        email: "linus@example.com",
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        name: "Alex",
        email: "alex@example.com",
        passwordHash,
      },
    }),
  ]);

  const household = await prisma.household.create({
    data: {
      name: "Linus & Alex",
    },
  });

  await prisma.householdMember.createMany({
    data: [
      {
        householdId: household.id,
        userId: linus.id,
        role: HouseholdRole.OWNER,
      },
      {
        householdId: household.id,
        userId: alex.id,
        role: HouseholdRole.MEMBER,
      },
    ],
  });

  const march = await prisma.budgetMonth.create({
    data: {
      householdId: household.id,
      monthKey: "2026-03",
      note: "Sportlov och högre matkostnad.",
      updatedByUserId: linus.id,
    },
  });

  const april = await prisma.budgetMonth.create({
    data: {
      householdId: household.id,
      monthKey: "2026-04",
      note: "Bilservice och några spontanköp.",
      updatedByUserId: alex.id,
    },
  });

  await prisma.monthlyPersonSnapshot.createMany({
    data: [
      {
        budgetMonthId: march.id,
        userId: linus.id,
        incomeAmount: 305000,
        carryOverAmount: 25000,
        updatedByUserId: linus.id,
      },
      {
        budgetMonthId: march.id,
        userId: alex.id,
        incomeAmount: 278000,
        carryOverAmount: 22000,
        updatedByUserId: alex.id,
      },
      {
        budgetMonthId: april.id,
        userId: linus.id,
        incomeAmount: 305000,
        carryOverAmount: 18000,
        updatedByUserId: linus.id,
      },
      {
        budgetMonthId: april.id,
        userId: alex.id,
        incomeAmount: 278000,
        carryOverAmount: 15000,
        updatedByUserId: alex.id,
      },
    ],
  });

  await prisma.expense.createMany({
    data: [
      {
        budgetMonthId: march.id,
        name: "Hyra",
        amount: 145000,
        category: "Boende",
        expenseType: ExpenseType.RECURRING,
        planningType: PlanningType.PLANNED,
        payerType: PayerType.SHARED,
        dueDate: new Date("2026-03-28"),
        isPaid: true,
        paidAt: new Date("2026-03-28"),
        updatedByUserId: linus.id,
      },
      {
        budgetMonthId: march.id,
        name: "El",
        amount: 18500,
        category: "Boende",
        expenseType: ExpenseType.RECURRING,
        planningType: PlanningType.PLANNED,
        payerType: PayerType.SHARED,
        dueDate: new Date("2026-03-26"),
        isPaid: true,
        paidAt: new Date("2026-03-25"),
        updatedByUserId: alex.id,
      },
      {
        budgetMonthId: march.id,
        name: "Matbutik",
        amount: 72000,
        category: "Mat",
        expenseType: ExpenseType.ONE_TIME,
        planningType: PlanningType.PLANNED,
        payerType: PayerType.SHARED,
        dueDate: new Date("2026-03-31"),
        isPaid: true,
        paidAt: new Date("2026-03-31"),
        updatedByUserId: alex.id,
      },
      {
        budgetMonthId: april.id,
        name: "Hyra",
        amount: 145000,
        category: "Boende",
        expenseType: ExpenseType.RECURRING,
        planningType: PlanningType.PLANNED,
        payerType: PayerType.SHARED,
        dueDate: new Date("2026-04-28"),
        isPaid: true,
        paidAt: new Date("2026-04-28"),
        updatedByUserId: linus.id,
      },
      {
        budgetMonthId: april.id,
        name: "El",
        amount: 17400,
        category: "Boende",
        expenseType: ExpenseType.RECURRING,
        planningType: PlanningType.PLANNED,
        payerType: PayerType.SHARED,
        dueDate: new Date("2026-04-26"),
        isPaid: false,
        updatedByUserId: alex.id,
      },
      {
        budgetMonthId: april.id,
        name: "Bilservice",
        amount: 84000,
        category: "Bil",
        expenseType: ExpenseType.ONE_TIME,
        planningType: PlanningType.PLANNED,
        payerType: PayerType.FIRST_PERSON,
        dueDate: new Date("2026-04-15"),
        isPaid: true,
        paidAt: new Date("2026-04-15"),
        updatedByUserId: linus.id,
      },
      {
        budgetMonthId: april.id,
        name: "Take away",
        amount: 4800,
        category: "Mat",
        expenseType: ExpenseType.ONE_TIME,
        planningType: PlanningType.UNPLANNED,
        payerType: PayerType.SHARED,
        dueDate: new Date("2026-04-20"),
        isPaid: true,
        paidAt: new Date("2026-04-20"),
        updatedByUserId: alex.id,
      },
      {
        budgetMonthId: april.id,
        name: "Streaming",
        amount: 12900,
        category: "Abonnemang",
        expenseType: ExpenseType.RECURRING,
        planningType: PlanningType.PLANNED,
        payerType: PayerType.SECOND_PERSON,
        dueDate: new Date("2026-04-03"),
        isPaid: false,
        updatedByUserId: alex.id,
      },
    ],
  });

  console.log("Seed klar.");
  console.log("Demoanvändare: linus@example.com / demo12345");
  console.log("Demoanvändare: alex@example.com / demo12345");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
