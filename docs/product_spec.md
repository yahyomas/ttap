# Table Tennis Club Platform — Detailed Product Specification

> Рабочее название: **TT Club Platform**  
> Версия документа: **MVP v1.0**  
> Язык продукта на старте: русский  
> Основной рынок первого запуска: один настольный теннисный клуб в Ташкенте  
> Архитектура: **multi-tenant-ready**, даже несмотря на запуск с одним клубом

---

## 1. Краткое описание продукта

Это веб-платформа для управления жизнью настольного теннисного клуба: игроками, клубным рейтингом, матчами, челленджами, еженедельными турнирами, статистикой и историей результатов.

На старте продукт работает внутри **одного клуба**, но архитектура с самого начала должна поддерживать несколько клубов в будущем.

Главная идея продукта:

> Игрок приходит в клуб, играет обычные матчи или участвует в турнирах, все результаты фиксируются в одной системе, а его клубный рейтинг и история автоматически обновляются.

Продукт не должен пытаться заменить внешний рейтинг RTTF. Вместо этого он создаёт **собственную клубную рейтинговую систему**, которая использует алгоритм RTTF как основу.

При этом пользователь может видеть свои внешние/официальные рейтинги отдельно от клубного рейтинга.

---

## 2. Проблема

Сейчас клуб использует внешний портал RTTF, который не всегда работает стабильно или удобно для ежедневной клубной работы. Поэтому повседневные клубные игры, челленджи и турниры должны управляться внутри нашей собственной платформы.

Для клуба нужны гораздо более простые и оперативные сценарии:

- зарегистрировать игрока;
- видеть всех игроков клуба;
- понимать текущую силу игроков внутри клуба;
- играть обычные матчи между участниками;
- создавать челленджи;
- проводить регулярные турниры;
- автоматически строить сетку;
- заносить результаты матчей;
- автоматически пересчитывать клубный рейтинг;
- показывать историю изменений рейтинга;
- публиковать рейтинг и результаты;
- отправлять уведомления через Telegram.

---

## 3. Контекст официальных рейтингов

### 3.1. RTTF

RTTF используется как основа алгоритма клубного рейтинга в нашем MVP.

Важно разделять:

- **RTTF Rating** — внешний рейтинг игрока, который пользователь может указать/импортировать и который администратор клуба подтверждает;
- **Club Rating** — рейтинг игрока внутри нашей платформы, который рассчитывается по результатам клубных матчей и турниров.

Мы не должны смешивать эти три значения в одно поле.

---

# 4. Цели продукта

## 4.1. Основные цели MVP

1. Создать единую систему игроков клуба.
2. Дать каждому игроку личный кабинет.
3. Дать игроку прозрачный клубный рейтинг.
4. Автоматизировать расчёт рейтинга после матчей.
5. Реализовать челленджи между игроками.
6. Реализовать еженедельный пятничный турнир.
7. Автоматически строить турнирную сетку.
8. Дать администратору полный контроль над игроками, матчами, турнирами и рейтингом.
9. Дублировать ключевые действия и уведомления через Telegram-бота.
10. Подготовить архитектуру к запуску нескольких клубов в будущем.

## 4.2. Что продукт должен дать игроку

Игрок должен в любой момент понимать:

- какой у него Club Rating;
- какое место он занимает в клубе;
- какие матчи он сыграл;
- сколько матчей выиграл/проиграл;
- как менялся его рейтинг;
- какие активные челленджи доступны;
- в каких турнирах он участвует;
- с кем и когда он играет.

## 4.3. Что продукт должен дать администратору

Администратор должен иметь единый интерфейс для управления клубом:

- пользователи;
- игроки;
- рейтинги;
- матчи;
- челленджи;
- турниры;
- регистрации;
- сетки;
- результаты;
- корректировки;
- статистика;
- уведомления.

---

# 5. Целевая аудитория

## 5.1. Игрок клуба

Обычный участник клуба, который:

- создаёт аккаунт;
- указывает свои данные;
- указывает игровую руку;
- при наличии вводит RTTF рейтинг;
- играет матчи;
- участвует в челленджах;
- регистрируется на турниры;
- следит за рейтингом.

## 5.2. Администратор клуба

Управляет всей системой.

Может:

- одобрять игроков;
- редактировать профили;
- подтверждать внешние рейтинги;
- создавать турниры;
- открывать и закрывать регистрацию;
- генерировать сетки;
- вносить результаты;
- исправлять ошибки;
- отменять результаты;
- делать ручные корректировки рейтинга;
- блокировать игроков.

## 5.3. Система

Автоматически:

- рассчитывает изменения рейтинга;
- записывает историю;
- формирует статистику;
- определяет состояние новичка;
- обновляет лидерборды;
- отправляет Telegram-уведомления.

---

# 6. Поверхности продукта

MVP должен состоять из трёх основных частей.

## 6.1. User Web App

Веб-сайт для игроков.

Основные разделы:

- Главная;
- Рейтинг;
- Игроки;
- Матчи;
- Челленджи;
- Турниры;
- Мой профиль;
- История рейтинга.

## 6.2. Admin Web App

Отдельная админ-панель.

Основные разделы:

- Dashboard;
- Players;
- Users;
- Matches;
- Challenges;
- Tournaments;
- Rating;
- Statistics;
- Audit Log;
- Settings.

## 6.3. Telegram Bot

Telegram-бот не должен быть отдельной системой учёта.

**Источник истины — backend/API.**

Бот используется как:

- канал уведомлений;
- быстрый интерфейс действий;
- вход в ключевые сценарии;
- быстрый доступ к рейтингу и турнирам.

---

# 7. Основная модель пользователя

## 7.1. User vs Player

Необходимо разделить:

### User

Учетная запись человека в системе.

Содержит:

- login/email/phone/Telegram identity;
- password/auth credentials;
- роли;
- настройки уведомлений;
- дату регистрации;
- статус аккаунта.

### Player

Спортивная сущность, связанная с пользователем.

Содержит спортивную информацию:

- имя;
- фамилия;
- дата рождения;
- пол;
- игровая рука;
- Club Rating;
- RTTF Rating;
- статус новичка;
- статистику;
- историю рейтинга.

Это разделение важно для дальнейшего масштабирования.

---

# 8. Профиль игрока

## 8.1. Обязательные поля MVP

- First Name
- Last Name
- Username / Display Name
- Phone или email
- Дата рождения
- Пол
- **Игровая рука**
- Club Rating
- Статус рейтинга

## 8.2. Игровая рука

Поле:

```text
playing_hand
```

Значения:

```text
RIGHT — Правая
LEFT  — Левая
```

Поле должно присутствовать:

