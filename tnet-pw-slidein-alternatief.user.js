// ==UserScript==
// @name          T.net pricewatch slide-in alternatief
// @match         https://tweakers.net/pricewatch/*/*.html
// @version       1.2
// @author        creesch
// @icon          https://www.google.com/s2/favicons?sz=64&domain=tweakers.net
// @description   Laat de pricewatch slide-in meer werken als gewone tabs
// @run-at        document-idle
// @grant         GM_setValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_unregisterMenuCommand
// @downloadURL   https://raw.githubusercontent.com/creesch/tnet-pricewatch-slidein-alternatief/main/tnet-pw-slidein-alternatief.user.js
// @updateURL     https://raw.githubusercontent.com/creesch/tnet-pricewatch-slidein-alternatief/main/tnet-pw-slidein-alternatief.user.js
// ==/UserScript==

/* ==========================================================================
   Instellingen & statemanagement
   ========================================================================== */
const config = {
  defaultTab: {
    value: GM_getValue("defaultTab", "prices"),
    menuId: null,
  },
  alwaysOpenSlideIn: {
    value: GM_getValue("alwaysOpenSlideIn", true),
    menuId: null,
  },
  showProductHeader: {
    value: GM_getValue("showProductHeader", true),
    menuId: null,
  },
  hydrationTimer: {
    value: GM_getValue("hydrationTimer", 200),
    menuId: null,
  },
};

const state = {
  slideInFixerExtraTabs: null,
  alreadyAddedMissingTabs: false,
};

/* ==========================================================================
   Menu beheer. GreaseMonkey/ViolentMonkey popup menu management voor instellingen.
   ========================================================================== */

function updateMenu() {
  if (config.defaultTab.menuId) {
    GM_unregisterMenuCommand(config.defaultTab.menuId);
  }
  config.defaultTab.menuId = GM_registerMenuCommand(
    `Instelling: Standaard Tab (${config.defaultTab.value})`,
    () => {
      const val = prompt(
        "Welke tab moet standaard openen? (prices / specifications)",
        config.defaultTab.value,
      );
      if (val) {
        GM_setValue("defaultTab", val.toLowerCase());
        config.defaultTab.value = val.toLowerCase();
        updateMenu();
      }
    },
  );

  if (config.alwaysOpenSlideIn.menuId) {
    GM_unregisterMenuCommand(config.alwaysOpenSlideIn.menuId);
  }
  config.alwaysOpenSlideIn.menuId = GM_registerMenuCommand(
    `Instelling: Slide-in altijd open (${config.alwaysOpenSlideIn.value ? "Aan" : "Uit"})`,
    () => {
      config.alwaysOpenSlideIn.value = !config.alwaysOpenSlideIn.value;
      GM_setValue("alwaysOpenSlideIn", config.alwaysOpenSlideIn.value);
      updateMenu();
    },
  );

  if (config.showProductHeader.menuId) {
    GM_unregisterMenuCommand(config.showProductHeader.menuId);
  }
  config.showProductHeader.menuId = GM_registerMenuCommand(
    `Instelling: Toon product header (${config.showProductHeader.value ? "Aan" : "Uit"})`,
    () => {
      config.showProductHeader.value = !config.showProductHeader.value;
      GM_setValue("showProductHeader", config.showProductHeader.value);
      updateMenu();
    },
  );

  if (config.hydrationTimer.menuId) {
    GM_unregisterMenuCommand(config.hydrationTimer.menuId);
  }
  config.hydrationTimer.menuId = GM_registerMenuCommand(
    `Instelling: Hydration timer (${config.hydrationTimer.value}ms).`,
    () => {
      const val = prompt(
        "De knoppen die de slider activeren zijn niet direct beschikbaar. Pas deze waarde omhoog aan als dit script niet lijkt te werken. \n\n Vertraging in milliseconden:",
        config.hydrationTimer.value,
      );
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) {
        GM_setValue("hydrationTimer", parsed);
        config.hydrationTimer.value = parsed;
        updateMenu();
      }
    },
  );
}

/* ==========================================================================
   Styling - minimale CSS aanpassingen
   ========================================================================== */
