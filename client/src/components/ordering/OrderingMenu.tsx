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

function imageForItem(item: any, index = 0) {
  return item.image_url || item.imageUrl || item.photo_url || item.photoUrl || fallbackImages[index % fallbackImages.length];
}

type Props = {
  categories: any[];
  language: OrderingLanguage;
  large?: boolean;
  onAdd: (item: CartItem) => void;
};

export default function OrderingMenu({ categories, language, onAdd }: Props) {
  const [activeItem, setActiveItem] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const modifierLookup = useMemo(() => {
    const lookup: Record<string, any> = {};
    for (const category of categories) {
      for (const item of category.items ?? []) {
        for (const group of item.modifier_groups ?? []) {
          for (const modifier of group.modifiers ?? []) lookup[modifier.id] = modifier;
        }
      }
    }
    return lookup;
  }, [categories]);

  function openItem(item: any) {
    if (item.is_sold_out || !item.is_active) return;
    setActiveItem(item);
    setSelectedIds(new Set());
    setNotes("");
    setError("");
  }

  function closeItem() {
    setActiveItem(null);
    setSelectedIds(new Set());
    setNotes("");
    setError("");
  }

  function selectionError(item: any, selected: Set<string>) {
    for (const group of item?.modifier_groups ?? []) {
      const count = (group.modifiers ?? []).filter((modifier: any) => selected.has(modifier.id)).length;
      const minimum = Number(group.min_selections ?? group.min_select ?? (group.is_required ? 1 : 0));
      const configuredMaximum = group.max_selections ?? group.max_select;
      const maximum = group.selection_mode === "single" ? 1 : configuredMaximum == null ? null : Number(configuredMaximum);
      if (count < minimum) return `Choose ${minimum} option${minimum === 1 ? "" : "s"} from ${group.prompt_text || group.name_en}`;
      if (maximum !== null && count > maximum) return `Choose no more than ${maximum} option${maximum === 1 ? "" : "s"} from ${group.name_en}`;
    }
    return "";
  }

  function toggleModifier(group: any, modifierId: string) {
    const next = new Set(selectedIds);
    if (group.selection_mode === "single") {
      for (const option of group.modifiers ?? []) next.delete(option.id);
      next.add(modifierId);
    } else {
      next.has(modifierId) ? next.delete(modifierId) : next.add(modifierId);
    }
    setSelectedIds(next);
    setError("");
  }

  function addActiveItem() {
    if (!activeItem) return;
    const validationError = selectionError(activeItem, selectedIds);
    if (validationError) return setError(validationError);

    onAdd({
      menu_item_id: activeItem.id,
      name_en: activeItem.name_en,
      name_th: activeItem.name_th,
      price: activeItem.price,
      quantity: 1,
      notes,
      modifiers: Array.from(selectedIds).map((id) => ({
        item_modifier_id: id,
        name_en: modifierLookup[id]?.name_en || "Option",
        name_th: modifierLookup[id]?.name_th,
        price_delta: modifierLookup[id]?.price_delta || "0",
        quantity: 1,
      })),
    });
    closeItem();
  }

  function scrollToCategory(id: string) {
    document.getElementById(`order-category-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!categories.length) return <div className="sbo-empty">No ordering menu items have been created yet.</div>;

  return (
    <>
      <nav className="sbo-category-nav" aria-label="Menu categories">
        {categories.map((category) => (
          <button key={category.id} type="button" onClick={() => scrollToCategory(category.id)}>
            <span className="sbo-category-icon">{String(category.name_en || "M").slice(0, 1)}</span>
            <span>{language === "th" && category.name_th ? category.name_th : category.name_en}</span>
          </button>
        ))}
      </nav>

      <div className="sbo-menu">
        {categories.map((category) => (
          <section key={category.id} id={`order-category-${category.id}`} className="sbo-category">
            <h2>{language === "th" && category.name_th ? category.name_th : category.name_en}</h2>
            <div className="sbo-menu-grid">
              {(category.items ?? []).map((item: any, itemIndex: number) => {
                const soldOut = item.is_sold_out || !item.is_active;
                return (
                  <article key={item.id} className={`sbo-menu-card ${soldOut ? "is-sold-out" : ""}`} onClick={() => openItem(item)}>
                    <div className="sbo-menu-photo"><img src={imageForItem(item, itemIndex)} alt={itemLabel(item, language)} /></div>
                    <div className="sbo-menu-card-body">
                      <h3>{itemLabel(item, language)}</h3>
                      {item.description_en || item.description_th ? <p>{language === "th" && item.description_th ? item.description_th : item.description_en}</p> : null}
                      <div className="sbo-menu-card-footer">
                        <span className="sbo-price">{money(item.price)}</span>
                        <button type="button" disabled={soldOut} onClick={(event) => { event.stopPropagation(); openItem(item); }} aria-label={`Add ${itemLabel(item, language)}`}>{soldOut ? "Sold out" : "+"}</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {activeItem && (
        <div className="sbo-modal-backdrop" role="presentation" onMouseDown={closeItem}>
          <section className="sbo-product-modal" role="dialog" aria-modal="true" aria-label={itemLabel(activeItem, language)} onMouseDown={(event) => event.stopPropagation()}>
            <button className="sbo-modal-close" type="button" onClick={closeItem}>×</button>
            <div className="sbo-product-modal-image"><img src={imageForItem(activeItem)} alt={itemLabel(activeItem, language)} /></div>
            <div className="sbo-product-modal-content">
              <div className="sbo-product-modal-title"><div><h2>{itemLabel(activeItem, language)}</h2><p>{language === "th" && activeItem.description_th ? activeItem.description_th : activeItem.description_en}</p></div><strong>{money(activeItem.price)}</strong></div>
              {(activeItem.modifier_groups ?? []).map((group: any) => {
                const minimum = Number(group.min_selections ?? group.min_select ?? (group.is_required ? 1 : 0));
                return <div key={group.id} className="sbo-modal-group">
                  <div className="sbo-modal-group-head"><strong>{language === "th" && group.name_th ? group.name_th : group.prompt_text || group.name_en}</strong><span>{minimum > 0 ? "Required" : "Optional"}</span></div>
                  {(group.modifiers ?? []).map((modifier: any) => (
                    <label key={modifier.id} className="sbo-modal-option">
                      <span><input type={group.selection_mode === "single" ? "radio" : "checkbox"} name={group.selection_mode === "single" ? `${activeItem.id}-${group.id}` : undefined} checked={selectedIds.has(modifier.id)} onChange={() => toggleModifier(group, modifier.id)} /> {itemLabel(modifier, language)}</span>
                      <span>{Number(modifier.price_delta) ? `+${money(modifier.price_delta)}` : ""}</span>
                    </label>
                  ))}
                </div>;
              })}
              <label className="sbo-modal-notes">Item notes<textarea placeholder="Anything we should know about this item?" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
              {error && <div className="sbo-modal-error">{error}</div>}
              <button className="sbo-modal-add" type="button" onClick={addActiveItem}>Add to cart</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
