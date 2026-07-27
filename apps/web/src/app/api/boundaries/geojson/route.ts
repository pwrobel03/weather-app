import { type NextRequest } from "next/server";

/**
 * Same-origin proxy for the powiat boundary collection.
 *
 * Exists so the browser fetches the geometry itself instead of receiving it
 * inlined in the page. That distinction is worth 2.4MB: rendering it into the
 * server payload made every visit to /map ship the whole country again, and
 * silently discarded the HTTP caching the backend does (commit 81) - a cache
 * the browser cannot use for bytes it never requested.
 *
 * Conditional headers are forwarded in both directions, so a revalidation
 * stays a revalidation: the browser sends If-None-Match, the backend answers
 * 304, and nothing crosses the wire twice.
 *
 * Same BFF reasoning as the other route handlers: the backend has no CORS
 * configuration, and opening it up is a decision nobody has needed to make.
 */
export async function GET(request: NextRequest) {
  const base = process.env.API_BASE_URL ?? "http://localhost:8080";
  const ifNoneMatch = request.headers.get("if-none-match");

  const upstream = await fetch(`${base}/api/boundaries/geojson`, {
    headers: ifNoneMatch ? { "If-None-Match": ifNoneMatch } : undefined,
    // Never cached by Next itself. The response is larger than the fetch cache
    // is meant to hold, and the browser is the right place to keep it - which
    // is the entire point of this route.
    cache: "no-store",
  });

  if (upstream.status === 304) {
    return new Response(null, {
      status: 304,
      headers: passthrough(upstream),
    });
  }

  if (!upstream.ok) {
    // An empty collection renders as an empty map, which is a visible failure.
    // A 502 here would take the whole page down with it.
    return Response.json({ type: "FeatureCollection", features: [] }, { status: 200 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: { "Content-Type": "application/json", ...passthrough(upstream) },
  });
}

function passthrough(upstream: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const header of ["etag", "cache-control"]) {
    const value = upstream.headers.get(header);
    if (value) headers[header] = value;
  }
  return headers;
}
