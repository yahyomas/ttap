# TT Club Platform (ttap)

Клубная платформа для матчей, рейтинга и турниров. Спека: `docs/product_spec.md`.

## Стек

- **Next.js 15** (App Router, Server Actions) — user web + admin web + Telegram webhook (Phase 5)
- **Supabase** — Postgres, Auth, RLS, Realtime, pg_cron
- **Vitest** — unit-тесты домена (`src/domain`)

```
src/
  app/            маршруты (user web, /admin, /auth)
  components/     UI
  domain/rating/  rating engine — чистый TS, без I/O (spec §41–§42)
  lib/actions/    Server Actions (auth, onboarding, admin)
  lib/supabase/   клиенты + сгенерированные типы БД
  lib/session.ts  getSessionContext / requireMember / requireAdmin
supabase/migrations/   SQL-миграции (уже применены к проекту cjaziveugiiuzplbqbtg)
```

## Запуск

```bash
npm install
npm run dev       # http://localhost:3000
npm test          # rating engine tests
npm run typecheck
```

`.env.local` уже содержит URL и anon key. `SUPABASE_SERVICE_ROLE_KEY` понадобится с Phase 3
(Supabase Dashboard → Project Settings → API → service_role).

## Первый администратор

1. Зарегистрируйтесь через `/signup` (и подтвердите email, если включено в Supabase Auth).
2. В Supabase SQL Editor:
   ```sql
   select public.bootstrap_club_admin('tt-club', 'you@example.com');
   ```
3. Обновите страницу — в шапке появится «Админка».

## Supabase Auth — настройки

Dashboard → Authentication → URL Configuration:
- Site URL: `http://localhost:3000` (на проде — домен)
- Redirect URLs: `http://localhost:3000/auth/callback`

Для быстрого локального тестирования можно отключить «Confirm email» в Authentication → Providers → Email.

## Ключевые решения (см. спеку и `src/domain/rating`)

- `players.current_rating` — проекция; источник истины — `rating_transactions` (idempotent по `event_id`).
- Новичок: `NEW` (rating NULL) → `PROVISIONAL` (после 1-го турнира) → `ESTABLISHED` (после 6-го).
- Челленджи с игроком `NEW` не влияют на рейтинг (решение владельца продукта).
- Подтверждённый RTTF инициализирует Club Rating как `PROVISIONAL` (`external_seed_policy`).
- Все правила rating engine — в `clubs.settings.rating`, дефолты в `src/domain/rating/config.ts`.

## Фазы

- [x] Phase 1 — Foundation: схема, auth, онбординг, одобрение, профили, игроки
- [x] Phase 2 (ядро) — rating engine + тесты, внешние рейтинги, ручные корректировки, история, лидерборд
- [ ] Phase 3 — Tournaments (single elimination, снапшот рейтингов при lock, newcomer initial rating)
- [ ] Phase 4 — Challenges & match confirmation
- [ ] Phase 5 — Telegram bot (linking, notifications via outbox, actions)
- [ ] Phase 6 — Analytics & polish
