import { describe, it, expect } from "vitest";
import { startFlow, step, parseBirthDate, type DialogState } from "./dialogs";

function run(flow: "register" | "login", inputs: string[]) {
  let r = startFlow(flow);
  const prompts: string[] = [];
  for (const i of inputs) {
    if (r.kind !== "prompt") break;
    r = step(r.state, i);
    if (r.kind === "prompt") prompts.push(r.prompt.text);
  }
  return { r, prompts };
}

describe("parseBirthDate", () => {
  it("accepts DD.MM.YYYY and ISO", () => {
    expect(parseBirthDate("15.03.1995")).toBe("1995-03-15");
    expect(parseBirthDate("1/2/2000")).toBe("2000-02-01");
    expect(parseBirthDate("2001-12-31")).toBe("2001-12-31");
  });
  it("rejects invalid", () => {
    expect(parseBirthDate("31.02.1995")).toBeNull();
    expect(parseBirthDate("hello")).toBeNull();
    expect(parseBirthDate("15.03.2999")).toBeNull();
  });
});

describe("login flow", () => {
  it("email → password → done, password message deleted", () => {
    const { r } = run("login", ["Bad", "user@example.com", "secret123"]);
    expect(r.kind).toBe("done");
    if (r.kind === "done") {
      expect(r.data).toEqual({ email: "user@example.com", password: "secret123" });
      expect(r.deleteInput).toBe(true);
    }
  });
  it("cancel", () => {
    const { r } = run("login", ["/cancel"]);
    expect(r.kind).toBe("cancelled");
  });
});

describe("register flow", () => {
  const happy = ["a@b.co", "password1", "Иван", "Петров", "Ваня", "15.03.1995", "dlg:gender:MALE", "dlg:hand:LEFT", "450", "dlg:confirm:yes"];
  it("happy path collects all fields", () => {
    const { r } = run("register", happy);
    expect(r.kind).toBe("done");
    if (r.kind === "done") {
      expect(r.data).toEqual({
        email: "a@b.co", password: "password1", first_name: "Иван", last_name: "Петров", display_name: "Ваня",
        birth_date: "1995-03-15", gender: "MALE", playing_hand: "LEFT", rttf_rating: "450",
      });
    }
  });
  it("re-prompts on invalid input and stays on the same step", () => {
    const { r, prompts } = run("register", ["a@b.co", "short"]);
    expect(r.kind).toBe("prompt");
    if (r.kind === "prompt") {
      expect(r.state.step).toBe("password");
      expect(r.prompt.deleteInput).toBe(true);
    }
    expect(prompts.at(-1)).toMatch(/короткий/);
  });
  it("skip RTTF via button, and restart on 'заново'", () => {
    const { r } = run("register", [...happy.slice(0, 8), "dlg:rttf:none", "dlg:confirm:no"]);
    expect(r.kind).toBe("prompt");
    if (r.kind === "prompt") expect(r.state.step).toBe("email");
  });
  it("gender requires button", () => {
    const s: DialogState = { flow: "register", step: "gender", data: {} };
    const r = step(s, "мужской");
    expect(r.kind).toBe("prompt");
    if (r.kind === "prompt") expect(r.prompt.buttons?.length).toBe(2);
  });
});
