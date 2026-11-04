/**
 * Telegram bot (spec §34, §35, §88). Thin interface over the backend: reads go through the
 * service-role client, actions go through tg_act() which impersonates the linked user.
 * Same instance serves the webhook route and the local long-polling script.
 */
import { Bot, InlineKeyboard, type Context } from "grammy";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { startFlow, step, type DialogState, type Prompt } from "./dialogs";
import type { Database, Json } from "@/lib/supabase/database.types";

type DB = SupabaseClient<Database>;

export type BotDeps = {
  db: DB;                // service-role client
  appUrl: string;        // e.g. https://ttap.vercel.app
  supabaseUrl: string;
  anonKey: string;       // for password verification (signInWithPassword)
  clubSlug: string;
};

type PlayerCtx = {
  linked: boolean;
  user_id?: string;
  club?: { id: string; name: string; timezone: string };
  player?: {
    id: string; display_name: string; status: string; rating: number | null; rating_status: string;
    rank: number | null; wins: number; losses: number; tournament_count: number; peak: number | null;
  } | null;
};

const r = (v: number | null | undefined) => (v === null || v === undefined ? "—" : String(Math.floor(v + 0.5)));
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
const fmt = (iso: string, tz: string) =>
  new Date(iso).toLocaleString("ru-RU", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const STATUS_RU: Record<string, string> = { NEW: "новичок", PROVISIONAL: "предварительный", ESTABLISHED: "установившийся" };

export function createBot(token: string, deps: BotDeps) {
  const bot = new Bot(token);
  const { db, appUrl, supabaseUrl, anonKey, clubSlug } = deps;

  async function context(ctx: Context): Promise<PlayerCtx> {
    const id = ctx.from?.id;
    if (!id) return { linked: false };
    const { data, error } = await db.rpc("tg_context", { p_telegram_id: id });
    if (error) throw error;
    return data as unknown as PlayerCtx;
  }

  async function act(ctx: Context, action: string, args: Record<string, Json>) {
    const { data, error } = await db.rpc("tg_act", { p_telegram_id: ctx.from!.id, p_action: action, p_args: args });
    if (error) return { ok: false, error: error.message };
    return data as unknown as { ok: boolean; error?: string };
  }

  const menu = new InlineKeyboard()
    .text("📊 Рейтинг", "m:rating").text("👤 Профиль", "m:profile").row()
    .text("⚔️ Челленджи", "m:challenges").text("🏆 Турниры", "m:tournaments");

  /**
   * First contact: the user must authenticate. Two ways, both shown:
   *  1) a 6-digit code to enter on the website (Профиль → Telegram), valid 15 minutes;
   *  2) the deep link generated on the website (handled by /start <token>).
   */
  async function notLinked(ctx: Context) {
    const kb = new InlineKeyboard()
      .text("🔑 Войти", "auth:login").text("📝 Зарегистрироваться", "auth:register").row()
      .text("🔢 Код для сайта", "link:code");
    const text = [
      `👋 Привет${ctx.from?.first_name ? ", " + esc(ctx.from.first_name) : ""}! Это бот клуба.`,
      ``,
      `Уже есть аккаунт на сайте — нажмите <b>Войти</b>. Нет — <b>Зарегистрироваться</b>, займёт минуту.`,
      `Либо получите код и введите его на сайте: Профиль → Telegram.`,
    ].join("\n");
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb, link_preview_options: { is_disabled: true } });
  }

  async function showCode(ctx: Context) {
    const { data: code, error } = await db.rpc("tg_issue_code", {
      p_telegram_id: ctx.from!.id,
      p_chat_id: ctx.chat?.id ?? ctx.from!.id,
      p_username: ctx.from?.username ?? undefined,
      p_first_name: ctx.from?.first_name ?? undefined,
    });
    if (error) return ctx.reply("Не удалось выдать код, попробуйте позже.");
    await ctx.reply(
      `Ваш код: <code>${code}</code>\n\nСайт → <b>Профиль</b> → <b>Telegram</b> → «Привязать». Действует 15 минут.`,
      { parse_mode: "HTML", reply_markup: new InlineKeyboard().url("Открыть сайт", `${appUrl}/profile`).row().text("🔄 Новый код", "link:code"), link_preview_options: { is_disabled: true } },
    );
  }

  // ---------- dialogs: /login and /register (state in telegram_dialogs) ----------
  async function loadDialog(id: number): Promise<DialogState | null> {
    const { data } = await db.from("telegram_dialogs").select("flow, step, data").eq("telegram_id", id).maybeSingle();
    return data ? ({ flow: data.flow as DialogState["flow"], step: data.step, data: (data.data ?? {}) as Record<string, string> }) : null;
  }
  async function saveDialog(id: number, st: DialogState) {
    await db.from("telegram_dialogs").upsert({ telegram_id: id, flow: st.flow, step: st.step, data: st.data, updated_at: new Date().toISOString() });
  }
  async function clearDialog(id: number) {
    await db.from("telegram_dialogs").delete().eq("telegram_id", id);
  }
  function kbFrom(p: Prompt) {
    if (!p.buttons?.length) return undefined;
    const kb = new InlineKeyboard();
    for (const [label, data] of p.buttons) kb.text(label, data).row();
    return kb;
  }

  async function beginFlow(ctx: Context, flow: DialogState["flow"]) {
    const c = await context(ctx);
    if (c.linked) return ctx.reply(`Вы уже вошли как ${esc(c.player?.display_name ?? "")} ✅`, { parse_mode: "HTML", reply_markup: menu });
    const r = startFlow(flow);
    if (r.kind !== "prompt") return;
    await saveDialog(ctx.from!.id, r.state);
    await ctx.reply(r.prompt.text, { reply_markup: kbFrom(r.prompt) });
  }

  async function finishLogin(ctx: Context, data: Record<string, string>) {
    const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: signIn, error } = await auth.auth.signInWithPassword({ email: data.email, password: data.password });
    if (error || !signIn.user) {
      await ctx.reply("Неверный email или пароль. Попробовать снова — /login", { reply_markup: new InlineKeyboard().text("🔑 Войти", "auth:login").text("📝 Регистрация", "auth:register") });
      return;
    }
    await auth.auth.signOut().catch(() => {});
    const { data: res, error: linkErr } = await db.rpc("tg_link_user", {
      p_user_id: signIn.user.id, p_telegram_id: ctx.from!.id, p_chat_id: ctx.chat?.id ?? ctx.from!.id,
      p_username: ctx.from?.username ?? undefined, p_tg_first_name: ctx.from?.first_name ?? undefined,
    });
    const rr = res as unknown as { ok: boolean; display_name?: string; status?: string } | null;
    if (linkErr || !rr?.ok) return ctx.reply("Не удалось привязать аккаунт. Напишите администратору.");
    if (!rr.display_name) {
      return ctx.reply("✅ Вход выполнен. Игрового профиля пока нет — заполните его на сайте.", { reply_markup: new InlineKeyboard().url("Открыть сайт", `${appUrl}/onboarding`) });
    }
    if (rr.status === "PENDING") return ctx.reply(`✅ Вход выполнен, ${esc(rr.display_name)}. Профиль ждёт одобрения администратора — как только одобрят, придёт сообщение.`, { parse_mode: "HTML" });
    await ctx.reply(`✅ Вход выполнен, ${esc(rr.display_name)}! Теперь сюда будут приходить вызовы и новости турниров.`, { parse_mode: "HTML", reply_markup: menu });
  }

  async function finishRegister(ctx: Context, data: Record<string, string>) {
    const { data: created, error } = await db.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: true });
    if (error || !created.user) {
      const exists = /already|registered|exists/i.test(error?.message ?? "");
      await ctx.reply(exists ? "Такой email уже зарегистрирован. Нажмите «Войти»." : `Не удалось создать аккаунт: ${error?.message ?? "ошибка"}`,
        { reply_markup: new InlineKeyboard().text("🔑 Войти", "auth:login") });
      return;
    }
    const { data: res, error: regErr } = await db.rpc("tg_register", {
      p_user_id: created.user.id, p_club_slug: clubSlug,
      p_first_name: data.first_name, p_last_name: data.last_name, p_display_name: data.display_name, p_birth_date: data.birth_date,
      p_gender: data.gender as "MALE" | "FEMALE", p_playing_hand: data.playing_hand as "RIGHT" | "LEFT",
      p_rttf_rating: data.rttf_rating ? Number(data.rttf_rating) : undefined,
      p_telegram_id: ctx.from!.id, p_chat_id: ctx.chat?.id ?? ctx.from!.id,
      p_username: ctx.from?.username ?? undefined, p_tg_first_name: ctx.from?.first_name ?? undefined,
    });
    const rr = res as unknown as { ok: boolean; error?: string } | null;
    if (regErr || !rr?.ok) return ctx.reply(`Аккаунт создан, но профиль не сохранился: ${regErr?.message ?? rr?.error}. Напишите администратору.`);
    await ctx.reply(
      [`🎉 Готово, ${esc(data.display_name)}! Заявка отправлена.`, ``,
       `Администратор клуба одобрит профиль — вам придёт сообщение сюда. После этого откроются рейтинг, вызовы и турниры.`,
       ``, `Вход на сайт: ${data.email} + ваш пароль.`].join("\n"),
      { parse_mode: "HTML", reply_markup: new InlineKeyboard().url("Открыть сайт", `${appUrl}/login`), link_preview_options: { is_disabled: true } },
    );
  }

  /** Returns true if the input was consumed by an active dialog. */
  async function handleDialog(ctx: Context, input: string, isCallback: boolean): Promise<boolean> {
    const id = ctx.from!.id;
    const st = await loadDialog(id);
    if (!st) return false;
    const r = step(st, input);
    const del = (r.kind === "prompt" && r.prompt.deleteInput) || (r.kind === "done" && r.deleteInput);
    if (del && !isCallback && ctx.message) await ctx.api.deleteMessage(ctx.chat!.id, ctx.message.message_id).catch(() => {});
    if (r.kind === "cancelled") { await clearDialog(id); await ctx.reply(r.prompt.text, { reply_markup: new InlineKeyboard().text("🔑 Войти", "auth:login").text("📝 Регистрация", "auth:register") }); return true; }
    if (r.kind === "prompt") { await saveDialog(id, r.state); await ctx.reply(r.prompt.text, { reply_markup: kbFrom(r.prompt) }); return true; }
    await clearDialog(id);
    if (r.flow === "login") await finishLogin(ctx, r.data); else await finishRegister(ctx, r.data);
    return true;
  }

  bot.command("login", (ctx) => beginFlow(ctx, "login"));
  bot.command("register", (ctx) => beginFlow(ctx, "register"));
  bot.command("cancel", async (ctx) => { await clearDialog(ctx.from!.id); await ctx.reply("Отменено."); });
  bot.callbackQuery("auth:login", async (ctx) => { await ctx.answerCallbackQuery(); await beginFlow(ctx, "login"); });
  bot.callbackQuery("auth:register", async (ctx) => { await ctx.answerCallbackQuery(); await beginFlow(ctx, "register"); });
  bot.callbackQuery(/^dlg:/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
    if (!(await handleDialog(ctx, ctx.callbackQuery.data, true))) await notLinked(ctx);
  });

  bot.callbackQuery("link:code", async (ctx) => {
    await ctx.answerCallbackQuery();
    const c = await context(ctx);
    if (c.linked) return ctx.reply("Аккаунт уже привязан ✅", { reply_markup: menu });
    await showCode(ctx);
  });

  // ---------- /start [token] ----------
  bot.command("start", async (ctx) => {
    const token = ctx.match?.trim();
    if (token) {
      const { data, error } = await db.rpc("tg_link", {
        p_token: token,
        p_telegram_id: ctx.from!.id,
        p_chat_id: ctx.chat.id,
        p_username: ctx.from?.username ?? undefined,
        p_first_name: ctx.from?.first_name ?? undefined,
      });
      const res = data as unknown as { ok: boolean; error?: string; display_name?: string } | null;
      if (error || !res?.ok) {
        return ctx.reply("Ссылка недействительна или устарела. Сгенерируйте новую в профиле на сайте.");
      }
      return ctx.reply(`✅ Готово, ${esc(res.display_name ?? "")}! Telegram привязан.\n\nТеперь сюда будут приходить вызовы, результаты и новости турниров.`, { reply_markup: menu, parse_mode: "HTML" });
    }
    await clearDialog(ctx.from!.id);
    const c = await context(ctx);
    if (!c.linked) return notLinked(ctx);
    return ctx.reply(`Привет, ${esc(c.player?.display_name ?? "")}! Что посмотрим?`, { reply_markup: menu, parse_mode: "HTML" });
  });

  bot.command("help", (ctx) =>
    ctx.reply(["/login — войти в аккаунт", "/register — регистрация в клубе", "/rating — мой рейтинг и топ клуба", "/profile — профиль и статистика", "/challenges — вызовы", "/tournaments — ближайшие турниры", "/start — меню"].join("\n")),
  );

  // ---------- rating ----------
  async function showRating(ctx: Context) {
    const c = await context(ctx);
    if (!c.linked) return notLinked(ctx);
    const p = c.player;
    const { data: top } = await db.from("leaderboard").select("rank, display_name, current_rating").eq("club_id", c.club!.id).order("rank").limit(10);
    const lines = (top ?? []).map((x) => `${x.rank}. ${esc(x.display_name ?? "")} — <b>${r(x.current_rating)}</b>`);
    const mine = p
      ? `Ваш Club Rating: <b>${r(p.rating)}</b>${p.rank ? ` · #${p.rank} в клубе` : ""} · ${STATUS_RU[p.rating_status] ?? p.rating_status}`
      : "У вас нет игрового профиля.";
    await ctx.reply(`${mine}\n\n<b>Топ-10 ${esc(c.club!.name)}</b>\n${lines.join("\n") || "—"}\n\n${appUrl}/leaderboard`, {
      parse_mode: "HTML", link_preview_options: { is_disabled: true },
    });
  }
  bot.command("rating", showRating);
  bot.callbackQuery("m:rating", async (ctx) => { await ctx.answerCallbackQuery(); await showRating(ctx); });

  // ---------- profile ----------
  async function showProfile(ctx: Context) {
    const c = await context(ctx);
    if (!c.linked) return notLinked(ctx);
    const p = c.player;
    if (!p) return ctx.reply("У вас нет игрового профиля.");
    await ctx.reply(
      [
        `<b>${esc(p.display_name)}</b>`,
        `Рейтинг: <b>${r(p.rating)}</b> (${STATUS_RU[p.rating_status] ?? p.rating_status})${p.rank ? ` · #${p.rank}` : ""}`,
        `Пик: ${r(p.peak)} · Турниров: ${p.tournament_count}`,
        `Победы / поражения: ${p.wins} / ${p.losses}`,
        ``,
        `${appUrl}/players/${p.id}`,
      ].join("\n"),
      { parse_mode: "HTML", link_preview_options: { is_disabled: true } },
    );
  }
  bot.command("profile", showProfile);
  bot.callbackQuery("m:profile", async (ctx) => { await ctx.answerCallbackQuery(); await showProfile(ctx); });

  // ---------- challenges ----------
  async function showChallenges(ctx: Context) {
    const c = await context(ctx);
    if (!c.linked) return notLinked(ctx);
    const p = c.player;
    if (!p) return ctx.reply("У вас нет игрового профиля.");
    const { data } = await db
      .from("challenges")
      .select("id, status, proposed_at, message, challenger_id, opponent_id, submitted_by, challenger:players!challenges_challenger_id_fkey(display_name), opponent:players!challenges_opponent_id_fkey(display_name)")
      .or(`challenger_id.eq.${p.id},opponent_id.eq.${p.id}`)
      .in("status", ["PENDING", "ACCEPTED", "RESULT_SUBMITTED"])
      .order("proposed_at")
      .limit(10);
    const list = data ?? [];
    if (list.length === 0) {
      return ctx.reply(`Открытых вызовов нет.\n\nБросить вызов: ${appUrl}/challenges/new`, { link_preview_options: { is_disabled: true } });
    }
    for (const ch of list) {
      const other = ch.challenger_id === p.id ? ch.opponent.display_name : ch.challenger.display_name;
      const when = fmt(ch.proposed_at, c.club!.timezone);
      const kb = new InlineKeyboard();
      let text: string;
      if (ch.status === "PENDING" && ch.opponent_id === p.id) {
        text = `⚔️ <b>${esc(ch.challenger.display_name)}</b> вызывает вас\n${when}${ch.message ? `\n«${esc(ch.message)}»` : ""}`;
        kb.text("✅ Принять", `ch:acc:${ch.id}`).text("❌ Отклонить", `ch:dec:${ch.id}`);
      } else if (ch.status === "PENDING") {
        text = `⏳ Ждём ответа от <b>${esc(other)}</b>\n${when}`;
        kb.text("Отозвать", `ch:can:${ch.id}`);
      } else if (ch.status === "RESULT_SUBMITTED" && ch.submitted_by !== p.id) {
        text = `📝 <b>${esc(other)}</b> внёс результат — подтвердите на сайте`;
        kb.url("Открыть", `${appUrl}/challenges/${ch.id}`);
      } else if (ch.status === "RESULT_SUBMITTED") {
        text = `📝 Результат vs <b>${esc(other)}</b> ждёт подтверждения соперника`;
        kb.url("Открыть", `${appUrl}/challenges/${ch.id}`);
      } else {
        text = `🏓 Матч vs <b>${esc(other)}</b>\n${when}`;
        kb.url("Внести результат", `${appUrl}/challenges/${ch.id}`);
      }
      await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb, link_preview_options: { is_disabled: true } });
    }
  }
  bot.command("challenges", showChallenges);
  bot.callbackQuery("m:challenges", async (ctx) => { await ctx.answerCallbackQuery(); await showChallenges(ctx); });

  bot.callbackQuery(/^ch:(acc|dec|can):(.+)$/, async (ctx) => {
    const [, op, id] = ctx.match;
    const res = op === "can"
      ? await act(ctx, "cancel_challenge", { challenge_id: id })
      : await act(ctx, "respond_challenge", { challenge_id: id, accept: op === "acc" });
    if (!res.ok) {
      await ctx.answerCallbackQuery({ text: res.error === "not_linked" ? "Аккаунт не привязан" : `Не удалось: ${res.error}`, show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery({ text: op === "acc" ? "Вызов принят" : op === "dec" ? "Вызов отклонён" : "Вызов отозван" });
    const label = op === "acc" ? "✅ Принято" : op === "dec" ? "❌ Отклонено" : "↩️ Отозвано";
    await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard().url(`${label} · открыть`, `${appUrl}/challenges/${id}`) }).catch(() => {});
  });

  // ---------- tournaments ----------
  async function showTournaments(ctx: Context) {
    const c = await context(ctx);
    if (!c.linked) return notLinked(ctx);
    const p = c.player;
    const { data } = await db
      .from("tournaments")
      .select("id, name, starts_at, status, registration_deadline")
      .eq("club_id", c.club!.id)
      .in("status", ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "IN_PROGRESS"])
      .is("deleted_at", null)
      .order("starts_at")
      .limit(5);
    const list = data ?? [];
    if (list.length === 0) return ctx.reply(`Ближайших турниров нет.\n${appUrl}/tournaments`, { link_preview_options: { is_disabled: true } });
    const { data: regs } = p
      ? await db.from("tournament_participants").select("tournament_id").eq("player_id", p.id).eq("status", "REGISTERED").in("tournament_id", list.map((t) => t.id))
      : { data: [] };
    const mine = new Set((regs ?? []).map((x) => x.tournament_id));
    for (const t of list) {
      const kb = new InlineKeyboard();
      const status = t.status === "IN_PROGRESS" ? "🔥 идёт сейчас" : t.status === "REGISTRATION_OPEN" ? "🟢 регистрация открыта" : "🟡 регистрация закрыта";
      const reg = mine.has(t.id) ? "\n✅ Вы зарегистрированы" : "";
      if (p && t.status === "REGISTRATION_OPEN") {
        if (mine.has(t.id)) kb.text("Отменить регистрацию", `tr:wd:${t.id}`);
        else kb.text("📝 Зарегистрироваться", `tr:reg:${t.id}`);
      }
      kb.url(t.status === "IN_PROGRESS" ? "Сетка" : "Открыть", `${appUrl}/tournaments/${t.id}`);
      await ctx.reply(`🏆 <b>${esc(t.name)}</b>\n${fmt(t.starts_at, c.club!.timezone)}\n${status}${reg}`, {
        parse_mode: "HTML", reply_markup: kb, link_preview_options: { is_disabled: true },
      });
    }
  }
  bot.command("tournaments", showTournaments);
  bot.callbackQuery("m:tournaments", async (ctx) => { await ctx.answerCallbackQuery(); await showTournaments(ctx); });

  bot.callbackQuery(/^tr:(reg|wd):(.+)$/, async (ctx) => {
    const [, op, id] = ctx.match;
    const res = await act(ctx, op === "reg" ? "register_for_tournament" : "withdraw_from_tournament", { tournament_id: id });
    if (!res.ok) {
      const already = res.error?.includes("already registered");
      await ctx.answerCallbackQuery({ text: already ? "Вы уже зарегистрированы" : `Не удалось: ${res.error}`, show_alert: !already });
      return;
    }
    await ctx.answerCallbackQuery({ text: op === "reg" ? "Вы зарегистрированы!" : "Регистрация отменена" });
    const kb = new InlineKeyboard();
    if (op === "reg") kb.text("Отменить регистрацию", `tr:wd:${id}`); else kb.text("📝 Зарегистрироваться", `tr:reg:${id}`);
    kb.url("Открыть", `${appUrl}/tournaments/${id}`);
    await ctx.editMessageReplyMarkup({ reply_markup: kb }).catch(() => {});
  });

  bot.on("message:text", async (ctx) => {
    if (await handleDialog(ctx, ctx.message.text, false)) return;
    const c = await context(ctx);
    if (!c.linked) return notLinked(ctx);
    return ctx.reply("Не понял. Команды: /rating /profile /challenges /tournaments", { reply_markup: menu });
  });

  // any callback from an unlinked user (e.g. old buttons) → onboarding
  bot.on("callback_query:data", async (ctx) => {
    await ctx.answerCallbackQuery();
    const c = await context(ctx);
    if (!c.linked) return notLinked(ctx);
  });

  bot.catch((err) => {
    console.error("[telegram] handler error", err.error);
  });

  return bot;
}
