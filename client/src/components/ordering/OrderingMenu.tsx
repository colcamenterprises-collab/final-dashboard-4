import { useMemo, useState } from "react";
import type { CartItem, OrderingLanguage } from "./orderingApi";
import { itemLabel, money } from "./orderingApi";

type Props = {
  categories: any[];
  language: OrderingLanguage;
  large?: boolean;
  onAdd: (item: CartItem) => void;
};

export default function OrderingMenu({ categories, language, large, onAdd }: Props) {
  const [notesByItem, setNotesByItem] = useState<Record<string, string>>({});
  const [modsByItem, setModsByItem] = useState<Record<string, Set<string>>>({});
  const buttonClass = large ? "px-6 py-4 text-lg" : "px-4 py-2";

  const modifierLookup = useMemo(() => {
    const lookup: Record<string, any> = {};
    for (const category of categories) for (const item of category.items ?? []) for (const group of item.modifier_groups ?? []) for (const modifier of group.modifiers ?? []) lookup[modifier.id] = modifier;
    return lookup;
  }, [categories]);

  function addItem(item: any) {
    const selectedIds = Array.from(modsByItem[item.id] ?? []);
    onAdd({
      menu_item_id: item.id,
      name_en: item.name_en,
      name_th: item.name_th,
      price: item.price,
      quantity: 1,
      notes: notesByItem[item.id] ?? "",
      modifiers: selectedIds.map((id) => ({ item_modifier_id: id, name_en: modifierLookup[id].name_en, name_th: modifierLookup[id].name_th, price_delta: modifierLookup[id].price_delta, quantity: 1 })),
    });
    setNotesByItem((prev) => ({ ...prev, [item.id]: "" }));
    setModsByItem((prev) => ({ ...prev, [item.id]: new Set() }));
  }

  function toggleModifier(itemId: string, modifierId: string) {
    setModsByItem((prev) => {
      const next = new Set(prev[itemId] ?? []);
      next.has(modifierId) ? next.delete(modifierId) : next.add(modifierId);
      return { ...prev, [itemId]: next };
    });
  }

  if (!categories.length) return <div className="rounded border p-4">No ordering menu items have been created yet.</div>;

  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <section key={category.id} className="space-y-3">
          <h2 className="text-2xl font-semibold">{language === "th" && category.name_th ? category.name_th : category.name_en}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {(category.items ?? []).map((item: any) => {
              const soldOut = item.is_sold_out || !item.is_active;
              return (
                <article key={item.id} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">{itemLabel(item, language)}</h3>
                      <p className="text-sm text-gray-600">{language === "th" && item.description_th ? item.description_th : item.description_en}</p>
                    </div>
                    <div className="text-lg font-semibold">{money(item.price)}</div>
                  </div>
                  {soldOut && <div className="mt-3 rounded bg-gray-100 px-3 py-2 text-sm font-medium">Sold out</div>}
                  {!soldOut && (item.modifier_groups ?? []).map((group: any) => (
                    <div key={group.id} className="mt-3 border-t pt-3">
                      <div className="font-medium">{language === "th" && group.name_th ? group.name_th : group.name_en}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(group.modifiers ?? []).map((modifier: any) => (
                          <label key={modifier.id} className="flex items-center gap-2 rounded border px-3 py-2">
                            <input type="checkbox" checked={modsByItem[item.id]?.has(modifier.id) ?? false} onChange={() => toggleModifier(item.id, modifier.id)} />
                            <span>{itemLabel(modifier, language)} {Number(modifier.price_delta) ? `+${money(modifier.price_delta)}` : ""}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!soldOut && (
                    <>
                      <textarea className="mt-3 w-full rounded border p-2" placeholder="Item notes" value={notesByItem[item.id] ?? ""} onChange={(event) => setNotesByItem((prev) => ({ ...prev, [item.id]: event.target.value }))} />
                      <button className={`mt-3 rounded bg-black text-white ${buttonClass}`} onClick={() => addItem(item)}>Add</button>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
