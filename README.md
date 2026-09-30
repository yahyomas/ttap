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
npm test              # unit: rating engine + bracket generator
npm run test:integration   # сквозной прогон турнира против реального Supabase (нужен seed ниже)
npm run typecheck
```

`.env.local` содержит все ключи (Supabase, бот, секреты webhook/cron). См. `.env.example`.

## Telegram-бот (@ermak_ttap_bot)

```bash
npm run tg:poll                         # локально: long polling + доставка outbox каждые 10 с
npm run tg:webhook -- https://домен     # прод: регистрирует webhook /api/telegram/webhook
```
Одновременно polling и webhook работать не могут. На проде дополнительно включите cron из
`supabase/seed/smoke.sql` (pg_net → `/api/notifications/dispatch`) как страховку.

Привязка (два способа): (1) игрок пишет боту — бот выдаёт 6-значный код, игрок вводит его в Профиль → Telegram;
(2) профиль → «Получить ссылку» → одноразовая ссылка `t.me/<bot>?start=<token>` (10 мин).
Непривязанный пользователь на любое сообщение получает онбординг с кодом.
Действия из бота идут через `tg_act()` — RPC от service role, который на время транзакции
подставляет `auth.uid()` привязанного пользователя и вызывает те же RPC, что и сайт (§57).

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

## Тестовые данные

`supabase/seed/smoke.sql` (SQL Editor) создаёт админа `smoke-admin@test.local`, игроков `smoke-timur@`, `smoke-dima@`,
`smoke-aziz@test.local` (пароль у всех `smoke-test-2026`) и 6 seed-игроков. Нужен для `npm run test:integration`
и ручной проверки турниров и челленджей (откройте два браузера под разными игроками).

## Ключевые решения (см. спеку и `src/domain/rating`)

- `players.current_rating` — проекция; источник истины — `rating_transactions` (idempotent по `event_id`).
- Новичок: `NEW` (rating NULL) → `PROVISIONAL` (после 1-го турнира) → `ESTABLISHED` (после 6-го).
- Челленджи с игроком `NEW` не влияют на рейтинг (решение владельца продукта).
- Подтверждённый RTTF инициализирует Club Rating как `PROVISIONAL` (`external_seed_policy`).
- Все правила rating engine — в `clubs.settings.rating`, дефолты в `src/domain/rating/config.ts`.
- **Турниры:** дельты считаются от рейтингов, зафиксированных при формировании сетки (`rating_at_lock`), — результат не зависит от порядка ввода. Матч с игроком `NEW` — без рейтинга для обеих сторон; новичок получает стартовый рейтинг при завершении турнира (`NEWCOMER_INITIAL`: среднее соперников ± 25 за победу/поражение, шаг 25, мин. 100). Формула живёт в TS; RPC получает готовые дельты, сверяет `rating_before` с текущей проекцией и применяет всё в одной транзакции.
- Исправление результата (§45) возможно, пока следующий матч не сыгран: REVERSAL-транзакции + новые. Полный пересчёт турнира — в бэклоге.
- **Челленджи:** один открытый вызов на пару игроков; непринятый вызов истекает в назначенное время (pg_cron, каждые 15 мин). Результат вносит любой из двоих, второй подтверждает или отклоняет с комментарием. Через `settings.challenges.confirm_hours` (48) внёсший может подтвердить сам; админ — всегда. Рейтинг — от текущих рейтингов с `challenge_k`. Матч с `NEW` — без рейтинга.
- **Уведомления** пишутся в `notifications` внутри той же транзакции, что и событие (outbox). Telegram-доставка (Phase 5) будет читать `telegram_sent_at is null`.

## Фазы

- [x] Phase 1 — Foundation: схема, auth, онбординг, одобрение, профили, игроки
- [x] Phase 2 (ядро) — rating engine + тесты, внешние рейтинги, ручные корректировки, история, лидерборд
- [x] Phase 3 — Tournaments: single elimination, посев, byes, снапшот рейтингов при lock, ввод/исправление результатов, завершение, стартовый рейтинг новичков
- [x] Phase 4 — Challenges: вызов → принятие → ввод счёта → подтверждение соперником (или отклонение, или по таймауту), рейтинг; in-app уведомления (outbox для Telegram)
- [x] Phase 5 — Telegram: привязка по одноразовой ссылке, доставка outbox, команды, inline-действия (принять вызов, зарегистрироваться)
- [ ] Phase 6 — Analytics & polish
