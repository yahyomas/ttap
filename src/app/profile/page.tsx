import { redirect } from "next/navigation";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { PageTitle, Rating, RatingStatusBadge, VerificationBadge } from "@/components/ui";
import { ProfileForm } from "./ProfileForm";
import { TelegramCard } from "./TelegramCard";
import { updateNotificationPrefs } from "@/lib/actions/telegram";

export default async function ProfilePage() {
  const ctx = await requireMember();
  if (!ctx.player) redirect("/admin");
  const supabase = await createClient();

  const [{ data: ext }, { data: tg }, { data: me }] = await Promise.all([
    supabase.from("player_external_ratings").select("*").eq("player_id", ctx.player.id),
    supabase.from("telegram_accounts").select("username, first_name, linked_at").eq("user_id", ctx.userId!).maybeSingle(),
    supabase.from("users").select("notification_prefs").eq("id", ctx.userId!).maybeSingle(),
  ]);
  const prefs = (me?.notification_prefs ?? {}) as Record<string, boolean>;

  return (
    <AppShell ctx={ctx}>
      <PageTitle>Мой профиль</PageTitle>
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <ProfileForm player={ctx.player} />
        <div className="space-y-4">
          <div className="card">
            <div className="text-sm text-muted">Club Rating</div>
            <div className="mt-1 text-3xl font-semibold"><Rating value={ctx.player.current_rating} /></div>
            <div className="mt-2"><RatingStatusBadge value={ctx.player.rating_status} /></div>
          </div>
          <div className="card">
            <div className="mb-2 text-sm font-medium">Внешние рейтинги</div>
            {(ext ?? []).length === 0 ? (
              <div className="text-sm text-muted">Не указаны</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {ext!.map((e) => (
                  <li key={e.id} className="flex items-center justify-between">
                    <span>{e.source}: <b>{e.rating}</b></span>
                    <VerificationBadge value={e.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <TelegramCard linked={tg ?? null} botUsername={process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? ""} />
          <form action={updateNotificationPrefs} className="card space-y-2">
            <div className="mb-1 text-sm font-medium">Уведомления</div>
            {([["challenge", "Вызовы"], ["tournament", "Турниры"], ["match", "Результаты матчей"], ["rating", "Изменения рейтинга"]] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={k} defaultChecked={prefs[k] !== false} /> {label}
              </label>
            ))}
            <button className="btn-secondary mt-2 w-full">Сохранить</button>
          </form>
          <div className="card text-xs text-muted">
            Аккаунт: {ctx.email}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
