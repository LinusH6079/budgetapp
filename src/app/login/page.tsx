import { AuthForm } from "@/components/auth-form";
import { loginAction } from "@/server/actions/auth-actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <AuthForm mode="login" action={loginAction} error={error} />
    </main>
  );
}
