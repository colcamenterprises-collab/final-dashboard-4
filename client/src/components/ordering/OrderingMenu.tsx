import { useMemo, useState } from "react";
import type { CartItem, OrderingLanguage } from "./orderingApi";
import { itemLabel, money } from "./orderingApi";

const fallbackImages = [
  "/images/menu/super-double-set.jpg",
  "/images/menu/double-set.jpg",
  "/images/menu/single-smash-set.jpg",
  "/images/menu/triple-smash-set.jpg",
  "/images/menu/karaage-chicken-burger-meal-deal.jpg",
];

function imageForItem(item: any, index: number) {
  return item.image_url || item.imageUrl || item.photo_url || item.photoUrl || fallbackImages[index % fallbackImages.length];
}

type Props = {
  categories: any[];
  language: OrderingLanguage;
  large?: boolean;
  onAdd: (item: CartItem) => void;
};

export default function OrderingMenu({ categories, language, large, onAdd }: Props) {
  const [notesByItem, setNotesByItem] = useState<Record<string, string>>({});
  const [modsByItem, setModsByItem] = useState<Record<string, Set<string>>>({});
  const [optionErrors, setOptionErrors] = useState<Record<string, string>>({});
  const buttonClass = large ? "sbo-menu-add is-large" : "sbo-menu-add";

  const modifierLookup = useMemo(() => {
    const lookup: Record<string, any> = {};
    for (const category of categories) for (const item of category.items ?? []) for (const group of item.modifier_groups ?? []) for (const modifier of group.modifiers ?? []) lookup[modifier.id] = modifier;
    return lookup;
  }, [categories]);

  function selectionError(item: any, selectedIds: Set<string>) {
    if (!item) return "";
    for (const group of item.modifier_groups ?? []) {
      const count = (group.modifiers ?? []).filter((modifier: any) => selectedIds.has(modifier.id)).length;
      const minimum = Number(group.min_selections ?? group.min_select ?? (group.is_required ? 1 : 0));
      const configuredMaximum = group.max_selections ?? group.max_select;
      const maximum = group.selection_mode === "single" ? 1 : configuredMaximum == null ? null : Number(configuredMaximum);
      if (count < minimum) return `Choose ${minimum} option${minimum === 1 ? "" : "s"} from ${group.prompt_text || group.name_en}`;
      if (maximum !== null && count > maximum) return `Choose no more than ${maximum} option${maximum === 1 ? "" : "s"} from ${group.name_en}`;
    }
    return "";
  }

  function addItem(item: any) {
    const selectedIds = Array.from(modsByItem[item.id] ?? []);
    const error = selectionError(item, new Set(selectedIds));
    if (error) {
      setOptionErrors((previous) => ({ ...previous, [item.id]: error }));
      return;
    }
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
    setOptionErrors((previous) => ({ ...previous, [item.id]: "" }));
  }

  function toggleModifier(itemId: string, group: any, modifierId: string) {
    const next = new Set(modsByItem[itemId] ?? []);
    if (group.selection_mode === "single") {
      for (const option of group.modifiers ?? []) next.delete(option.id);
      next.add(modifierId);
    } else {
      next.has(modifierId) ? next.delete(modifierId) : next.add(modifierId);
    }
    setModsByItem((previous) => ({ ...previous, [itemId]: next }));
    const item = categories.flatMap((category) => category.items ?? []).find((entry) => entry.id === itemId);
    setOptionErrors((previous) => ({ ...previous, [itemId]: selectionError(item, next) }));
  }

  if (!categories.length) return <div className="sbo-empty">No ordering menu items have been created yet.</div>;

  return (
    <div className="sbo-menu">
      {categories.map((category) => (
        <section key={category.id} className="sbo-category">
          <h2>{language === "th" && category.name_th ? category.name_th : category.name_en}</h2>
          <div className="sbo-menu-grid">
            {(category.items ?? []).map((item: any, itemIndex: number) => {
              const soldOut = item.is_sold_out || !item.is_active;
              return (
                <article key={item.id} className="sbo-menu-card">
                  <div className="sbo-menu-photo"><img src={imageForItem(item, itemIndex)} alt={itemLabel(item, language)} /></div>
                  <header>
                    <div>
                      <h3>{itemLabel(item, language)}</h3>
                      <p>{language === "th" && item.description_th ? item.description_th : item.description_en}</p>
                    </div>
                    <div className="sbo-price">{money(item.price)}</div>
                  </header>
                  {soldOut && <div className="sbo-soldout">Sold out</div>}
                  {!soldOut && (item.modifier_groups ?? []).map((group: any) => (
                    <div key={group.id} className="sbo-mod-group">
                      <div className="sbo-mod-title">
                        {language === "th" && group.name_th ? group.name_th : group.prompt_text || group.name_en}
                        {Number(group.min_selections ?? group.min_select ?? (group.is_required ? 1 : 0)) > 0 ? " · Required" : " · Optional"}
                      </div>
                      <div className="sbo-mod-list">
                        {(group.modifiers ?? []).map((modifier: any) => (
                          <label key={modifier.id}>
                            <input
                              type={group.selection_mode === "single" ? "radio" : "checkbox"}
                              name={group.selection_mode === "single" ? `${item.id}-${group.id}` : undefined}
                              checked={modsByItem[item.id]?.has(modifier.id) ?? false}
                              onChange={() => toggleModifier(item.id, group, modifier.id)}
                            />
                            <span>
                              {itemLabel(modifier, language)} {group.group_type === "choice"
                                ? money(Number(item.price) + Number(modifier.price_delta || 0))
                                : Number(modifier.price_delta) ? `+${money(modifier.price_delta)}` : ""}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!soldOut && (
                    <>
                      {optionErrors[item.id] && <div className="sbo-soldout">{optionErrors[item.id]}</div>}
                      <textarea className="sbo-item-notes" placeholder="Item notes" value={notesByItem[item.id] ?? ""} onChange={(event) => setNotesByItem((prev) => ({ ...prev, [item.id]: event.target.value }))} />
                      <button className={buttonClass} onClick={() => addItem(item)}>Add to Cart</button>
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