function addCustomStyling() {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
  .dropdown-menu,
  twk-price-alert-popup,
  twk-product-collection-popup,
  .selectedProductsPopup,
  .lg-container.lg-show {
      z-index: 999999 !important;
  }

  .modal.slide-in[active] .modal__container {
      animation-delay: 0s !important;
      animation-duration: 0s!important;
  }

  .modal.slide-in .modal__body, .modal.slide-in .modal__footer, .modal.slide-in .modal__header {
      width: auto;
  }

  .modal.slide-in .modal__container {
      margin: auto !important;
      left: 0 !important;
      right: 0 !important;
  }

  div#slide-in-fixer-elements {
      display: flex;
  }
  `);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

/* ==========================================================================
   Utility functies
   ========================================================================== */

/**
 * Shenigans met moderne frameworks, document-idle is geen goede indicator dat we iets met de pagina kunnen doen.
 * Wacht op een specifiek element met een timeout.
 *
 * @param {string} selector
 * @param {number} [timeout=200] - (default 200ms).
 * @returns {Promise<Element|null>}
 */
function waitForElement(selector, timeout = 200) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }
    const observer = new MutationObserver((mutations) => {
      if (document.querySelector(selector)) {
        clearTimeout(timer);
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

/**
 * Wait functie voor gebruik in async context. `await wait(200)`
 * @param {number} ms
 * @returns {Promise<void>}
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ==========================================================================
   Functionele logica
   ========================================================================== */

/**
 * Hier scrollen we naar boven zodat de product header zichtbaar is en passen we de slide-in aan zodat deze er mooi onder past.
 * @returns {Promise<void>}
 */
async function adjustForProductHeader() {
  // Zorg dat de header mooi in beeld staat
  window.scrollTo(0, 0);
  // Ook hier wachten we weer even want moderne frameworks zijn een ding
  await waitForElement("twk-product-detail-page-slide-in", 1000);
  await wait(config.hydrationTimer.value);
  // Bepaal de hoogte van de product header en gebruik deze
  const headerEle = document.querySelector(".header-grid");
  const headerHeight = headerEle.offsetHeight;
  document.querySelector("twk-product-detail-page-slide-in").style.top =
    `${headerHeight}px`;

  // Verwijder inert attribute zodat we ook met de product header dingen kunnen doen.
  document
    .querySelectorAll("[inert]")
    .forEach((ele) => ele.removeAttribute("inert"));
}

/**
 * What's in a name?
 * @returns {boolean}
 */
function slideInIsOpen() {
  return location.hash.startsWith("#slide-in");
}

/**
 * Voeg custom tab container toe aan slide-in als deze nog niet bestaat.
 */
function addExtraTabsContainer() {
  if (state.slideInFixerExtraTabs) {
    return;
  }
  state.slideInFixerExtraTabs = document.createElement("div");
  state.slideInFixerExtraTabs.id = "slide-in-fixer-elements";
  document
    .querySelector("twk-product-detail-page-slide-in .modal__header")
    .append(state.slideInFixerExtraTabs);
}

/**
 * Voeg alle tabs toe die niet zichtbaar zijn in de slide-in.
 */
async function addMissingTabs() {
  if (state.alreadyAddedMissingTabs) {
    return;
  }
  state.alreadyAddedMissingTabs = true;
  await wait(config.hydrationTimer.value);
  const slideInTabsEle = document.querySelector(
    "twk-product-detail-page-slide-in .slide-in-section-tabs",
  );
  const tabsOutsideSlideInEle = document.querySelectorAll(
    '.sticky-nav-container a.btn-link[href|="#section"]',
  );

  tabsOutsideSlideInEle.forEach((element) => {
    const sectionName = element.getAttribute("href").split("-")[1];

    // Vraag en aanbod tab is altijd zichtbaar in het overzicht, deze negeren we.
    if (sectionName === "vraagaanbod") {
      return;
    }
    const slideInEquivalentEle = slideInTabsEle.querySelector(
      `button[data-target-section="${sectionName}"]`,
    );
    if (!slideInEquivalentEle) {
      addExtraTabsContainer();
      state.slideInFixerExtraTabs.append(element.cloneNode(true));
    }
  });
}

/* ==========================================================================
   Initalisatie
   ========================================================================== */
(async function init() {
  updateMenu();
  addCustomStyling();
  // Open de slide in automatisch als deze nog niet open is.
  if (config.alwaysOpenSlideIn.value && !slideInIsOpen()) {
    let slideInButtonEle = await waitForElement(
      `button.btn[data-modal="twk-product-detail-page-slide-in"][data-target-section="${config.defaultTab.value}"]`,
    );

    // De prijzen tab is ook niet altijd beschikbaar helaas.
    if (!slideInButtonEle && config.defaultTab.value === "prices") {
      slideInButtonEle = await waitForElement(
        'button.btn[data-modal="twk-product-detail-page-slide-in"][data-target-section="specifications"]',
      );
    }
    // Something something moderne frameworks.
    await wait(config.hydrationTimer.value);
    slideInButtonEle.click();
    addMissingTabs();
  }

  if (slideInIsOpen()) {
    addMissingTabs();
    if (config.showProductHeader.value) {
      adjustForProductHeader();
    }
  }

  // En nu moeten we nog alle momenten afhandelen waar de slidein nog niet open is.
  document.addEventListener("click", async (e) => {
    // Check if the clicked element OR any of its parents match the selector
    const slideInTargetButton = e.target.closest(
      '[data-modal="twk-product-detail-page-slide-in"]',
    );
    if (slideInTargetButton) {
      addMissingTabs();
      if (config.showProductHeader.value) {
        adjustForProductHeader();
      }
    }
  });
})();