- при регистрации;
- в личном кабинете;
- в профиле игрока;
- в админке;
- в публичном профиле, если клуб разрешает отображение;
- в статистике в будущем.

Игровая рука **не влияет на расчёт рейтинга**.

В будущих версиях поле можно использовать для статистики вида:

- результаты против левшей;
- результаты против правшей;
- win rate vs left-handed;
- win rate vs right-handed.

---

# 9. Внешние рейтинги

Пользователь может при регистрации указать существующий рейтинг.

### Поля

```text
rttf_rating
```

Дополнительно желательно хранить:

```text
rttf_rating_verified
rttf_rating_source
verified_by
verified_at
```

### Важное правило

Пользователь не должен иметь возможность самостоятельно объявить любой высокий рейтинг как подтверждённый.

Пример:

```text
RTTF rating: 480
Status: Pending verification
```

После проверки администратор переводит значение в:

```text
RTTF rating: 480
Verified: Yes
```

---

# 10. Club Rating

## 10.1. Назначение

Club Rating — основной рейтинг платформы.

Он отражает текущую силу игрока **в рамках матчей клуба и клубных турниров**.

Это рейтинг нашей системы, а не официальный рейтинг федерации.

## 10.2. Принцип

В MVP используется алгоритм, основанный на правилах RTTF, которые мы обсуждали.

Основная формула изменения рейтинга победителя:

```text
Δ = [(100 − (Rv − Rp)) / 10] × k × D
```

где:

- `Rv` — рейтинг победителя;
- `Rp` — рейтинг проигравшего;
- `k` — коэффициент турнира;
- `D` — коэффициент разницы по сетам.

Для проигравшего изменение имеет противоположный знак.

---

# 11. Коэффициент турнира k

В обсуждённой схеме RTTF коэффициент зависит от среднего рейтинга участников турнира:

| Средний рейтинг турнира | k |
|---:|---:|
| < 250 | 0.20 |
| 250–350 | 0.25 |
| 350–450 | 0.30 |
| 450–550 | 0.35 |
| > 550 | 0.40 |

В реализации границы должны быть заданы в одном месте как конфигурация rating engine, а не разбросаны по бизнес-коду.

---

# 12. Коэффициент D

Коэффициент зависит от счёта матча.

| Результат | D |
|---|---:|
| 3:2 / 2:1 | 0.8 |
| 3:1 / 2:0 | 1.0 |
| 3:0 | 1.2 |

Это позволяет учитывать не только победу, но и характер победы.

---

# 13. Ограничение для большой разницы в рейтинге

Если победитель имеет преимущество **100 или более рейтинговых очков** над проигравшим, изменение рейтинга победителя должно быть равно 0 по обсуждённому RTTF-правилу.

При реализации это должно быть отдельным правилом rating engine, а не обходным условием в UI.

---

# 14. Новички

## 14.1. Главный принцип

Для нового игрока **не нужно присваивать всем одинаковый стартовый рейтинг**, например `500` или `1000`.

Мы используем специальный режим новичка по аналогии с RTTF.

Рекомендуемая модель состояний:

```text
NEW → PROVISIONAL → ESTABLISHED
```

### NEW

Игрок ещё не имеет рейтинга в нашей системе.

В интерфейсе:

```text
Club Rating: —
Status: New player
```

### PROVISIONAL

Игрок находится в режиме новичка в первые турниры.

### ESTABLISHED

Игрок перешёл на обычный режим расчёта рейтинга.

---

# 15. Правила новичка

В обсуждённой RTTF-модели:

- новичком считается игрок, сыгравший не более 5 турниров;
- для новичка `D = 1` независимо от счёта;
- при победе новичка `k = 1`;
- при поражении новичка `k = 0.5`;
- стартовый рейтинг определяется по результатам турнира, а не выдаётся одним фиксированным числом всем новичкам;
- стартовый рейтинг организатор может назначать с шагом 25 и минимумом 100;
- после следующих турниров рейтинг может корректироваться.

### Важный UX-принцип

До первого рейтингового турнира у нового пользователя не должно быть фиктивного числа.

То есть:

```text
Club Rating: —
```

лучше, чем:

```text
Club Rating: 500
```

Потому что `500` будет выглядеть как реальная измеренная сила игрока.

---

# 16. Счётчик турниров новичка

Для каждого игрока хранить:

```text
tournament_count
```

Но предпочтительно не полагаться только на одно число. Оно должно быть выводимым из истории участия либо периодически сверяться с ней.

Также хранить:

```text
rating_status
```

Значения:

```text
NEW
PROVISIONAL
ESTABLISHED
```

---

# 17. Не использовать Rating = 0

Для игрока без рейтинга нельзя использовать `0` как настоящий рейтинг.

Причины:

- это может искажать расчёты;
- выглядит как реальный рейтинг;
- может ломать сравнение новичков с опытными игроками;
- усложняет UI.

Правильнее использовать:

```text
rating = NULL
```

до появления первого валидного рейтингового результата.

---

# 18. Матчи

Каждый завершённый матч должен быть отдельной сущностью.

Минимальные поля:

```text
id
club_id
winner_player_id
loser_player_id
winner_sets
loser_sets
match_type
source
tournament_id
challenge_id
played_at
status
created_by
confirmed_at
```

### match_type

```text
CHALLENGE
TOURNAMENT
CASUAL
```

### status

```text
PENDING
CONFIRMED
CANCELLED
CORRECTED
```

---

# 19. Правила матча

Для MVP основной формат — одиночная игра.

Результат должен хранить не просто победителя, а конкретный счёт по сетам.

Например:

```text
Player A vs Player B
3 : 1
```

Это позволяет автоматически определить `D`.

Нельзя позволять обычному пользователю просто написать произвольное число рейтинговых очков.

Он сообщает результат матча, а rating engine рассчитывает изменение.

---

# 20. Челленджи

Челлендж — предложение одного игрока сыграть против другого.

## 20.1. Сценарий

1. Игрок открывает страницу Challenges.
2. Нажимает `Create Challenge`.
3. Выбирает соперника.
4. Предлагает дату/время.
5. Система создаёт challenge.
6. Соперник получает уведомление.
7. Соперник принимает или отклоняет.
8. После игры результат заносится в систему.
9. При подтверждении результат влияет на Club Rating.

## 20.2. Состояния

```text
PENDING
ACCEPTED
DECLINED
CANCELLED
EXPIRED
COMPLETED
```

## 20.3. Активные челленджи

На главной странице игрок видит:

- входящие челленджи;
- исходящие челленджи;
- принятые матчи;
- историю завершённых челленджей.

---

# 21. Еженедельный пятничный турнир

Один из главных сценариев продукта.

Каждую пятницу проводится регулярный клубный турнир.

## 21.1. Действия администратора

