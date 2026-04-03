import { HouseholdInvite } from "@prisma/client";

export class AccessError extends Error {}

export function assertCanCreateHousehold(hasExistingHousehold: boolean) {
  if (hasExistingHousehold) {
    throw new AccessError("Du tillhör redan ett hushåll.");
  }
}

export function assertHouseholdHasCapacity(memberCount: number) {
  if (memberCount >= 2) {
    throw new AccessError("Hushållet har redan två medlemmar.");
  }
}

export function assertInviteUsable(
  invite: Pick<HouseholdInvite, "usedAt" | "expiresAt">,
  memberCount: number,
) {
  if (invite.usedAt) {
    throw new AccessError("Invite-koden har redan använts.");
  }

  if (invite.expiresAt < new Date()) {
    throw new AccessError("Invite-koden har gått ut.");
  }

  assertHouseholdHasCapacity(memberCount);
}

export function assertMonthEditable(isLocked: boolean) {
  if (isLocked) {
    throw new AccessError("Månaden är låst och måste låsas upp innan den kan ändras.");
  }
}
