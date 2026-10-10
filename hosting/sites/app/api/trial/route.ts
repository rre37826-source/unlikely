import { serveTrialRequest } from "./handler";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return serveTrialRequest(request);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return serveTrialRequest(request);
}