Администратор:

1. создаёт турнир;
2. задаёт дату/время;
3. задаёт название;
4. устанавливает дедлайн регистрации;
5. открывает регистрацию;
6. следит за списком участников;
7. закрывает регистрацию;
8. генерирует сетку;
9. контролирует результаты;
10. закрывает турнир.

## 21.2. Действия игрока

Игрок:

1. открывает Tournament;
2. видит дату;
3. видит статус регистрации;
4. нажимает Register;
5. получает подтверждение;
6. после формирования сетки видит своего первого соперника;
7. получает уведомления о следующих матчах.

---

# 22. Формат первого турнира

Для MVP рекомендуется поддержать только:

**Single Elimination**

То есть:

```text
1/16
  ↓
1/8
  ↓
1/4
  ↓
1/2
  ↓
Final
```

Не нужно на первом этапе реализовывать:

- double elimination;
- сложные group stages;
- Swiss system;
- round robin;
- комбинированные форматы.

Эти функции относятся к следующему этапу развития.

---

# 23. Генерация турнирной сетки

После закрытия регистрации администратор нажимает:

```text
Generate Bracket
```

Система создаёт пары.

Для MVP алгоритм посева должен быть настраиваемым, но базовый вариант:

- сортировать участников по Club Rating;
- использовать seed для сильнейших игроков;
- остальных распределять в свободные позиции;
- для одинакового рейтинга использовать стабильный tie-break/randomization.

Важно: способ посева должен сохраняться в Tournament Snapshot, чтобы после генерации нельзя было незаметно изменить историческую сетку.

---

# 24. Результат турнира

После каждого матча администратор или уполномоченный пользователь вводит:

```text
Player A
Player B
Score: 3:1
```

После подтверждения:

1. матч становится `CONFIRMED`;
2. rating engine рассчитывает изменения;
3. создаются rating transactions;
4. обновляются текущие рейтинги;
5. создаётся запись в истории;
6. обновляется таблица турнира;
7. игроки получают уведомление.

---

# 25. Rating Transaction

Нельзя хранить только текущее значение рейтинга.

Каждое изменение должно иметь отдельную транзакцию.

Пример:

```text
Player: Alex
Before: 420
Delta: +8
After: 428
Reason: Tournament match
Match: #1234
Created at: 2026-09-25 20:44
```

Это обеспечивает:

- историю;
- аудит;
- возможность пересчёта;
- исправление ошибок;
- объяснимость рейтинга.

---

# 26. История рейтинга

Игрок должен видеть timeline:

```text
25 Sep   +8   Tournament vs Bek
22 Sep   -5   Challenge vs Timur
19 Sep   +10  Tournament vs Aziz
```

Также нужен график:

```text
Rating
  |
450|       •
440|    •  /
430| •-/
420|/
   +----------------
      time
```

График относится к MVP, но может быть реализован после базовой истории.

---

# 27. Лидерборд

Главная публичная сущность продукта — рейтинг клуба.

Таблица:

| Rank | Player | Rating | W | L |
|---:|---|---:|---:|---:|
| 1 | Player A | 612 | 21 | 4 |
| 2 | Player B | 590 | 18 | 7 |
| 3 | Player C | 558 | 16 | 8 |

Клик по игроку открывает публичный профиль.

## Публичный профиль

Может показывать:

- имя;
- фото;
- игровую руку;
- Club Rating;
- рейтинг/место в клубе;
- Win/Loss;
- число матчей;
- последние результаты;
- историю рейтинга;
- участие в турнирах.

Отображение персональных данных должно контролироваться настройками приватности клуба.

---

# 28. Статистика игрока

Минимум:

```text
Matches played
Wins
Losses
Win rate
Current rating
Peak rating
Rating change this week
Tournament wins
Tournament participations
```

В будущем:

- win rate by opponent;
- streaks;
- head-to-head;
- win rate vs left-handed players;
- win rate vs right-handed players;
- performance in tournaments;
- performance by day/time.

---

# 29. Dashboard игрока

Главная страница пользователя должна быстро показывать:

```text
Hello, Alex

Club Rating
428

Club Rank
#17

This week
+12

Wins / Losses
12 / 8

Next challenge
vs Timur — Friday 19:00

Friday Tournament
Registration: Open
```

Основная ценность dashboard — не количество информации, а быстрый доступ к текущей активности.

---

# 30. Admin Dashboard

Администратор после входа должен видеть:

```text
Players              84
Active Challenges     7
Friday Tournament     18 registered
Matches this week    43
Pending Results       3
Pending Players       2
```

Дополнительно:

- последние матчи;
- последние регистрации;
- ошибки/аномалии;
- неподтверждённые рейтинги;
- активные турниры.

---

# 31. Админка — Players

Функции:

- список игроков;
- поиск;
- фильтр по рейтингу;
- фильтр по статусу;
- фильтр по игровой руке;
- открыть профиль;
- изменить данные;
- подтвердить RTTF;
- назначить/изменить Club Rating в рамках разрешённой ручной корректировки;
- блокировать игрока.

Колонки:

```text
Player
Club Rating
RTTF
Hand
Status
Matches
Joined
Actions
```

---

# 32. Админка — Matches

Администратор должен иметь возможность:

- найти матч;
- открыть детали;
- увидеть расчёт рейтинга;
- увидеть до/после;
- отменить матч;
- исправить результат;
- посмотреть кто создал результат;
- посмотреть дату изменения.

### Важный принцип исправлений

Не удалять историческую запись физически.

Лучше использовать:

```text
Original transaction
      ↓
Reversal transaction
      ↓
Correct transaction
```

Так сохраняется audit trail.

---

# 33. Админка — Tournaments

Функции:

- Create tournament;
- Edit tournament;
- Open registration;
- Close registration;
- View participants;
- Remove participant;
- Generate bracket;
- Lock bracket;
- Enter result;
- Correct result;
- Finish tournament;
- Recalculate if required;
- View rating impact.

---

# 34. Telegram Bot

Telegram должен быть первым каналом быстрого взаимодействия, потому что игроки клуба уже используют мессенджер.

## Основные команды

Пример:

```text
/start
/profile
/rating
/matches
/challenges
/tournaments
```

Также возможны inline/action кнопки:

```text
[Register for Friday Tournament]
[Accept Challenge]
[Decline]
[View Bracket]
[View My Rating]
```

## Уведомления

Бот отправляет:

- новый challenge;
- challenge принят;
- challenge отклонён;
- регистрация на турнир открыта;
- регистрация закрывается;
- игрок включён в турнир;
- создана сетка;
- назначен соперник;
- новый результат;
- изменился рейтинг;
- турнир завершён.

---

# 35. Telegram Authentication

