import "server-only";
import { after } from "next/server";
import { dispatchNotifications } from "./dispatch";

/** Deliver freshly queued notifications right after the current response is sent. */
export function queueDispatch() {
  try {
    after(() => dispatchNotifications().catch((e) => console.error("[telegram] dispatch", e)));
  } catch {
    // outside a request scope (tests) — cron will pick it up
  }
}
