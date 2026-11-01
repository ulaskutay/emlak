import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getIntegrations, isMailReady } from "./integrations";
import { site } from "./site";

let transport: { key: string; t: Transporter } | null = null;

/** E-posta gönderilebiliyor mu (Yönetim > Ayarlar ya da SMTP_HOST): değilse doğrulama zorunlu tutulmaz, kullanıcı bağlantıyı hiç alamaz. */
export async function mailEnabled() {
  return isMailReady(await getIntegrations());
}

/** SMTP tanımlı değilse null: e-posta gönderilmez, bağlantı loga yazılır. Ayar değişince bağlantı yeniden kurulur. */
async function getTransport() {
  const { smtp } = await getIntegrations();
  if (!smtp.host) return null;
  const key = JSON.stringify(smtp);
  if (transport?.key !== key) {
    transport = {
      key,
      t: nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      }),
    };
  }
  return { t: transport.t, from: smtp.from || `${site.name} <${site.email}>` };
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
  const m = await getTransport();
  if (!m) {
    console.info(`[e-posta gönderilmedi: SMTP ayarı yok] ${to} · ${subject}\n${text}`);
    return;
  }
  await m.t.sendMail({ from: m.from, to, subject, html, text });
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

/** Yönetim > Ayarlar'daki deneme düğmesi: gönderildiyse true, SMTP ayarı yoksa false; sunucu hatası fırlatılır. */
export async function sendTestMail(to: string) {
  const m = await getTransport();
  if (!m) return false;
  const title = "Deneme e-postası";
  const body = "E-posta ayarlarınız çalışıyor. Doğrulama ve şifre yenileme e-postaları bu sunucudan gönderilecek.";
  await m.t.sendMail({
    from: m.from,
    to,
    subject: `${title} · ${site.name}`,
    html: layout({ title, body, cta: "Siteye gidin", url: site.url, foot: "Bu e-posta Yönetim > Ayarlar'dan istendi." }),
    text: body,
  });
  return true;
}