Желательно связать Telegram Account с User.

После `/start`:

```text
Telegram ID
      ↓
User
      ↓
Player
```

Telegram ID должен быть уникальным.

Привязка должна проходить через безопасный flow подтверждения, а не по имени пользователя.

---

# 36. Роли и права доступа

MVP:

```text
PLAYER
ADMIN
```

В будущем:

```text
OWNER
ADMIN
MODERATOR
COACH
PLAYER
```

## PLAYER

Может:

- редактировать собственный профиль;
- смотреть рейтинг;
- создавать challenge;
- принимать challenge;
- регистрироваться в турнире;
- смотреть матчи;
- смотреть статистику.

Не может:

- менять чужой рейтинг;
- создавать официальные результаты самостоятельно без предусмотренного flow подтверждения;
- редактировать турнир;
- удалять матчи.

## ADMIN

Полный доступ к клубу.

---

# 37. Ключевые сущности БД

Минимальный набор:

```text
clubs
users
players
roles
player_external_ratings
matches
match_sets
challenges
tournaments
tournament_participants
tournament_brackets
tournament_rounds
rating_transactions
rating_snapshots
notifications
telegram_accounts
audit_logs
```

---

# 38. Предлагаемые связи

```text
Club
 ├── Users
 ├── Players
 ├── Tournaments
 ├── Matches
 ├── Challenges
 └── Rating History
```

```text
User 1 ─── 1 Player
Player 1 ─── N Matches
Player 1 ─── N RatingTransactions
Player N ─── N Tournaments
Player N ─── N Challenges
```

---

# 39. Club entity

Даже если первый запуск только для одного клуба, таблица `clubs` должна существовать.

Это позволит в будущем:

```text
Club A
Club B
Club C
```

при этом один backend и одна кодовая база смогут обслуживать несколько клубов.

Каждая спортивная сущность должна иметь `club_id`, где это применимо.

---

# 40. Multi-tenant architecture

MVP запускается для одного клуба, но архитектурно необходимо предусмотреть:

```text
tenant = club
```

Нельзя писать бизнес-логику вида:

```text
if club_id == 1
```

Все запросы и ограничения должны строиться вокруг `club_id`.

Это особенно важно для:

- игроков;
- рейтингов;
- матчей;
- турниров;
- challenges;
- leaderboard.

---

# 41. Rating Engine

Rating engine должен быть отдельным сервисным модулем внутри backend.

Не помещать расчёты непосредственно в controller.

Пример интерфейса:

```text
calculate_match_rating(match)
calculate_newcomer_rating(player, tournament)
create_rating_transactions(result)
recalculate_player_rating(player)
recalculate_tournament(tournament)
```

---

# 42. Rating Engine — требования

Расчёт должен быть:

- детерминированным;
- тестируемым;
- идемпотентным;
- воспроизводимым по истории;
- независимым от UI.

Для каждого расчёта желательно сохранять:

```text
rating_before
rating_delta
rating_after
k
D
opponent_rating
rating_status
calculation_version
```

`calculation_version` необходим для будущего изменения алгоритма без потери возможности объяснить старые результаты.

---

# 43. Идемпотентность

Это критически важно.

Один и тот же результат нельзя применить к рейтингу дважды из-за:

- повторного клика;
- retry API;
- повторного webhook;
- ошибки Telegram;
- race condition.

Для каждой rating transaction нужен уникальный идентификатор события, например:

```text
event_id
```

и уникальное ограничение.

---

# 44. Транзакционность

Изменение матча и рейтинга должно происходить в одной БД-транзакции.

Пример:

```text
Create/confirm match
        ↓
Validate result
        ↓
Calculate rating
        ↓
Insert rating transactions
        ↓
Update current ratings
        ↓
Commit
```

Если любой шаг падает, изменение не должно примениться частично.

---

# 45. Как обрабатывать исправление результата

Допустим:

```text
A beat B 3:1
```

После этого обнаружили ошибку, настоящий счёт:

```text
B beat A 3:2
```

Нельзя просто заменить поля матча и изменить текущий рейтинг.

Правильный flow:

```text
Original match
      ↓
Mark as corrected
      ↓
Reverse previous rating transactions
      ↓
Apply corrected result
      ↓
Create new rating transactions
      ↓
Update snapshots/current ratings
```

---

# 46. Регистрация пользователя

Flow:

```text
Sign Up
 ↓
Personal data
 ↓
Playing hand
 ↓
RTTF rating? ── Yes → Enter → Pending verification
 ↓ No
Club Rating = NULL
Status = NEW
 ↓
Admin approval
```

После одобрения пользователь получает доступ к клубу.

---

# 47. Регистрация с существующим рейтингом

Если у пользователя уже есть RTTF рейтинг:

```text
RTTF: 475
Verification: Pending
```

После проверки администратор:

```text
RTTF: 475
Verification: Verified
```

Это значение **не обязано автоматически становиться Club Rating**.

Бизнес-правило должно быть явным.

На старте рекомендуется:

- внешний рейтинг хранить отдельно;
- Club Rating назначать/инициализировать согласно правилам клуба;
- не скрывать от пользователя происхождение каждого рейтинга.

---

# 48. Модель Club Rating для игрока с внешним рейтингом

Рекомендуемый вариант MVP:

### Игрок с подтверждённым RTTF рейтингом

```text
External Rating
      ↓
Admin verification
      ↓
Club Rating initialization rule
```

### Новый игрок без внешнего рейтинга

```text
Club Rating = NULL
      ↓
First tournament
      ↓
Newcomer calculation
      ↓
Provisional rating
```

Конкретная политика инициализации Club Rating из внешнего рейтинга должна быть одной настройкой клуба, чтобы впоследствии её можно было изменить без миграции архитектуры.

---

# 49. Главная страница клуба

Публичная страница клуба может содержать:

```text
Club name
Current leaderboard
Upcoming Friday tournament
Active challenges count
Recent matches
Top movers
```

### Top Movers

Например:

```text
Biggest gain this week
+24

Biggest drop this week
-18
```

Это не отдельная рейтинговая система, а простой аналитический блок.

---

# 50. Турнирный рейтинг vs обычные матчи

В MVP нужно разделить источник матча:

```text
TOURNAMENT
CHALLENGE
CASUAL
```

И заранее определить, какие типы влияют на Club Rating.

Рекомендуемая базовая политика:

```text
TOURNAMENT → Да
CHALLENGE  → Да
CASUAL     → настройка клуба / по умолчанию Нет
```

Это позволит не превращать каждую тренировочную игру в рейтинговое событие.

---

# 51. Подтверждение обычных матчей

Чтобы избежать мошенничества, результат challenge не должен безоговорочно меняться от одного клика пользователя.

