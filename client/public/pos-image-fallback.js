(() => {
  const imageByItem = [
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

  const normalise = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/฿[\d,.]+/g, " ")
      .replace(/\+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  function applyImages() {
    if (!location.pathname.startsWith("/pos")) return;

    document.querySelectorAll("button").forEach((button) => {
      const text = normalise(button.textContent);
      const match = imageByItem.find(([name]) => text.includes(name));
      if (!match) return;

      const expected = match[1];
      let image = button.querySelector("img");
      const imageHost = button.querySelector("div");

      if (!image && imageHost) {
        image = document.createElement("img");
        imageHost.prepend(image);
      }
      if (!image) return;

      image.setAttribute("src", `${expected}?v=265`);
      image.setAttribute("alt", match[0]);
      image.style.display = "block";
      image.style.width = "100%";
      image.style.height = "68px";
      image.style.maxHeight = "68px";
      image.style.objectFit = "contain";
      image.style.opacity = "1";
      image.style.visibility = "visible";
      image.style.background = "transparent";
    });
  }

  const observer = new MutationObserver(applyImages);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  window.addEventListener("load", applyImages);
  window.addEventListener("pageshow", applyImages);
  window.addEventListener("popstate", applyImages);
  window.setInterval(applyImages, 1000);
  applyImages();
})();
