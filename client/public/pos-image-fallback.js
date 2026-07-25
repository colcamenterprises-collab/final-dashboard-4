(() => {
  // Keep this patch isolated to the live POS register. Product images still come
  // directly from ordering_menu_items.image_url; this only corrects card layout.
  if (!window.location.pathname.startsWith("/pos")) return;

  const styleId = "sbb-pos-tablet-card-layout";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      [data-pos-product-card="true"] {
        box-sizing: border-box !important;
        height: 220px !important;
        min-height: 220px !important;
        padding-top: 92px !important;
        display: flex !important;
        flex-direction: column !important;
      }

      [data-pos-product-card="true"] > [data-pos-product-image="true"] {
        top: -30px !important;
        height: 122px !important;
      }

      [data-pos-product-card="true"] > [data-pos-product-image="true"] img {
        height: 128px !important;
        max-height: 128px !important;
        width: 100% !important;
        object-fit: contain !important;
      }

      [data-pos-product-card="true"] > [data-pos-product-title="true"] {
        margin-top: 0 !important;
        min-height: 44px !important;
        font-size: 16px !important;
        line-height: 22px !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
      }

      [data-pos-product-card="true"] > [data-pos-product-price="true"] {
        margin-top: auto !important;
        font-size: 20px !important;
        line-height: 1 !important;
      }

      [data-pos-product-card="true"] > span:last-child {
        flex: 0 0 32px !important;
      }

      @media (max-width: 900px) {
        [data-pos-product-card="true"] {
          height: 218px !important;
          min-height: 218px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const markProductCards = () => {
    document.querySelectorAll("button.group.relative").forEach((button) => {
      const children = Array.from(button.children);
      const image = children.find((child) => child instanceof HTMLElement && child.classList.contains("absolute"));
      const paragraphs = children.filter((child) => child.tagName === "P");
      const addButton = children.find((child) => child.tagName === "SPAN" && child.textContent?.trim() === "+");

      if (!(button instanceof HTMLElement) || !image || paragraphs.length < 2 || !addButton) return;

      button.dataset.posProductCard = "true";
      if (image instanceof HTMLElement) image.dataset.posProductImage = "true";
      if (paragraphs[0] instanceof HTMLElement) paragraphs[0].dataset.posProductTitle = "true";
      if (paragraphs[1] instanceof HTMLElement) paragraphs[1].dataset.posProductPrice = "true";
    });
  };

  markProductCards();
  new MutationObserver(markProductCards).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
