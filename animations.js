/* HanyaGo motion system: lightweight, accessible, and dependency-free. */
(function () {
  "use strict";
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // If JavaScript is running, enable reveal styles; content stays visible without JS.
  root.classList.add("js-motion");

  const progress = document.createElement("div");
  progress.className = "scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  progress.innerHTML = '<span class="scroll-progress-bar"></span>';
  document.body.prepend(progress);
  const progressBar = progress.querySelector(".scroll-progress-bar");
  const header = document.querySelector("header");
  let ticking = false;

  function updateScrollUI() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const amount = scrollable > 0 ? window.scrollY / scrollable : 0;
    progressBar.style.transform = "scaleX(" + Math.min(1, Math.max(0, amount)) + ")";
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
    ticking = false;
  }

  window.addEventListener("scroll", function () {
    if (!ticking) {
      window.requestAnimationFrame(updateScrollUI);
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener("resize", updateScrollUI, { passive: true });
  updateScrollUI();

  const revealTargets = [
    ".hero-content > *",
    ".trip-visual",
    ".booking-box",
    ".section-heading",
    ".ride-card",
    ".step",
    ".cta-box",
    ".faq-item",
    ".footer-grid > *"
  ];
  const seen = new Set();
  document.querySelectorAll(revealTargets.join(",")).forEach(function (element) {
    if (seen.has(element)) return;
    seen.add(element);
    element.setAttribute("data-reveal", "up");
  });

  // Small stagger makes groups feel deliberate rather than all popping at once.
  document.querySelectorAll(".hero-content > *, .ride-card, .step, .faq-item").forEach(function (element, index) {
    element.style.setProperty("--reveal-delay", (index % 4) * 75 + "ms");
  });

  if (reduceMotion || !("IntersectionObserver" in window)) {
    document.querySelectorAll("[data-reveal]").forEach(function (element) {
      element.classList.add("is-visible");
    });
    return;
  }

  const observer = new IntersectionObserver(function (entries, currentObserver) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: "0px 0px -45px 0px"
  });

  document.querySelectorAll("[data-reveal]").forEach(function (element) {
    observer.observe(element);
  });
})();