Возможная модель:

```text
Player A submits result
        ↓
Player B confirms
        ↓
Match becomes CONFIRMED
        ↓
Rating is updated
```

Администратор всегда может вмешаться.

Для Tournament матчей результат чаще всего вводит администратор/судья/назначенный оператор.

---

# 52. Аудит

Каждое критичное действие должно логироваться:

```text
who
what
when
entity
before
 after
reason
```

Особенно:

- изменение рейтинга;
- подтверждение внешнего рейтинга;
- исправление матча;
- отмена матча;
- изменение турнирной сетки;
- блокировка пользователя.

---

# 53. Уведомления

Модель:

```text
Notification
 ├── in-app
 └── telegram
```

Настройки пользователя:

```text
challenge_notifications
 tournament_notifications
 match_notifications
 rating_notifications
```

Email можно не делать в первой версии, если Telegram закрывает большую часть сценариев.

---

# 54. Поиск и фильтрация игроков

На странице Players:

- поиск по имени;
- поиск по username;
- диапазон Club Rating;
- игровая рука;
- статус игрока;
- активность.

В будущем:

- фильтр по RTTF;
- дата регистрации;
- возрастная категория.

---

# 55. Приватность

По умолчанию публично можно показывать только спортивную информацию:

- display name;
- avatar;
- club rating;
- статистику;
- игровые результаты.

Нельзя публично показывать без необходимости:

- телефон;
- email;
- служебные идентификаторы;
- Telegram ID;
- внутренние audit данные.

---

# 56. Авторизация

MVP:

- email/phone + password или passwordless flow;
- Telegram account linking;
- secure sessions/JWT according to backend architecture.

Администратор должен иметь усиленную защиту.

В будущем можно добавить:

- Telegram login;
- Google login;
- 2FA для администратора.

---

# 57. API

Backend API должен быть единым для web и Telegram.

Пример групп endpoint'ов:

```text
/auth/*
/users/*
/players/*
/matches/*
/challenges/*
/tournaments/*
/rating/*
/leaderboard/*
/notifications/*
/admin/*
/telegram/*
```

Не создавать отдельную бизнес-логику только для Telegram.

---

# 58. Пример REST/HTTP операций

```text
POST   /auth/register
POST   /auth/login
GET    /players
GET    /players/:id
PATCH  /players/:id
GET    /leaderboard
GET    /matches
POST   /challenges
POST   /challenges/:id/accept
POST   /challenges/:id/decline
GET    /tournaments
POST   /tournaments/:id/register
GET    /tournaments/:id/bracket
POST   /admin/tournaments
POST   /admin/tournaments/:id/generate-bracket
POST   /admin/matches/:id/result
GET    /players/:id/rating-history
```

---

# 59. Рейтинг — пример расчёта

Допустим:

```text
Winner rating = 430
Loser rating  = 410
Difference    = 20
Match         = 3:1
k             = 0.30
D             = 1.0
```

Тогда:

```text
Δ = [(100 - (430 - 410)) / 10] × 0.30 × 1.0
  = [(100 - 20) / 10] × 0.30
  = 8 × 0.30
  = 2.4
```

В системе необходимо определить правило хранения дробных значений:

- хранить decimal;
- либо использовать целые значения после установленного rounding rule.

Рекомендуется **не терять точность внутри расчёта**, а округление делать только по официальному правилу отображения/начисления.

---

# 60. Отдельное хранение calculation inputs

Для воспроизводимости нужно хранить данные, на основании которых был сделан расчёт:

```text
winner_rating_before
loser_rating_before
rating_difference
k
D
newcomer_mode
competition_average_rating
formula_version
```

Это позволит администратору открыть матч и увидеть:

```text
Why +2.4?
```

а не просто:

```text
+2
```

---

# 61. Публичная история турнира

После завершения турнира пользователь может открыть:

```text
Friday Tournament
25 September 2026
18 players
Champion: Player A
```

И посмотреть:

- всех участников;
- сетку;
- результаты;
- финальную таблицу;
- изменения рейтинга.

---

# 62. Пятничный турнир как регулярная сущность

В будущем нужно поддерживать шаблон:

```text
Friday Tournament Template
```

Чтобы администратор мог создавать следующий турнир на основе прошлого.

Но для MVP достаточно обычного создания нового турнира.

---

# 63. Рейтинг клуба

Leaderboard должен иметь минимум два режима:

### Current

Текущий рейтинг.

### Period

Изменение за период:

```text
This week
This month
All time
```

Исторические snapshot'ы желательно хранить хотя бы по завершённым турнирам и недельным срезам.

---

# 64. Рейтинг и часовые пояса

Так как первый клуб находится в Ташкенте, backend должен работать с timezone-aware датами.

Для отображения клуба использовать:

```text
Asia/Tashkent
```

Особенно это важно для:

- пятничных турниров;
- дедлайнов регистрации;
- challenge time;
- уведомлений.

---

# 65. Edge Cases

Обязательные случаи:

### Игрок не пришёл на турнир

Статус:

```text
NO_SHOW
```

Правило влияния на рейтинг должно быть явно настроено и не выведено из обычного матча.

### Match отменён

Рейтинг не меняется.

### Результат введён дважды

Второй запрос не должен повторно применить рейтинг.

### Один участник зарегистрировался несколько раз

Database constraint должен предотвращать duplicate registration.

### Игрок заблокирован

Новые challenge и tournament registration запрещены.

### Турнир уже начался

Нельзя редактировать bracket без специального admin action.

### Игрок удаляет аккаунт

Спортивная история не должна разрушаться. В БД предпочтительнее soft delete/anonymization.

---

# 66. Что НЕ нужно делать в MVP

Чтобы не раздувать первую версию, не включать:

- мобильные native-приложения iOS/Android;
- оплату;
- подписки;
- абонементы;
- бронирование столов;
- магазин инвентаря;
- сложные loyalty-программы;
- рекламу;
- AI-анализ техники;
- видеоанализ;
- doubles;
- сложные командные соревнования;
- double elimination;
- Swiss;
- сложную систему лиг;
- полноценную интеграцию с несколькими федерациями;
- сложную social network функциональность.

---

# 67. Что желательно не усложнять

### Mobile App

Не делать отдельное мобильное приложение на первом этапе.

User Web App + Telegram Bot достаточно.

### Telegram

Не делать Telegram отдельным backend.

### Ratings

Не делать несколько разных рейтинговых алгоритмов.

Один rating engine + configuration/versioning.

### Tournament Formats

Один формат — Single Elimination.

---

# 68. MVP Scope

### Must Have

