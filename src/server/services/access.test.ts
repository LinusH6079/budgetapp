import { describe, expect, it } from "vitest";

import {
  AccessError,
  assertHouseholdHasCapacity,
  assertInviteUsable,
  assertMonthEditable,
} from "@/server/services/access";

describe("access rules", () => {
  it("stoppar hushåll med fler än två personer", () => {
    expect(() => assertHouseholdHasCapacity(2)).toThrow(AccessError);
  });

  it("stoppar förbrukade invites", () => {
    expect(() =>
      assertInviteUsable(
        {
          usedAt: new Date(),
          expiresAt: new Date(Date.now() + 1000),
        },
        1,
      ),
    ).toThrow(AccessError);
  });

  it("stoppar ändringar i låsta månader", () => {
    expect(() => assertMonthEditable(true)).toThrow(AccessError);
  });
});
