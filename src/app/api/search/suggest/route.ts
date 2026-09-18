import { NextResponse } from "next/server";
import { getSearchEngine, normaliseQuery } from "@/server/search/engine";
import { rateLimit, RATE_LIMITS } from "@/server/rate-limit";
import { requestIp } from "@/server/auth/session";

/** Typeahead endpoint. Rate limited per IP; results are public catalog data. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = normaliseQuery(url.searchParams.get("q") ?? "");

  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const limit = await rateLimit(`search:${await requestIp()}`, RATE_LIMITS.search);
  if (!limit.success) {
    return NextResponse.json(
      { suggestions: [], error: "Too many searches" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  const suggestions = await getSearchEngine().suggest(query, 8);
  return NextResponse.json(
    { suggestions },
    { headers: { "Cache-Control": "private, max-age=20" } },
  );
}
