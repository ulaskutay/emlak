import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// Örnek her istekte alınır: Google bilgileri ayarlardan değişince yeni örnek devreye girer.
export const GET = async (req: Request) => toNextJsHandler(await getAuth()).GET(req);
export const POST = async (req: Request) => toNextJsHandler(await getAuth()).POST(req);
