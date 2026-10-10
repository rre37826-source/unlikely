import { env } from "cloudflare:workers";
import { handleTrialRequest } from "../../../trial/index.mjs";

export async function serveTrialRequest(request: Request): Promise<Response> {
  try {
    const bindings = { env, db: env.DB };
    const response = await handleTrialRequest(request, bindings);
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return Response.json(
      { error: "The trial service is temporarily unavailable.", code: "TRIAL_STORAGE" },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }
}
