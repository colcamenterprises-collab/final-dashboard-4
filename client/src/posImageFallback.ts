const imageByItem: Array<[string, string]> = [
  ["french fries", "/images/menu/french-fries.webp?v=268"],
  ["cajun shaker fries", "/images/menu/cajun-fries.webp?v=268"],
  ["cajun fries", "/images/menu/cajun-fries.webp?v=268"],
  ["cheesy bacon fries", "/images/menu/cheesy-bacon-fries.webp?v=268"],
  ["loaded fries", "/images/menu/loaded-fries.webp?v=268"],
  ["dirty fries", "/images/menu/loaded-fries.webp?v=268"],
  ["chicken nuggets (6)", "/images/menu/chicken-nuggets.webp?v=268"],
  ["chicken nuggets", "/images/menu/chicken-nuggets.webp?v=268"],
  ["coleslaw with bacon", "/images/menu/coleslaw.webp?v=268"],
  ["coleslaw", "/images/menu/coleslaw.webp?v=268"],
  ["fanta orange", "/images/menu/fanta-orange.webp?v=268"],
];

const normalise = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .replace(/฿[\d,.]+/g, " ")
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const findImage = (value: unknown) => {
  const text = normalise(value);
  return imageByItem.find(([name]) => text.includes(name))?.[1];
};

const resolvePosImage = (item: any) =>
  findImage(`${item?.name_en || ""} ${item?.name_th || ""}`) || item?.image_url;

// Apply image URLs before the POS receives the API response.
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

    const headers = new Headers(response.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");
    headers.set("content-type", "application/json; charset=utf-8");

    return new Response(JSON.stringify(body), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
};

// Final rendering safeguard: update the actual POS card image elements after React renders.
const applyImagesToCards = () => {
  if (!window.location.pathname.startsWith("/pos")) return;

  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const expected = findImage(button.textContent);
    if (!expected) return;

    const image = button.querySelector<HTMLImageElement>("img");
    if (!image) return;

    if (image.getAttribute("src") !== expected) image.setAttribute("src", expected);
    image.setAttribute("alt", normalise(button.textContent));
    image.style.setProperty("display", "block", "important");
    image.style.setProperty("width", "100%", "important");
    image.style.setProperty("height", "66px", "important");
    image.style.setProperty("max-height", "66px", "important");
    image.style.setProperty("object-fit", "contain", "important");
    image.style.setProperty("opacity", "1", "important");
    image.style.setProperty("visibility", "visible", "important");
  });
};

const observer = new MutationObserver(applyImagesToCards);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("load", applyImagesToCards);
window.addEventListener("pageshow", applyImagesToCards);
window.setInterval(applyImagesToCards, 500);
applyImagesToCards();
