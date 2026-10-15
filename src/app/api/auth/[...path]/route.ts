import { auth } from "@/server/auth";

/** Neon Auth's endpoints (send code, sign in, session, sign out), on our domain. */
type Ctx = { params: Promise<{ path: string[] }> };

let handlers: ReturnType<ReturnType<typeof auth>["handler"]> | undefined;
const handler = () => (handlers ??= auth().handler());

export const GET = (req: Request, ctx: Ctx) => handler().GET(req, ctx);
export const POST = (req: Request, ctx: Ctx) => handler().POST(req, ctx);
