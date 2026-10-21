/* HanyaGo page shell: persistent theme, accessible mobile navigation, page loader, and contact messaging. */
(function () {
  "use strict";
  const root = document.documentElement;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.querySelector('link[rel~="icon"]')) {
    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/svg+xml";
    favicon.href = new URL("favicon.svg", window.location.href).href;
    document.head.appendChild(favicon);
  }
  const THEME_KEY = "hanyago-theme";
  // Official HanyaGo WhatsApp line must be entered as country-code digits only, e.g. 2348012345678.
  // Leave blank rather than directing passengers to an invented or unrelated number.
  const HANYAGO_WHATSAPP_NUMBER = String((window.HANYAGO_CONFIG && window.HANYAGO_CONFIG.whatsappNumber) || "").replace(/\D/g, "");
  // This is the contact email previously supplied for the project owner. Replace it if HanyaGo uses a dedicated support inbox.
  const HANYAGO_CONTACT_EMAIL = (window.HANYAGO_CONFIG && window.HANYAGO_CONFIG.supportEmail) || "";

  function applyTheme(theme, persist) {
    const selected = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", selected);
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      const icon = button.querySelector(".theme-toggle-icon");
      const label = button.querySelector(".theme-toggle-label");
      if (icon) icon.textContent = selected === "dark" ? "☀" : "☾";
      if (label) label.textContent = selected === "dark" ? "Light" : "Dark";
      button.setAttribute("aria-label", selected === "dark" ? "Switch to light theme" : "Switch to dark theme");
      button.setAttribute("title", selected === "dark" ? "Switch to light theme" : "Switch to dark theme");
      button.setAttribute("aria-pressed", String(selected === "dark"));
    });
    if (persist) {
      try { localStorage.setItem(THEME_KEY, selected); } catch (_) {}
    }
  }

  let storedTheme = "";
  try { storedTheme = localStorage.getItem(THEME_KEY) || ""; } catch (_) {}
  const initialTheme = storedTheme || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(initialTheme, false);

  if (!document.querySelector("[data-theme-toggle]")) {
    const themeButton = document.createElement("button");
    themeButton.type = "button";
    themeButton.className = "theme-toggle theme-toggle-floating";
    themeButton.setAttribute("data-theme-toggle", "");
    themeButton.innerHTML = '<span class="theme-toggle-icon" aria-hidden="true">☾</span><span class="theme-toggle-label">Dark</span>';
    themeButton.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:1100;";
    document.body.appendChild(themeButton);
    applyTheme(initialTheme, false);
  }

  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-theme-toggle]");
    if (!button) return;
    applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark", true);
  });

  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");

  // Keep the public navigation consistent across all public pages.
  // Admin consoles intentionally use their own restricted navigation and do not load this shell.
  if (navLinks) {
    const publicNavigation = [
      ["index.html", "Home", ""],
      ["intercity.html", "Intercity seats", ""],
      ["booking.html", "Local rides", ""],
      ["operators.html", "Operators", ""],
      ["safety-rules.html", "Safety", ""],
      ["contact.html", "Help", ""],
      ["account-dashboard.html", "My account", ""],
      ["intercity.html", "Find a seat →", "nav-cta"]
    ];    navLinks.innerHTML = publicNavigation.map(function (item) {
      return '<a href="' + item[0] + '" data-nav-item' + (item[2] ? ' class="' + item[2] + '"' : '') + '>' + item[1] + '</a>';
    }).join("");
    navLinks.setAttribute("aria-label", "Main navigation");
  }
  function closeMenu() {
    if (!menuToggle || !navLinks) return;
    navLinks.classList.remove("active");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
    menuToggle.textContent = "☰";
  }
  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", function () {
      const open = navLinks.classList.toggle("active");
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
      menuToggle.textContent = open ? "✕" : "☰";
    });
    navLinks.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });
    document.addEventListener("click", function (event) {
      if (!event.target.closest(".navbar")) closeMenu();
    });
  }

  const currentPath = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll("[data-nav-item]").forEach(function (link) {
    const targetPath = (new URL(link.href, window.location.href).pathname.split("/").pop() || "index.html").toLowerCase();
    if (targetPath === currentPath) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  // Lightweight branded loading transition. A hard timeout guarantees the overlay can never trap the user.
  const loader = document.createElement("div");
  loader.className = "page-loader is-visible";
  loader.setAttribute("role", "status");
  loader.setAttribute("aria-live", "polite");
  loader.setAttribute("aria-label", "Loading HanyaGo page");
  loader.innerHTML = '<div class="page-loader-card"><span class="page-loader-mark" aria-hidden="true">H</span><div class="page-loader-brand"><span>Hanya<span class="go">Go</span></span></div><span class="loader-track" aria-hidden="true"></span><p class="page-loader-caption">Preparing your journey</p></div>';
  document.body.appendChild(loader);
  let loaderHidden = false;
  const loaderStartedAt = Date.now();
  const loaderMinimumVisibleMs = reduceMotion ? 0 : 720;
  function hideLoader() {
    if (loaderHidden) return;
    loaderHidden = true;
    loader.classList.remove("is-visible");
    // Keep the hidden loader mounted so same-site navigation can reuse it.
  }
  window.addEventListener("load", function () {
    const remaining = Math.max(0, loaderMinimumVisibleMs - (Date.now() - loaderStartedAt));
    window.setTimeout(hideLoader, remaining);
  }, { once: true });
  // Fail safe: never leave the page covered if a remote asset or request hangs.
  window.setTimeout(hideLoader, 7000);
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) hideLoader();
  });


  document.addEventListener("click", function (event) {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;
    let destination;
    try { destination = new URL(link.href, window.location.href); } catch (_) { return; }
    if (destination.origin !== window.location.origin) return;
    if (!/\.html?$/i.test(destination.pathname)) return;
    if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
    if (destination.hash && destination.pathname === window.location.pathname && destination.search === window.location.search) return;
    event.preventDefault();
    loaderHidden = false;
    loader.classList.add("is-visible");
    window.setTimeout(function () { window.location.assign(destination.href); }, reduceMotion ? 0 : 140);
  });

  // Contact forms open a pre-filled email draft. No message is silently sent or stored by the static site.
  document.querySelectorAll("[data-contact-email]").forEach(function (node) {
    if (HANYAGO_CONTACT_EMAIL) {
      node.textContent = HANYAGO_CONTACT_EMAIL;
      if (node.tagName === "A") node.href = "mailto:" + HANYAGO_CONTACT_EMAIL;
    } else {
      node.textContent = "Support email not configured yet";
      if (node.tagName === "A") {
        node.href = "#contact-status";
        node.setAttribute("aria-disabled", "true");
      }
    }
  });
  const contactForm = document.querySelector("[data-contact-form]");
  const contactStatus = document.querySelector("[data-contact-status]");
  function setContactStatus(message, type) {
    if (!contactStatus) return;
    contactStatus.textContent = message;
    contactStatus.className = "contact-status show" + (type ? " " + type : "");
  }
  document.querySelectorAll('[data-contact-email][aria-disabled="true"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      setContactStatus("The official HanyaGo support email has not been configured yet. No message has been sent.", "error");
      if (contactStatus) contactStatus.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
    });
  });
  if (contactForm) {
    contactForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!contactForm.reportValidity()) return;
      if (!HANYAGO_CONTACT_EMAIL) {
        setContactStatus("The official HanyaGo support email has not been configured yet. Your message has not been sent or stored.", "error");
        return;
      }
      const name = contactForm.elements.namedItem("name").value.trim();
      const replyEmail = contactForm.elements.namedItem("email").value.trim();
      const topic = contactForm.elements.namedItem("topic").value;
      const message = contactForm.elements.namedItem("message").value.trim();
      const subject = encodeURIComponent("[HanyaGo website] " + topic);
      const body = encodeURIComponent("Name: " + name + "\nReply email: " + replyEmail + "\nTopic: " + topic + "\n\nMessage:\n" + message);
      setContactStatus("Opening your email app with the message prepared. Please review it and press Send in your email app. HanyaGo does not send or store this message from the website.", "success");
      window.location.href = "mailto:" + HANYAGO_CONTACT_EMAIL + "?subject=" + subject + "&body=" + body;
    });
  }
  document.querySelectorAll("[data-whatsapp-support]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      if (!/^\d{8,15}$/.test(HANYAGO_WHATSAPP_NUMBER)) {
        event.preventDefault();
        setContactStatus("The official HanyaGo WhatsApp number has not been configured yet. Please use the email option for now.", "error");
        if (contactStatus) contactStatus.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
        return;
      }
      const text = encodeURIComponent("Hello HanyaGo, I need help with a journey or booking.");
      link.href = "https://wa.me/" + HANYAGO_WHATSAPP_NUMBER + "?text=" + text;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
  });

  // Accessible back-to-top control, shown only after meaningful scrolling.
  const backToTop = document.createElement("button");
  backToTop.type = "button";
  backToTop.className = "hanyago-back-to-top";
  backToTop.setAttribute("aria-label", "Back to top");
  backToTop.setAttribute("title", "Back to top");
  backToTop.setAttribute("aria-hidden", "true");
  backToTop.tabIndex = -1;
  backToTop.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  document.body.appendChild(backToTop);
  function updateBackToTop() {
    const visible = window.scrollY > Math.max(300, window.innerHeight * 0.45);
    backToTop.classList.toggle("is-visible", visible);
    backToTop.setAttribute("aria-hidden", String(!visible));
    backToTop.tabIndex = visible ? 0 : -1;
  }
  window.addEventListener("scroll", updateBackToTop, { passive: true });
  window.addEventListener("resize", updateBackToTop, { passive: true });
  backToTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });
  updateBackToTop();

  // Floating support control uses only the project's configured official contact channels.
  const supportFab = document.createElement("a");
  supportFab.className = "hanyago-support-fab";
  supportFab.href = "contact.html";
  supportFab.setAttribute("aria-label", "Contact HanyaGo support");
  supportFab.innerHTML = '<span class="hanyago-support-icon" aria-hidden="true">?</span><span class="hanyago-support-label">Need help?</span>';
  document.body.appendChild(supportFab);

  // Session-aware logout action for the shared navigation.
  (async function addSessionMenuAction() {
    const nav = document.getElementById("navLinks");
    const cfg = window.HANYAGO_CONFIG;
    if (!nav || !window.supabase || !cfg || !cfg.supabaseUrl || !cfg.supabasePublishableKey) return;
    try {
      const client = window.__hanyagoSupabaseClient || window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      window.__hanyagoSupabaseClient = client;
      const { data } = await client.auth.getSession();
      if (!data || !data.session || nav.querySelector("[data-global-signout]")) return;
      const item = document.createElement("a");
      item.href = "#sign-out";
      item.textContent = "Log out";
      item.setAttribute("data-global-signout", "");
      item.setAttribute("role", "button");
      item.style.cssText = "color:#a32929;font-weight:800;";
      nav.appendChild(item);
      item.addEventListener("click", async function (event) {
        event.preventDefault();
        item.setAttribute("aria-disabled", "true");
        item.textContent = "Signing out…";
        const result = await client.auth.signOut({ scope: "local" });
        if (result.error) {
          item.textContent = "Log out failed";
          item.removeAttribute("aria-disabled");
          console.error("HanyaGo sign-out failed:", result.error);
          return;
        }
        window.location.assign("auth.html?message=signed-out");
      });
    } catch (error) {
      console.error("Could not initialise HanyaGo session menu:", error);
    }
  })();

})();
