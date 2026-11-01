import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { site } from "./site";

let transport: Transporter | null | undefined;

/** SMTP_HOST tanımlı değilse null: geliştirmede e-posta gönderilmez, bağlantı konsola yazılır. */
function getTransport() {
  if (transport !== undefined) return transport;
  const host = process.env.SMTP_HOST;
  if (!host) return (transport = null);
  const port = Number(process.env.SMTP_PORT ?? 587);
  transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Tek düğmeli, markalı e-posta (Gökyüzü renkleri; e-posta istemcileri için satır içi stil). */
function layout({ title, body, cta, url, foot }: { title: string; body: string; cta: string; url: string; foot: string }) {
  return `<!doctype html><html lang="tr"><body style="margin:0;background:#f5f8fd;font-family:Helvetica,Arial,sans-serif;color:#0d1b3e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fd;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 4px 20px;font-size:20px;font-weight:800;letter-spacing:-.5px">
<span style="display:inline-block;width:28px;height:28px;border-radius:9px;background:#2b6cff;vertical-align:middle;margin-right:8px"></span>${esc(site.name)}</td></tr>
<tr><td style="background:#fff;border:1px solid #e2e8f3;border-radius:20px;padding:32px">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">${esc(title)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.55;color:#56627a">${esc(body)}</p>
<a href="${esc(url)}" style="display:inline-block;background:#2b6cff;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;border-radius:999px">${esc(cta)}</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#56627a">Düğme çalışmazsa bu adresi tarayıcınıza yapıştırın:<br><a href="${esc(url)}" style="color:#2b6cff;word-break:break-all">${esc(url)}</a></p>
</td></tr>
<tr><td style="padding:20px 4px 0;font-size:12px;line-height:1.5;color:#56627a">${esc(foot)}</td></tr>
</table></td></tr></table></body></html>`;
}

async function send(to: string, subject: string, html: string, text: string) {
  const t = getTransport();
  if (!t) {
    console.info(`[e-posta gönderilmedi: SMTP_HOST yok] ${to} · ${subject}\n${text}`);
    return;
  }
  await t.sendMail({ from: process.env.SMTP_FROM ?? `${site.name} <${site.email}>`, to, subject, html, text });
}

export async function sendVerifyMail(to: string, url: string) {
  const title = "E-posta adresinizi doğrulayın";
  const body = "Arsa Video hesabınızı oluşturdunuz. Video sipariş edebilmek için aşağıdaki düğmeyle e-posta adresinizi doğrulayın.";
  await send(
    to,
    `${title} · ${site.name}`,
    layout({ title, body, cta: "E-postamı doğrula", url, foot: "Bu hesabı siz oluşturmadıysanız bu e-postayı yok sayabilirsiniz." }),
    `${body}\n\n${url}`,
  );
}

export async function sendResetMail(to: string, url: string) {
  const title = "Şifrenizi yenileyin";
  const body = "Şifre yenileme isteği aldık. Yeni şifrenizi belirlemek için aşağıdaki düğmeye tıklayın; bağlantı 1 saat geçerlidir.";
  await send(
    to,
    `${title} · ${site.name}`,
    layout({ title, body, cta: "Yeni şifre belirle", url, foot: "Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz değişmez." }),
    `${body}\n\n${url}`,
  );
}
