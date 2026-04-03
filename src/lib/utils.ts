import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function notFoundMessage(entity: string) {
  return `${entity} hittades inte.`;
}

export function formatDateTime(date: Date | null | undefined) {
  if (!date) {
    return "Ingen uppgift";
  }

  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function assertNever(value: never) {
  throw new Error(`Otillåtet värde: ${String(value)}`);
}
