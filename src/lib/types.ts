import { Prisma } from "@prisma/client";

export const householdMembersInclude = {
  members: {
    include: {
      user: true,
    },
    orderBy: {
      joinedAt: "asc",
    },
  },
} satisfies Prisma.HouseholdInclude;

export const householdWithMembersArgs = {
  include: householdMembersInclude,
} satisfies Prisma.HouseholdDefaultArgs;

export type HouseholdWithMembers = Prisma.HouseholdGetPayload<typeof householdWithMembersArgs>;

export const budgetMonthDetailsArgs = {
  include: {
    updatedByUser: true,
    household: {
      include: householdMembersInclude,
    },
    personSnapshots: {
      include: {
        user: true,
        updatedByUser: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    },
    expenses: {
      include: {
        updatedByUser: true,
      },
      orderBy: [
        {
          dueDate: "asc",
        },
        {
          name: "asc",
        },
      ],
    },
  },
} satisfies Prisma.BudgetMonthDefaultArgs;

export type BudgetMonthWithDetails = Prisma.BudgetMonthGetPayload<typeof budgetMonthDetailsArgs>;
