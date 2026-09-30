import { dispatchNotifications } from "@/lib/telegram/dispatch";

export const dynamic = "force-dynamic";

/** Cron endpoint: POST with Authorization: Bearer $CRON_SECRET (pg_cron/pg_net or Vercel Cron). */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("forbidden", { status: 403 });
  }
  const r = await dispatchNotifications(200);
  return Response.json(r);
}

export const GET = POST;
