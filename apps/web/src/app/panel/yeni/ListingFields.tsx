"use client";
import { useEffect } from "react";
import { OFFICE_KEY } from "./Wizard";

export type ListingValues = { price: string; officeName: string; phone: string };

/** Fiyat, ofis adı ve telefon; ofis bilgisi tarayıcıda hatırlanır (sihirbazla aynı anahtar). */
export function ListingFields({ value, onChange }: { value: ListingValues; onChange: (v: ListingValues) => void }) {
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OFFICE_KEY) ?? "{}");
      if (saved.officeName || saved.phone) onChange({ ...value, officeName: saved.officeName ?? "", phone: saved.phone ?? "" });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <label className="pnl-label" htmlFor="price">Fiyat (TL)</label>
        <input id="price" className="pnl-input" inputMode="numeric" placeholder="Örn. 12.500.000" value={value.price}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
            onChange({ ...value, price: digits ? Number(digits).toLocaleString("tr-TR") : "" });
          }} />
      </div>
      <div>
        <label className="pnl-label" htmlFor="office">Ofis adı</label>
        <input id="office" className="pnl-input" maxLength={60} placeholder="Örn. Etic Emlak" value={value.officeName}
          onChange={(e) => onChange({ ...value, officeName: e.target.value })} />
      </div>
      <div>
        <label className="pnl-label" htmlFor="phone">Telefon</label>
        <input id="phone" className="pnl-input" maxLength={20} inputMode="tel" placeholder="0532 000 00 00" value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value.replace(/[^0-9+ ()-]/g, "") })} />
      </div>
    </div>
  );
}

/** API'ye giden ilan bilgisi; ofis bilgisini bir sonraki video için saklar. */
export function listingPayload(v: ListingValues) {
  try {
    localStorage.setItem(OFFICE_KEY, JSON.stringify({ officeName: v.officeName, phone: v.phone }));
  } catch {}
  const price = Number(v.price.replace(/\D/g, ""));
  return {
    ...(price ? { priceTry: price } : {}),
    ...(v.officeName.trim() ? { officeName: v.officeName.trim() } : {}),
    ...(v.phone.trim() ? { phone: v.phone.trim() } : {}),
  };
}
