export interface MenuCategoryWithItems<T = any> {
  items?: unknown;
  [key: string]: unknown;
}

export interface MenuDataShapeResult<T = any> {
  items: T[];
  isValidShape: boolean;
}

export function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeMenuItems<T = any>(payload: unknown): MenuDataShapeResult<T> {
  if (Array.isArray(payload)) return { items: payload as T[], isValidShape: true };
  if (!payload || typeof payload !== "object") return { items: [], isValidShape: false };

  const data = (payload as { data?: unknown }).data;
  const items = (payload as { items?: unknown }).items;
  const categories = (payload as { categories?: unknown }).categories;

  if (Array.isArray(data)) return { items: data as T[], isValidShape: true };
  if (data && typeof data === "object") {
    const dataItems = (data as { items?: unknown }).items;
    const dataCategories = (data as { categories?: unknown }).categories;

    if (Array.isArray(dataItems)) return { items: dataItems as T[], isValidShape: true };
    if (Array.isArray(dataCategories)) {
      return {
        items: dataCategories.flatMap((category) => asArray<T>((category as MenuCategoryWithItems<T>)?.items)),
        isValidShape: true,
      };
    }
  }

  if (Array.isArray(items)) return { items: items as T[], isValidShape: true };
  if (Array.isArray(categories)) {
    return {
      items: categories.flatMap((category) => asArray<T>((category as MenuCategoryWithItems<T>)?.items)),
      isValidShape: true,
    };
  }

  return { items: [], isValidShape: false };
}

export function normalizeMenuCategories<T = any>(payload: unknown): MenuDataShapeResult<T> {
  if (Array.isArray(payload)) return { items: payload as T[], isValidShape: true };
  if (!payload || typeof payload !== "object") return { items: [], isValidShape: false };

  const data = (payload as { data?: unknown }).data;
  const categories = (payload as { categories?: unknown }).categories;

  if (data && typeof data === "object" && Array.isArray((data as { categories?: unknown }).categories)) {
    return { items: (data as { categories: T[] }).categories, isValidShape: true };
  }
  if (Array.isArray(categories)) return { items: categories as T[], isValidShape: true };
  if (Array.isArray(data)) return { items: data as T[], isValidShape: true };

  return { items: [], isValidShape: false };
}

export function logInvalidMenuShape(where: string, payload: unknown) {
  if (import.meta.env.DEV) {
    console.debug(`${where}: Menu data could not be loaded. Check API response shape.`, payload);
  }
}
