import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { signOut } from "@/lib/actions/auth";

export default async function BlockedPage() {
  const ctx = await getSessionContext();
  if (!ctx.userId) redirect("/login");
  if (ctx.player?.status !== "BLOCKED") redirect("/");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 text-center">
      <div className="card">
        <h1 className="text-xl font-semibold">Аккаунт заблокирован</h1>
        <p className="mt-2 text-sm text-muted">
          {ctx.player.blocked_reason ?? "Обратитесь к администратору клуба."}
        </p>
        <form action={signOut} className="mt-6">
          <button className="btn-secondary">Выйти</button>
        </form>
      </div>
    </div>
  );
}
