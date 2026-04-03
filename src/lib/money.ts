const SEK_FORMATTER = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(amountInCents: number) {
  return SEK_FORMATTER.format(amountInCents / 100);
}

export function parseCurrencyInput(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  if (typeof value !== "string") {
    throw new Error("Belopp måste vara text eller nummer.");
  }

  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");

  if (normalized.length === 0) {
    return 0;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error("Beloppet kunde inte tolkas.");
  }

  return Math.round(parsed * 100);
}

export function formatEditableAmount(amountInCents: number) {
  return (amountInCents / 100).toString();
}