- регистрация;
- login;
- профиль;
- игровая рука;
- RTTF rating field;
- admin verification;
- Club Rating;
- newcomer mode;
- rating engine;
- match history;
- challenges;
- Friday tournament;
- registration;
- bracket generation;
- results;
- leaderboard;
- admin panel;
- Telegram bot;
- notifications;
- audit log.

### Should Have

- rating graph;
- peak rating;
- top movers;
- public player profile;
- historical snapshots;
- player search/filter;
- export CSV.

### Later

- multiple clubs UI;
- payments;
- bookings;
- leagues;
- advanced statistics;
- doubles;
- mobile app;
- coach accounts;
- subscription model.

---

# 69. Suggested screens — User Web

```text
/
├── Dashboard
├── Leaderboard
├── Players
│   └── Player Profile
├── Matches
├── Challenges
│   ├── Active
│   └── History
├── Tournaments
│   ├── Upcoming
│   ├── Active
│   └── Finished
├── My Profile
└── Rating History
```

---

# 70. Suggested screens — Admin Web

```text
/admin
├── Dashboard
├── Players
├── Users
├── Matches
├── Challenges
├── Tournaments
│   ├── Upcoming
│   ├── Active
│   └── Finished
├── Ratings
├── Statistics
├── Notifications
├── Audit Logs
└── Settings
```

---

# 71. Dashboard metrics

### User

- Club Rating;
- Rank;
- rating change;
- W/L;
- upcoming challenge;
- upcoming tournament;
- recent matches.

### Admin

- total players;
- active players;
- matches this week;
- challenge count;
- tournament registration;
- pending verification;
- pending results.

---

# 72. Data consistency rules

### Player

Один User не должен иметь двух активных Player внутри одного клуба.

### External ratings

Нужно хранить источник и состояние verification.

### Matches

Один подтверждённый матч не должен создавать более одного набора rating transactions.

### Tournament registration

Один игрок — одна регистрация на турнир.

### Bracket

После lock нельзя тихо менять структуру сетки.

---

# 73. Soft Delete

Нужно использовать soft delete для важных сущностей или сохранять историю отдельно.

Нельзя физически удалять:

- confirmed matches;
- rating transactions;
- completed tournaments;
- audit logs.

---

# 74. Audit Log

Примеры событий:

```text
PLAYER_APPROVED
EXTERNAL_RATING_VERIFIED
MATCH_CONFIRMED
MATCH_CORRECTED
MATCH_CANCELLED
RATING_MANUALLY_ADJUSTED
TOURNAMENT_CREATED
BRACKET_GENERATED
BRACKET_LOCKED
TOURNAMENT_COMPLETED
PLAYER_BLOCKED
```

---

# 75. Ручная корректировка рейтинга

Администратор может изменить рейтинг в исключительных случаях.

Но нельзя делать:

```text
UPDATE players SET rating = 500
```

без истории.

Нужно создавать:

```text
MANUAL_ADJUSTMENT
```

с:

- old rating;
- delta;
- new rating;
- reason;
- admin;
- timestamp.

---

# 76. Версионирование рейтингового алгоритма

В БД должны сохраняться:

```text
rating_algorithm = RTTF_LIKE
rating_algorithm_version = 1
```

Это особенно важно, потому что в будущем алгоритм может поменяться.

Исторические матчи должны оставаться объяснимыми по версии формулы, по которой они были рассчитаны.

---

# 77. Формула как конфигурируемый модуль

Не зашивать значения прямо в frontend.

Например:

```json
{
  "algorithm": "RTTF_LIKE",
  "k": {
    "under_250": 0.20,
    "250_350": 0.25,
    "350_450": 0.30,
    "450_550": 0.35,
    "over_550": 0.40
  },
  "D": {
    "3_2": 0.8,
    "3_1": 1.0,
    "3_0": 1.2
  }
}
```

Фактический production format может быть другим, но концепция должна сохраняться.

---

# 78. Дополнительные RTTF-правила

В ранее обсуждённой модели RTTF существуют также дополнительные правила для новичков и специальные условия для бонусов за призовые места.

Для продукта необходимо сначала реализовать основной match-based rating engine и newcomer logic.

Если задача продукта — **полностью воспроизвести RTTF без отклонений**, дополнительные правила, включая podium bonuses и все условия их применимости, должны быть формально вынесены в отдельные requirements и покрыты тестами.

Это важно отделить от формулировки “RTTF-like”, потому что частичная реализация RTTF и полная репликация RTTF — разные требования.

---

# 79. Продуктовая стратегия

Продукт не должен позиционироваться как:

> “Новый официальный рейтинг Узбекистана”.

Правильное позиционирование:

> **Digital operating system for a table tennis club**

или:

> **Клубная платформа для матчей, рейтинга и турниров.**

Главное отличие — ежедневные клубные сценарии, а не только официальный рейтинг.

---

# 80. Конкурентный контекст

На мировом рынке уже существуют решения, которые закрывают отдельные части этой задачи, например:

- RankTT — рейтинги и история результатов;
- TTHub — турниры, live scores, рейтинги и профили;
- ServeLeague — управление клубом, лиги, ELO, memberships и события;
- SPINDEX — глобальные рейтинги и профили игроков;
- TTWRating — tournament software и rating calculation;
- KIBI Sports — регистрации, рейтинги, tournament draws и leaderboards.

Следовательно, сама категория продукта существует.

Но MVP нашего продукта отличается фокусом:

```text
One local club
      ↓
Daily matches
      ↓
Challenges
      ↓
Friday tournaments
      ↓
Club rating
      ↓
Telegram engagement
```

---

# 81. Основная ценность

Игрок должен возвращаться в приложение не потому, что “там есть профиль”, а потому что:

```text
Я сегодня играю матч
       ↓
мой результат появился в системе
       ↓
мой рейтинг изменился
       ↓
я вижу себя в leaderboard
       ↓
следующий игрок бросает мне challenge
       ↓
я снова иду играть
```

Таким образом, рейтинг становится механизмом регулярного engagement.

---

# 82. Основной пользовательский цикл

```text
Register
   ↓
Profile
   ↓
Play
   ↓
Result
   ↓
Rating update
   ↓
Leaderboard
   ↓
Challenge
   ↓
Play again
   ↓
Friday Tournament
   ↓
Rating update
   ↓
Repeat
```

---

# 83. Первоначальный onboarding

После регистрации:

```text
Welcome
↓
Basic profile
↓
Playing hand
↓
Do you have RTTF rating?
↓
↓
Telegram connect
↓
Pending admin approval
```

После одобрения:

```text
Welcome to Club
Your Club Rating: —
Register for Friday Tournament
```

---

# 84. Acceptance Criteria — Registration

