import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export function redirectWithMessage(
  returnTo: string,
  type: "notice" | "error",
  message: string,
): never {
  const url = new URL(returnTo, "http://localhost");
  url.searchParams.set(type, message);
  redirect(`${url.pathname}${url.search}`);
}

export function revalidateBudgetPaths(returnTo?: string) {
  revalidatePath("/app");
  revalidatePath("/app/household");
  revalidatePath("/app/months");

  if (returnTo) {
    const url = new URL(returnTo, "http://localhost");
    revalidatePath(url.pathname);
  }
}
