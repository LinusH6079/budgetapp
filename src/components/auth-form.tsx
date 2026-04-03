import Link from "next/link";

import { FormStatusButton } from "@/components/form-status-button";

type AuthFormProps = {
  mode: "login" | "register";
  action: (formData: FormData) => Promise<void>;
  inviteCode?: string;
  error?: string;
};

export function AuthForm({ mode, action, inviteCode, error }: AuthFormProps) {
  const isRegister = mode === "register";

  return (
    <div className="app-panel w-full max-w-md overflow-hidden px-6 py-8">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-muted)]">Budgetkompis</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
          {isRegister ? "Skapa konto" : "Logga in"}
        </h1>
        <p className="muted mt-2">
          {isRegister
            ? "Bygg ett delat månadsflöde för exakt två personer."
            : "Fortsätt till hushållets gemensamma budget."}
        </p>
      </div>

      {error ? (
        <div className="mb-5 rounded-3xl border border-[var(--color-danger)]/20 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      <form action={action} className="space-y-4">
        {isRegister ? (
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Namn</span>
            <input name="name" placeholder="Linus" required />
          </label>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-sm font-medium">E-post</span>
          <input name="email" type="email" placeholder="du@exempel.se" required />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Lösenord</span>
          <input name="password" type="password" placeholder="Minst 8 tecken" required />
        </label>

        {isRegister ? (
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Invite-kod</span>
            <input
              name="inviteCode"
              placeholder="Valfritt om du redan fått en kod"
              defaultValue={inviteCode}
            />
          </label>
        ) : null}

        {!isRegister ? <input type="hidden" name="returnTo" value="/app" /> : null}

        <FormStatusButton
          className="action-primary w-full"
          pendingLabel={isRegister ? "Skapar konto..." : "Loggar in..."}
        >
          {isRegister ? "Skapa konto" : "Logga in"}
        </FormStatusButton>
      </form>

      <p className="muted mt-5">
        {isRegister ? "Har du redan konto?" : "Saknar du konto?"}{" "}
        <Link
          href={isRegister ? "/login" : `/register${inviteCode ? `?invite=${inviteCode}` : ""}`}
          className="font-semibold text-[var(--color-accent)]"
        >
          {isRegister ? "Logga in" : "Registrera dig"}
        </Link>
      </p>
    </div>
  );
}
