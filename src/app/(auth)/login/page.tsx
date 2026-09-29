import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const ctx = await getSessionContext();
  if (ctx.userId) redirect("/");
  const { next } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-semibold">🏓 {ctx.club.name}</h1>
      <p className="mb-6 text-sm text-muted">Вход в клуб</p>
      <LoginForm next={next} />
      <p className="mt-6 text-sm text-muted">
        Нет аккаунта?{" "}
        <Link href="/signup" className="text-accent underline">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}
