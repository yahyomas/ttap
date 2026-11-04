/**
 * Bot conversation flows: /register and /login. Pure state machine — no I/O — so it can be unit-tested
 * and driven from either the webhook or the polling script. Persisted in telegram_dialogs.
 */

export type Flow = "register" | "login";

export type DialogState = { flow: Flow; step: string; data: Record<string, string> };

export type Prompt = {
  text: string;
  /** inline buttons: [label, callback data] rows */
  buttons?: string[][];
  /** the user's message contained a secret and should be deleted */
  deleteInput?: boolean;
};

export type StepResult =
  | { kind: "prompt"; state: DialogState; prompt: Prompt }
  | { kind: "done"; flow: Flow; data: Record<string, string>; deleteInput?: boolean }
  | { kind: "cancelled"; prompt: Prompt };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const GENDER_BUTTONS = [["Мужской", "dlg:gender:MALE"], ["Женский", "dlg:gender:FEMALE"]];
export const HAND_BUTTONS = [["Правая", "dlg:hand:RIGHT"], ["Левая", "dlg:hand:LEFT"]];
export const RTTF_SKIP = [["Нет рейтинга", "dlg:rttf:none"]];
export const CONFIRM_BUTTONS = [["✅ Всё верно, создать", "dlg:confirm:yes"], ["✏️ Заново", "dlg:confirm:no"]];

export function startFlow(flow: Flow): StepResult {
  if (flow === "login") {
    return {
      kind: "prompt",
      state: { flow, step: "email", data: {} },
      prompt: { text: "Вход в аккаунт. Введите email, с которым вы регистрировались:\n\n(отмена — /cancel)" },
    };
  }
  return {
    kind: "prompt",
    state: { flow, step: "email", data: {} },
    prompt: { text: "Регистрация в клубе. Шаг 1 из 8 — ваш email:\n\n(отмена — /cancel)" },
  };
}

function prompt(state: DialogState, text: string, buttons?: string[][], deleteInput?: boolean): StepResult {
  return { kind: "prompt", state, prompt: { text, buttons, deleteInput } };
}

/** Parse "DD.MM.YYYY" or "YYYY-MM-DD" → ISO date, or null. */
export function parseBirthDate(input: string): string | null {
  const s = input.trim();
  let y: number, m: number, d: number;
  let mm = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (mm) [d, m, y] = [+mm[1], +mm[2], +mm[3]];
  else if ((mm = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) [y, m, d] = [+mm[1], +mm[2], +mm[3]];
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  const now = new Date();
  if (y < now.getUTCFullYear() - 100 || dt > now) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function summary(d: Record<string, string>): string {
  return [
    `Email: ${d.email}`,
    `Имя: ${d.first_name} ${d.last_name}`,
    `В таблице: ${d.display_name}`,
    `Дата рождения: ${d.birth_date}`,
    `Пол: ${d.gender === "MALE" ? "мужской" : "женский"}`,
    `Рука: ${d.playing_hand === "LEFT" ? "левая" : "правая"}`,
    `RTTF: ${d.rttf_rating ? d.rttf_rating : "нет"}`,
  ].join("\n");
}

/**
 * Advance the dialog with user input. `input` is message text or callback data ("dlg:gender:MALE").
 */
export function step(state: DialogState, input: string): StepResult {
  const text = input.trim();
  if (text === "/cancel") return { kind: "cancelled", prompt: { text: "Отменено." } };
  const d = { ...state.data };
  const s = (stepName: string) => ({ ...state, step: stepName, data: d });

  if (state.flow === "login") {
    switch (state.step) {
      case "email":
        if (!EMAIL_RE.test(text)) return prompt(state, "Это не похоже на email. Попробуйте ещё раз:");
        d.email = text.toLowerCase();
        return prompt(s("password"), "Пароль:\n\n(сообщение с паролем будет удалено)");
      case "password":
        d.password = text;
        return { kind: "done", flow: "login", data: d, deleteInput: true };
    }
  }

  switch (state.step) {
    case "email":
      if (!EMAIL_RE.test(text)) return prompt(state, "Это не похоже на email. Введите email:");
      d.email = text.toLowerCase();
      return prompt(s("password"), "Шаг 2 из 8 — придумайте пароль (минимум 8 символов):\n\n(сообщение с паролем будет удалено)");
    case "password":
      if (text.length < 8) return prompt(state, "Пароль слишком короткий — минимум 8 символов. Ещё раз:", undefined, true);
      d.password = text;
      return prompt(s("first_name"), "Шаг 3 из 8 — ваше имя:", undefined, true);
    case "first_name":
      if (text.length < 1 || text.length > 50) return prompt(state, "Введите имя:");
      d.first_name = text;
      return prompt(s("last_name"), "Шаг 4 из 8 — фамилия:");
    case "last_name":
      if (text.length < 1 || text.length > 50) return prompt(state, "Введите фамилию:");
      d.last_name = text;
      return prompt(s("display_name"), `Шаг 5 из 8 — как показывать вас в рейтинге? (например, «${d.first_name}»):`);
    case "display_name":
      if (text.length < 2 || text.length > 30) return prompt(state, "От 2 до 30 символов. Ещё раз:");
      d.display_name = text;
      return prompt(s("birth_date"), "Шаг 6 из 8 — дата рождения (ДД.ММ.ГГГГ):");
    case "birth_date": {
      const iso = parseBirthDate(text);
      if (!iso) return prompt(state, "Не понял дату. Формат ДД.ММ.ГГГГ, например 15.03.1995:");
      d.birth_date = iso;
      return prompt(s("gender"), "Шаг 7 из 8 — пол:", GENDER_BUTTONS);
    }
    case "gender": {
      const m = text.match(/^dlg:gender:(MALE|FEMALE)$/);
      if (!m) return prompt(state, "Выберите кнопкой:", GENDER_BUTTONS);
      d.gender = m[1];
      return prompt(s("hand"), "Шаг 8 из 8 — игровая рука:", HAND_BUTTONS);
    }
    case "hand": {
      const m = text.match(/^dlg:hand:(RIGHT|LEFT)$/);
      if (!m) return prompt(state, "Выберите кнопкой:", HAND_BUTTONS);
      d.playing_hand = m[1];
      return prompt(s("rttf"), "Есть рейтинг RTTF? Введите число или нажмите кнопку:", RTTF_SKIP);
    }
    case "rttf": {
      if (text === "dlg:rttf:none" || /^(нет|no|-)$/i.test(text)) {
        delete d.rttf_rating;
      } else {
        const n = Number(text);
        if (!Number.isInteger(n) || n < 1 || n > 3000) return prompt(state, "Введите число от 1 до 3000 или нажмите кнопку:", RTTF_SKIP);
        d.rttf_rating = String(n);
      }
      return prompt(s("confirm"), `Проверьте данные:\n\n${summary(d)}`, CONFIRM_BUTTONS);
    }
    case "confirm":
      if (text === "dlg:confirm:yes") return { kind: "done", flow: "register", data: d };
      if (text === "dlg:confirm:no") return startFlow("register");
      return prompt(state, "Нажмите кнопку:", CONFIRM_BUTTONS);
  }
  return startFlow(state.flow);
}
