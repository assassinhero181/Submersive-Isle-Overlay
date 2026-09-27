SUBMERSIVE ISLE OVERLAY v 1.0.0 - FUTURE FEATURE AREAS

These files are intentionally separated so future features can be added without
rewriting the core overlay:

  inventory-items.js  -> future inventory item definitions
  currency.js         -> future player/server currency
  store-items.js      -> future store item definitions and prices

Do not connect these files to the live UI until the feature is ready.
Keep server access in api-client.js/backend API and UI rendering in main.js. Never put RCON credentials in the overlay.
