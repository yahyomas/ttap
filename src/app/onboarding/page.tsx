import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/session";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const ctx = await getSessionContext();
  if (!ctx.userId) redirect("/login");
  if (ctx.player) redirect(ctx.player.status === "PENDING" ? "/pending" : "/");

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Добро пожаловать в {ctx.club.name}</h1>
      <p className="mb-6 text-sm text-muted">
        Заполните спортивный профиль. После проверки администратором вы получите доступ к клубу.
      </p>
      <OnboardingForm />
    </div>
  );
}
