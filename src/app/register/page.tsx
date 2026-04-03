import { AuthForm } from "@/components/auth-form";
import { registerAction } from "@/server/actions/auth-actions";

type RegisterPageProps = {
  searchParams: Promise<{
    error?: string;
    invite?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { error, invite } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <AuthForm mode="register" action={registerAction} inviteCode={invite} error={error} />
    </main>
  );
}
