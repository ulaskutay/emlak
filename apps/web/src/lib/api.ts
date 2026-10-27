import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "./auth";

/** API rotaları için: oturum yoksa 401. */
export async function apiUser() {
  const s = await getSession();
  return s && !s.user.banned ? s.user : null;
}

export const unauthorized = () => NextResponse.json({ error: "Giriş yapmalısınız" }, { status: 401 });
export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
export const notFound = () => NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
