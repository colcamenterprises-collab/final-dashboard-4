const imageByItem: Array<[string, string]> = [
  ["french fries", "/images/menu/french-fries.webp?v=267"],
  ["cajun shaker fries", "/images/menu/cajun-fries.webp?v=267"],
  ["cajun fries", "/images/menu/cajun-fries.webp?v=267"],
  ["cheesy bacon fries", "/images/menu/cheesy-bacon-fries.webp?v=267"],
  ["loaded fries", "/images/menu/loaded-fries.webp?v=267"],
  ["dirty fries", "/images/menu/loaded-fries.webp?v=267"],
  ["chicken nuggets (6)", "/images/menu/chicken-nuggets.webp?v=267"],
  ["chicken nuggets", "/images/menu/chicken-nuggets.webp?v=267"],
  ["coleslaw with bacon", "/images/menu/coleslaw.webp?v=267"],
  ["coleslaw", "/images/menu/coleslaw.webp?v=267"],
];

const normalise = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const resolvePosImage = (item: any) => {
  const text = normalise(`${item?.name_en || ""} ${item?.name_th || ""}`);
  const match = imageByItem.find(([name]) => text.includes(name));
  return match?.[1] || item?.image_url;
};

// Attach committed images before the React POS receives the menu response.
// This avoids reliance on the disabled database endpoint and avoids fragile DOM mutation.
const nativeFetch = window.fetch.bind(window);
window.fetch = async (...args: Parameters<typeof fetch>) => {
  const response = await nativeFetch(...args);
  const target = typeof args[0] === "string" ? args[0] : args[0]?.url || "";

  if (!target.includes("/api/pos/menu") || target.includes("/modifiers")) {
    return response;
  }

  try {
    const body = await response.clone().json();
    if (!Array.isArray(body?.data)) return response;

    body.data = body.data.map((item: any) => ({
      ...item,
      image_url: resolvePosImage(item),
    }));

    return new Response(JSON.stringify(body), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch {
    return response;
  }
};
