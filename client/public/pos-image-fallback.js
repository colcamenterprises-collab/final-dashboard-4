(() => {
  const imageByItem = [
    [/^French Fries$/i, "/images/menu/french-fries.webp"],
    [/^Cajun (Shaker )?Fries$/i, "/images/menu/cajun-fries.webp"],
    [/^Cheesy Bacon Fries$/i, "/images/menu/cheesy-bacon-fries.webp"],
    [/^Loaded Fries$/i, "/images/menu/loaded-fries.webp"],
    [/^Dirty Fries$/i, "/images/menu/loaded-fries.webp"],
    [/^Chicken Nuggets(?:\s*\(6\))?$/i, "/images/menu/chicken-nuggets.webp"],
    [/^Coleslaw(?: with Bacon)?$/i, "/images/menu/coleslaw.webp"],
  ];

  function applyImages() {
    if (!location.pathname.startsWith("/pos")) return;

    document.querySelectorAll("button").forEach((button) => {
      const text = (button.textContent || "").replace(/฿[\d,.]+/g, "").replace(/\+/g, "").trim();
      const match = imageByItem.find(([pattern]) => pattern.test(text));
      if (!match) return;

      const image = button.querySelector("img");
      if (!image) return;

      const expected = match[1];
      if (image.getAttribute("src") !== expected) {
        image.setAttribute("src", expected);
        image.setAttribute("alt", text);
        image.style.objectFit = "contain";
        image.style.background = "transparent";
      }
    });
  }

  const observer = new MutationObserver(applyImages);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("load", applyImages);
  window.addEventListener("popstate", applyImages);
  applyImages();
})();
