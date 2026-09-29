import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Email confirmation / magic-link landing. Set Site URL + Redirect URLs in Supabase Auth to <origin>/auth/callback. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/"}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