- User can create account.
- User can set first/last name.
- User can set birth date.
- User can set gender.
- User can select playing hand.
- User can optionally enter RTTF rating.
- External rating is marked Pending until verified by admin.
- User without rating gets Club Rating = NULL.
- User without rating is `NEW`.

---

# 85. Acceptance Criteria — Rating

- Confirmed match changes rating exactly once.
- Rating delta is reproducible.
- Rating history is created automatically.
- Winner gets positive delta when applicable.
- Loser gets corresponding negative delta.
- Set score determines `D`.
- Tournament average determines `k`.
- 100-point rule is applied.
- Newcomer rules are applied while player is provisional.
- Manual corrections are audited.
- Duplicate events do not duplicate rating changes.

---

# 86. Acceptance Criteria — Challenges

- Player can create challenge.
- Opponent receives notification.
- Opponent can accept.
- Opponent can decline.
- Accepted challenge can become a scheduled match.
- Result can be submitted.
- Opponent/admin can confirm result according to configured flow.
- Confirmed result changes rating.

---

# 87. Acceptance Criteria — Tournament

- Admin can create Friday tournament.
- Players can register.
- Duplicate registration is impossible.
- Admin can close registration.
- Admin can generate bracket.
- Users can see bracket.
- Admin can enter results.
- Results advance players automatically.
- Finished matches affect ratings.
- Finished tournament is locked.
- Tournament history remains accessible.

---

# 88. Acceptance Criteria — Telegram

- User can connect Telegram account.
- User gets challenge notification.
- User gets tournament notification.
- User can view rating.
- User can view upcoming tournament.
- User can open relevant web page from Telegram.
- Telegram does not own or duplicate business state.

---

# 89. Non-functional requirements

## Performance

Основные страницы должны открываться быстро даже при росте числа матчей и игроков.

Leaderboard должен поддерживать пагинацию/кеширование при необходимости.

## Reliability

Rating operations должны быть транзакционными.

## Security

- password hashing;
- secure session/token handling;
- RBAC;
- input validation;
- rate limiting;
- CSRF/XSS protection where applicable;
- audit logging;
- Telegram identity verification.

## Observability

Минимум:

- application logs;
- error tracking;
- audit log;
- basic metrics;
- alerting on rating calculation failures.

---

# 90. Тестирование

Rating engine должен иметь unit tests для минимум следующих сценариев:

1. Lower rated player wins.
2. Higher rated player wins.
3. Difference < 100.
4. Difference = 100.
5. Difference > 100.
6. Score 3:0.
7. Score 3:1.
8. Score 3:2.
9. Newcomer win.
10. Newcomer loss.
11. Player transitions from NEW to PROVISIONAL.
12. Player transitions to ESTABLISHED.
13. Duplicate result submission.
14. Match correction.
15. Manual rating adjustment.
16. Tournament recalculation.

---

# 91. Seed data для разработки

Для локальной разработки создать:

### Club

```text
TT Club
```

### Players

Минимум 20 тестовых игроков.

Разные:

- рейтинги;
- пол;
- возраст;
- игровая рука;
- rating status.

Например:

```text
Alex — 520 — RIGHT — ESTABLISHED
Bek   — 495 — LEFT  — ESTABLISHED
Timur — 410 — RIGHT — PROVISIONAL
Aziz  — null — LEFT  — NEW
```

---

# 92. Рекомендуемая разработка по этапам

## Phase 1 — Foundation

- backend;
- database;
- auth;
- Club;
- User;
- Player;
- Admin role;
- profile;
- playing hand.

## Phase 2 — Ratings

- external ratings;
- verification;
- Club Rating;
- rating engine;
- history;
- leaderboard.

## Phase 3 — Matches & Challenges

- matches;
- challenge flow;
- result confirmation;
- rating update.

## Phase 4 — Tournaments

- tournament CRUD;
- registration;
- single elimination bracket;
- results;
- tournament rating.

## Phase 5 — Telegram

- account linking;
- notifications;
- rating;
- tournament actions;
- challenge actions.

## Phase 6 — Analytics & Polish

- rating graph;
- top movers;
- public player profile;
- snapshots;
- exports;
- improved UX.

---

# 93. Suggested architecture

На старте достаточно:

```text
                    ┌──────────────────┐
                    │   User Web App   │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │    Backend API   │
                    └───────┬─┬────────┘
                            │ │
             ┌──────────────┘ └───────────────┐
             │                                │
     ┌───────▼────────┐              ┌────────▼────────┐
     │   Rating       │              │ Telegram Bot    │
     │   Engine       │              │ Integration     │
     └───────┬────────┘              └─────────────────┘
             │
     ┌───────▼────────┐
     │   PostgreSQL   │
     └────────────────┘
             ▲
             │
     ┌───────┴────────┐
     │  Admin Web App │
     └────────────────┘
```

Не нужно начинать с microservices.

Modular monolith хорошо подходит для MVP.

---

# 94. Suggested backend modules

```text
AuthModule
UsersModule
PlayersModule
ClubsModule
MatchesModule
ChallengesModule
TournamentsModule
RatingsModule
NotificationsModule
TelegramModule
AdminModule
AuditModule
```

---

# 95. Database principle

Использовать PostgreSQL или аналогичную реляционную БД.

Причины:

- сильные constraints;
- transactions;
- relational data;
- удобные joins;
- auditability;
- надёжная работа с уникальностью.

---

# 96. Главное правило доменной модели

**Current rating — это projection, а не единственный источник истины.**

Источником истории должны быть:

```text
Matches
+
Rating Transactions
+
Manual Adjustments
```

`players.current_rating` можно хранить для быстрого доступа, но его можно восстановить/пересчитать из истории.

---

# 97. Пересчёт рейтинга

Администратор должен иметь специальную функцию:

```text
Recalculate Player Rating
```

и желательно:

```text
Recalculate Tournament
```

Использование должно быть ограничено ADMIN и обязательно попадать в Audit Log.

---

# 98. Системное событие после матча

Рекомендуемый event flow:

```text
MATCH_CONFIRMED
       ↓
RatingCalculated
       ↓
RatingTransactionCreated
       ↓
PlayerRatingUpdated
       ↓
LeaderboardUpdated
       ↓
NotificationCreated
       ↓
TelegramNotificationSent
```

Это позволит позже без серьёзной переделки добавить другие каналы уведомлений.

---

# 99. Бизнес-правила, которые должны быть configurable

Следующие параметры не стоит навсегда захардкодить:

- какие match types влияют на rating;
- tournament format;
- registration deadline;
- newcomer tournament count;
- k values;
- D values;
- 100-point threshold;
- rounding rule;
- manual adjustment permission;
- no-show rule;
- bracket seeding rule.

При этом default configuration MVP соответствует согласованной RTTF-like модели.

---

# 100. Вопрос открытого бизнеса: инициализация Club Rating

