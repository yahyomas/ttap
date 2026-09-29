import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { SignupForm } from "./SignupForm";

export default async function SignupPage() {
  const ctx = await getSessionContext();
  if (ctx.userId) redirect("/");

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-semibold">🏓 {ctx.club.name}</h1>
      <p className="mb-6 text-sm text-muted">Создание аккаунта</p>
      <SignupForm />
      <p className="mt-6 text-sm text-muted">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-accent underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
