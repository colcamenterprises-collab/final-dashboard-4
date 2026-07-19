const imageByItem: Array<[string, string]> = [
  ["french fries", "/images/menu/french-fries.webp"],
  ["cajun shaker fries", "/images/menu/cajun-fries.webp"],
  ["cajun fries", "/images/menu/cajun-fries.webp"],
  ["cheesy bacon fries", "/images/menu/cheesy-bacon-fries.webp"],
  ["loaded fries", "/images/menu/loaded-fries.webp"],
  ["dirty fries", "/images/menu/loaded-fries.webp"],
  ["chicken nuggets (6)", "/images/menu/chicken-nuggets.webp"],
  ["chicken nuggets", "/images/menu/chicken-nuggets.webp"],
  ["coleslaw with bacon", "/images/menu/coleslaw.webp"],
  ["coleslaw", "/images/menu/coleslaw.webp"],
];

const normalise = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .replace(/฿[\d,.]+/g, " ")
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function applyPosImages() {
  if (!window.location.pathname.startsWith("/pos")) return;

  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const text = normalise(button.textContent);
    const match = imageByItem.find(([name]) => text.includes(name));
    if (!match) return;

    const expected = `${match[1]}?v=266`;
    let image = button.querySelector<HTMLImageElement>("img");
    let imageHost = image?.parentElement || button.querySelector<HTMLDivElement>("div");

    if (!image && imageHost) {
      image = document.createElement("img");
      imageHost.prepend(image);
    }
    if (!image) return;

    image.src = expected;
    image.alt = match[0];
    image.style.setProperty("display", "block", "important");
    image.style.setProperty("width", "100%", "important");
    image.style.setProperty("height", "68px", "important");
    image.style.setProperty("max-height", "68px", "important");
    image.style.setProperty("object-fit", "contain", "important");
    image.style.setProperty("opacity", "1", "important");
    image.style.setProperty("visibility", "visible", "important");
    image.style.setProperty("background", "transparent", "important");
  });
}

const observer = new MutationObserver(applyPosImages);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
});

window.addEventListener("load", applyPosImages);
window.addEventListener("pageshow", applyPosImages);
window.addEventListener("popstate", applyPosImages);
window.setInterval(applyPosImages, 750);
applyPosImages();
