(() => {
  // POS product images now come directly from ordering_menu_items.image_url.
  // The former DOM override replaced uploaded transparent images with legacy
  // assets and forced them into a 68px square, so it is intentionally disabled.
})();
