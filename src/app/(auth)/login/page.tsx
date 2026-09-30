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
  const { next } = await searchParams;
  const adminMode = next?.startsWith("/admin") ?? false;
  if (ctx.userId) redirect(adminMode ? "/admin" : "/");

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-semibold">🏓 {ctx.club.name}</h1>
      <p className="mb-6 text-sm text-muted">{adminMode ? "Вход в админ-панель" : "Вход в клуб"}</p>
      <LoginForm next={adminMode ? "/admin" : next} />
      {adminMode ? (
        <p className="mt-6 text-sm text-muted">
          <Link href="/login" className="text-accent underline">← Вход для игроков</Link>
        </p>
      ) : (
        <div className="mt-6 space-y-3 text-sm text-muted">
          <p>
            Нет аккаунта?{" "}
            <Link href="/signup" className="text-accent underline">
              Зарегистрироваться
            </Link>
          </p>
          <Link href="/login?next=/admin" className="btn-secondary w-full">
            🔐 Вход для администратора
          </Link>
        </div>
      )}
    </div>
  );
}
