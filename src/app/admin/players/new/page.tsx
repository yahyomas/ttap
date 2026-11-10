import { requireAdmin } from "@/lib/session";
import { PageTitle } from "@/components/ui";
import { NewPlayerForm } from "./NewPlayerForm";

export default async function NewPlayerPage() {
  await requireAdmin();
  return (
    <>
      <PageTitle sub="Игрок станет активным сразу. Аккаунт для входа — по желанию: без него игрок участвует в турнирах, а результаты за него вносите вы.">
        Добавить игрока
      </PageTitle>
      <div className="max-w-lg">
        <NewPlayerForm />
      </div>
    </>
  );
}
