"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";

import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { loginSchema, registerSchema } from "@/lib/validations";
import { joinHouseholdByCode } from "@/server/services/households";

import { redirectWithMessage } from "./shared";

export async function loginAction(formData: FormData) {
  const returnTo = String(formData.get("returnTo") || "/app");
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirectWithMessage("/login", "error", parsed.error.issues[0]?.message ?? "Ogiltig inloggning.");
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: returnTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirectWithMessage("/login", "error", "Fel e-postadress eller lösenord.");
    }

    throw error;
  }
}

export async function registerAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    inviteCode: formData.get("inviteCode"),
  });

  if (!parsed.success) {
    redirectWithMessage("/register", "error", parsed.error.issues[0]?.message ?? "Kunde inte skapa konto.");
  }

  const existing = await db.user.findUnique({
    where: {
      email: parsed.data.email,
    },
  });

  if (existing) {
    redirectWithMessage("/register", "error", "Det finns redan ett konto med den e-postadressen.");
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
    },
  });

  if (parsed.data.inviteCode) {
    try {
      await joinHouseholdByCode(user.id, parsed.data.inviteCode);
    } catch (error) {
      redirectWithMessage(
        "/register",
        "error",
        error instanceof Error ? error.message : "Kunde inte gå med i hushållet.",
      );
    }
  }

  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: "/app",
  });
}

export async function logoutAction() {
  await signOut({
    redirectTo: "/login",
  });
}
