// ==UserScript==
// @name          T.net pricewatch slide-in alternatief
// @match         https://tweakers.net/pricewatch/*/*.html
// @version       1.1
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

// Instellingen, NIET hier aanpassen. Kan vanuit het GreaseMonkey/ViolentMonkey/etc menu
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
updateMenu();

// Minimale CSS aanpassingen
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
`);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

// Shenigans met moderne frameworks, document-idle is geen goede indicator.
function waitForElement(selector) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }
    const observer = new MutationObserver((mutations) => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function adjustForProductHeader() {
  // Zorg dat de header mooi in beeld staat
  window.scrollTo(0, 0);
  // Ook hier wachten we weer even want moderne frameworks zijn een ding
  await waitForElement("twk-product-detail-page-slide-in");
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

function slideInIsOpen() {
  return location.hash.startsWith("#slide-in");
}

(async function () {
  // Open de slide in automatisch als deze nog niet open is.
  if (config.alwaysOpenSlideIn.value && !slideInIsOpen()) {
    const slideInButtonEle = await waitForElement(
      `button.btn[data-modal="twk-product-detail-page-slide-in"][data-target-section="${config.defaultTab.value}"]`,
    );
    // Something something moderne frameworks.
    await wait(config.hydrationTimer.value);
    slideInButtonEle.click();
  }

  if (config.showProductHeader.value) {
    // Easy mode
    if (slideInIsOpen()) {
      adjustForProductHeader();
    }
    // En nu moeten we nog alle momenten afhandelen waar de slidein nog niet open is.
    document.addEventListener("click", async (e) => {
      // Check if the clicked element OR any of its parents match the selector
      const slideInTargetButton = e.target.closest(
        '[data-modal="twk-product-detail-page-slide-in"]',
      );
      if (slideInTargetButton) {
        adjustForProductHeader();
      }
    });
  }
})();
