"use server";

import { createHouseholdSchema, joinHouseholdSchema } from "@/lib/validations";
import { requireUser } from "@/lib/session";
import { importHouseholdDataForUser } from "@/server/services/import-export";
import {
  createHouseholdForUser,
  createInviteForUser,
  joinHouseholdByCode,
} from "@/server/services/households";

import { redirectWithMessage, revalidateBudgetPaths } from "./shared";

export async function createHouseholdAction(formData: FormData) {
  const user = await requireUser();
  const parsed = createHouseholdSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    redirectWithMessage("/app/household", "error", parsed.error.issues[0]?.message ?? "Ogiltigt hushållsnamn.");
  }

  try {
    await createHouseholdForUser(user.id, parsed.data.name);
  } catch (error) {
    redirectWithMessage(
      "/app/household",
      "error",
      error instanceof Error ? error.message : "Kunde inte skapa hushåll.",
    );
  }

  revalidateBudgetPaths("/app/household");
  redirectWithMessage("/app/household", "notice", "Hushållet skapades.");
}

export async function createInviteAction() {
  const user = await requireUser();

  try {
    await createInviteForUser(user.id);
  } catch (error) {
    redirectWithMessage(
      "/app/household",
      "error",
      error instanceof Error ? error.message : "Kunde inte skapa invite-kod.",
    );
  }

  revalidateBudgetPaths("/app/household");
  redirectWithMessage("/app/household", "notice", "Ny invite-kod skapades.");
}

export async function joinHouseholdAction(formData: FormData) {
  const user = await requireUser();
  const parsed = joinHouseholdSchema.safeParse({
    code: formData.get("code"),
  });

  if (!parsed.success) {
    redirectWithMessage("/app/household", "error", parsed.error.issues[0]?.message ?? "Ogiltig invite-kod.");
  }

  try {
    await joinHouseholdByCode(user.id, parsed.data.code);
  } catch (error) {
    redirectWithMessage(
      "/app/household",
      "error",
      error instanceof Error ? error.message : "Kunde inte gå med i hushållet.",
    );
  }

  revalidateBudgetPaths("/app/household");
  redirectWithMessage("/app/household", "notice", "Du gick med i hushållet.");
}

export async function importHouseholdAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = String(formData.get("returnTo") || "/app/household");
  const jsonText = String(formData.get("jsonText") || "");
  const file = formData.get("jsonFile");

  let rawJson = jsonText.trim();

  if (!rawJson && file instanceof File) {
    rawJson = await file.text();
  }

  if (!rawJson) {
    redirectWithMessage(returnTo, "error", "Lägg till JSON-text eller välj en JSON-fil.");
  }

  try {
    await importHouseholdDataForUser(user.id, rawJson);
  } catch (error) {
    redirectWithMessage(
      returnTo,
      "error",
      error instanceof Error ? error.message : "Importen misslyckades.",
    );
  }

  revalidateBudgetPaths(returnTo);
  redirectWithMessage(returnTo, "notice", "Importen är klar.");
}
