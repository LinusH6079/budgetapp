import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { exportHouseholdDataForUser } from "@/server/services/import-export";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await exportHouseholdDataForUser(session.user.id);
  const fileName = `${slugify(data.householdName || "budgetkompis")}-backup.json`;

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