Нам необходимо явно зафиксировать одно правило перед production:

### Как именно переводить уже имеющийся RTTF рейтинг в начальный Club Rating?

Есть несколько технических моделей:

```text
A. Использовать подтверждённый RTTF рейтинг как Club Rating
B. Использовать его только как reference
C. Использовать его для определения стартового Club Rating по отдельному mapping
```

Для пользователя без внешнего рейтинга остаётся согласованный путь:

```text
NEW
 ↓
Friday Tournament
 ↓
Newcomer rules
 ↓
Provisional Club Rating
```

Это правило нужно определить до реализации регистрации существующих игроков, иначе будет неоднозначность в первом расчёте.

---

# 101. Будущая модель нескольких клубов

После появления второго клуба:

```text
User
 ├── Player in Club A
 └── Player in Club B
```

или, если бизнес-модель будет считать одного спортсмена глобальным профилем:

```text
User
   ↓
Global Person
   ├── Club Membership A
   └── Club Membership B
```

На MVP можно оставить упрощённую модель, но таблица Club Membership должна быть предусмотрена в архитектуре, если предполагается серьёзное масштабирование.

---

# 102. Будущее расширение в полноценную SaaS-платформу

Когда модель будет подтверждена одним клубом, продукт можно расширять в сторону:

```text
Multiple Clubs
    ↓
Club SaaS
    ↓
Tournaments
    ↓
Memberships
    ↓
Bookings
    ↓
Payments
    ↓
Leagues
    ↓
Advanced Analytics
```

Но MVP не должен включать весь этот слой.

---

# 103. North Star Metric

Для такого продукта более полезно измерять не просто количество зарегистрированных пользователей, а спортивную активность.

Рекомендуемый основной показатель:

> **Confirmed rated matches per active player per month**

Дополнительные:

- weekly active players;
- tournament participation rate;
- challenges created;
- challenge acceptance rate;
- percentage of players with at least one rated match;
- 4-week retention.

---

# 104. Product success definition

MVP можно считать успешно работающим, когда клуб может полностью провести неделю без ручной работы в сторонних системах:

```text
Player registration
        ↓
Challenge
        ↓
Rated match
        ↓
Rating update
        ↓
Friday tournament
        ↓
Registration
        ↓
Bracket
        ↓
Results
        ↓
Rating update
        ↓
Leaderboard
        ↓
Telegram notifications
```

Администратор должен вмешиваться только там, где требуется модерация или исправление.

---

# 105. Итоговая продуктовая формула

Вся первая версия продукта сводится к следующему циклу:

```text
                 ┌──────────────┐
                 │    PLAYER    │
                 └──────┬───────┘
                        │
             ┌──────────▼──────────┐
             │ Profile + Hand      │
             │        RTTF          │
             └──────────┬──────────┘
                        │
              ┌─────────▼─────────┐
              │   PLAY A MATCH    │
              └─────────┬─────────┘
                        │
               ┌────────▼────────┐
               │ Record Result    │
               └────────┬────────┘
                        │
             ┌──────────▼──────────┐
             │ RTTF-like Rating    │
             │ Engine              │
             └──────────┬──────────┘
                        │
            ┌───────────▼───────────┐
            │ Club Rating + History │
            └───────────┬───────────┘
                        │
                 ┌──────▼──────┐
                 │ Leaderboard │
                 └──────┬──────┘
                        │
              ┌─────────▼─────────┐
              │  CHALLENGE /      │
              │  FRIDAY TOURNEY   │
              └─────────┬─────────┘
                        │
                        └───────────────→ PLAY AGAIN
```

---

# 106. Финальная структура MVP

## User side

```text
Account
Profile
Playing Hand
External Ratings
Club Rating
Rating History
Matches
Challenges
Friday Tournament
Leaderboard
Player Profiles
Notifications
```

## Admin side

```text
Dashboard
Players
Users
Ratings
Matches
Challenges
Tournaments
Bracket
Statistics
Notifications
Audit
Settings
```

## Backend

```text
Auth
RBAC
Club
Player
Match
Challenge
Tournament
Bracket
Rating Engine
Rating Transactions
Notifications
Telegram
Audit
```

---

# 107. Важные решения, зафиксированные по итогам обсуждения

1. Продукт начинает с одного клуба.
2. Архитектура сразу готовится под несколько клубов.
3. Основной клубный рейтинг — собственный Club Rating.
4. RTTF хранится как отдельный внешний рейтинг.
5. Внешние рейтинги могут вводиться пользователем, но требуют admin verification.
6. Для нового игрока не используется универсальный фиксированный стартовый рейтинг.
7. До первого рейтингового результата у новичка `Club Rating = NULL`.
8. Новичок использует специальный provisional/newcomer flow по модели RTTF.
9. Игровая рука обязательна в профиле MVP: `RIGHT` / `LEFT`.
10. Игровая рука не участвует в формуле рейтинга.
11. Все подтверждённые матчи хранятся.
12. Все изменения рейтинга хранятся как отдельные transactions.
13. Исправление результата не должно уничтожать историю.
14. Пятничный турнир — ключевой сценарий продукта.
15. Первый турнирный формат — Single Elimination.
16. User Web + Admin Web + Telegram Bot — основная стартовая комбинация.
17. Telegram — интерфейс/notification layer, а backend остаётся source of truth.
18. MVP не должен включать платежи, мобильные приложения, сложные лиги и другие вторичные функции.
19. Rating Engine должен быть отдельным тестируемым модулем.
20. Все расчёты должны быть версионируемыми и воспроизводимыми.

---

# 108. Источники и примечания

### 
### RTTF

В проекте за основу Club Rating берётся обсуждённая RTTF-модель расчёта.

При production-реализации необходимо повторно сверить текущую официальную документацию RTTF и зафиксировать точную версию правил, особенно:

- правила новичков;
- границы коэффициента `k`;
- коэффициенты `D`;
- правило при разнице 100+ очков;
- стартовый рейтинг новичка;
- дополнительные podium bonuses;
- правила округления.

Причина этого примечания: если задача будет сформулирована как **“полностью 1:1 повторить RTTF”**, любые дополнительные правила должны быть частью acceptance criteria.

---

# 109. Следующий технический документ

После утверждения этого Product Specification следующим документом должен стать:

> **Technical Specification / Architecture Specification**

В нём нужно зафиксировать:

- точную схему PostgreSQL;
- таблицы и индексы;
- API contracts;
- auth/RBAC;
- rating engine pseudocode;
- tournament bracket algorithm;
- Telegram webhook flow;
- notification architecture;
- state machines;
- transaction boundaries;
- idempotency strategy;
- unit/integration test cases;
- deployment architecture.

