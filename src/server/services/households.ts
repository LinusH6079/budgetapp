import { randomBytes } from "node:crypto";

import { HouseholdRole } from "@prisma/client";

import { db } from "@/lib/db";
import { HouseholdWithMembers, householdWithMembersArgs } from "@/lib/types";
import {
  assertCanCreateHousehold,
  assertHouseholdHasCapacity,
  assertInviteUsable,
} from "@/server/services/access";

export type HouseholdMemberSlot = "FIRST_PERSON" | "SECOND_PERSON";

export function mapMembersToSlots(household: HouseholdWithMembers) {
  return household.members.map((member, index) => ({
    id: member.id,
    userId: member.userId,
    name: member.user.name,
    email: member.user.email,
    role: member.role,
    joinedAt: member.joinedAt,
    slot: (index === 0 ? "FIRST_PERSON" : "SECOND_PERSON") as HouseholdMemberSlot,
  }));
}

export async function getHouseholdForUser(userId: string) {
  const membership = await db.householdMember.findUnique({
    where: {
      userId,
    },
    include: {
      household: householdWithMembersArgs,
    },
  });

  return membership?.household ?? null;
}

export async function createHouseholdForUser(userId: string, name: string) {
  const existing = await db.householdMember.findUnique({
    where: {
      userId,
    },
  });

  assertCanCreateHousehold(Boolean(existing));

  return db.household.create({
    data: {
      name,
      members: {
        create: {
          userId,
          role: HouseholdRole.OWNER,
        },
      },
    },
    ...householdWithMembersArgs,
  });
}

export async function createInviteForUser(userId: string) {
  const household = await getHouseholdForUser(userId);

  if (!household) {
    throw new Error("Du måste skapa eller gå med i ett hushåll först.");
  }

  assertHouseholdHasCapacity(household.members.length);

  return db.householdInvite.create({
    data: {
      householdId: household.id,
      createdByUserId: userId,
      code: randomBytes(4).toString("hex").toUpperCase(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });
}

export async function joinHouseholdByCode(userId: string, code: string) {
  const existing = await db.householdMember.findUnique({
    where: {
      userId,
    },
  });

  assertCanCreateHousehold(Boolean(existing));

  const invite = await db.householdInvite.findUnique({
    where: {
      code,
    },
    include: {
      household: {
        include: {
          members: {
            include: {
              user: true,
            },
            orderBy: {
              joinedAt: "asc",
            },
          },
          budgetRows: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!invite) {
    throw new Error("Invite-koden hittades inte.");
  }

  assertInviteUsable(invite, invite.household.members.length);

  return db.$transaction(async (tx) => {
    const membership = await tx.householdMember.create({
      data: {
        householdId: invite.householdId,
        userId,
        role: HouseholdRole.MEMBER,
      },
    });

    await tx.householdInvite.update({
      where: {
        id: invite.id,
      },
      data: {
        usedAt: new Date(),
      },
    });

    if (invite.household.budgetRows.length > 0) {
      await tx.monthlyPersonSnapshot.createMany({
        data: invite.household.budgetRows.map((month) => ({
          budgetMonthId: month.id,
          userId,
          incomeAmount: 0,
          carryOverAmount: 0,
          updatedByUserId: userId,
        })),
      });
    }

    return membership;
  });
}
