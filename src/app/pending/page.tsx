import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { signOut } from "@/lib/actions/auth";

export default async function PendingPage() {
  const ctx = await getSessionContext();
  if (!ctx.userId) redirect("/login");
  if (!ctx.player) redirect("/onboarding");
  if (ctx.player.status === "ACTIVE") redirect("/");
  if (ctx.player.status === "BLOCKED") redirect("/blocked");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 text-center">
      <div className="card">
        <div className="mb-3 text-4xl">⏳</div>
        <h1 className="text-xl font-semibold">Профиль отправлен на проверку</h1>
        <p className="mt-2 text-sm text-muted">
          Администратор клуба одобрит ваш аккаунт. После этого вам откроются рейтинг, игроки и турниры.
        </p>
        <p className="mt-4 text-sm">
          {ctx.player.display_name} · {ctx.player.playing_hand === "LEFT" ? "Левая" : "Правая"} рука
        </p>
        <form action={signOut} className="mt-6">
          <button className="btn-secondary">Выйти</button>
        </form>
      </div>
    </div>
  );
}
