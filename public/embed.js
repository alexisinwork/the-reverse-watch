/*!
 * The Reserve widgets — https://thereserve.watch/partners
 *
 *   <div data-reserve="quiz"></div>
 *   <script src="https://thereserve.watch/embed.js" data-key="pk_live_…" async></script>
 *
 * Features: quiz, archetype, find, alternatives, stories.
 * Optional attributes (on the script tag for every widget, or on one widget):
 *   data-scheme="light"  data-accent="#0a7cff"  data-bg="#ffffff"
 *   data-surface="#f5f5f5"  data-text="#111111"  data-font="system|serif"
 *   data-radius="8"  data-params="q=Daniel+Craig&type=actor"  data-height="640"
 * Or as an element: <the-reserve-widget feature="find" key="pk_live_…">
 *
 * Events (bubble from the widget's element): reserve:ready, reserve:resize,
 * reserve:navigate, reserve:results — event.detail holds the message.
 * For single-page sites: window.TheReserve.scan() after adding widgets.
 */
(function () {
  "use strict";

  if (window.TheReserve && window.TheReserve.version) {
    window.TheReserve.scan();
    return;
  }

  var FEATURES = ["quiz", "archetype", "find", "alternatives", "stories"];
  var THEME = {
    scheme: "scheme",
    accent: "accent",
    bg: "bg",
    background: "bg",
    surface: "surface",
    text: "text",
    font: "font",
    radius: "radius",
  };
  var TITLES = {
    quiz: "Watch finder by The Reserve",
    archetype: "Watch archetype quiz by The Reserve",
    find: "Watches from film and TV by The Reserve",
    alternatives: "Cheaper watch alternatives by The Reserve",
    stories: "Watches from movies by The Reserve",
  };

  var script =
    document.currentScript ||
    document.querySelector('script[src*="/embed.js"][data-key]') ||
    document.querySelector('script[src*="/embed.js"]');
  var base = new URL(script ? script.src : "https://thereserve.watch/embed.js")
    .origin;
  var frames = [];

  function attr(el, name) {
    var value = el.getAttribute("data-" + name);
    if (value === null && el.tagName.toLowerCase() === "the-reserve-widget")
      value = el.getAttribute(name);
    return value === null ? null : String(value).trim();
  }

  function setting(el, name) {
    var own = attr(el, name);
    return own !== null ? own : script ? attr(script, name) : null;
  }

  function widgetUrl(el, feature, key) {
    var params = new URLSearchParams(setting(el, "params") || "");
    Object.keys(THEME).forEach(function (name) {
      var value = setting(el, name);
      if (value) params.set(THEME[name], value.replace(/^#/, ""));
    });
    var query = params.toString();
    return (
      base +
      "/embed/" +
      encodeURIComponent(key) +
      "/" +
      feature +
      (query ? "?" + query : "")
    );
  }

  function warn(el, message) {
    if (window.console) console.warn("[The Reserve] " + message, el);
  }

  function mount(el, options) {
    if (!el || el.__theReserve) return null;
    options = options || {};
    var feature = options.feature || attr(el, "reserve") || attr(el, "feature");
    var key = options.key || setting(el, "key");
    if (FEATURES.indexOf(feature) === -1) {
      warn(
        el,
        'Unknown feature "' + feature + '". Use ' + FEATURES.join(", ") + ".",
      );
      return null;
    }
    if (!key) {
      warn(el, 'Add your public key: data-key="pk_live_…".');
      return null;
    }
    var iframe = document.createElement("iframe");
    iframe.src = widgetUrl(el, feature, key);
    iframe.title = TITLES[feature];
    iframe.loading = "lazy";
    iframe.setAttribute("allow", "clipboard-write");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    iframe.style.cssText =
      "display:block;width:100%;border:0;overflow:hidden;color-scheme:normal;" +
      "height:" +
      (parseInt(setting(el, "height"), 10) || 640) +
      "px";
    el.__theReserve = { iframe: iframe, feature: feature };
    el.innerHTML = "";
    el.appendChild(iframe);
    frames.push({ el: el, iframe: iframe });
    return iframe;
  }

  function scan(root) {
    var found = (root || document).querySelectorAll("[data-reserve]");
    for (var i = 0; i < found.length; i++) mount(found[i]);
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== base) return;
    var data = event.data;
    if (
      !data ||
      typeof data.type !== "string" ||
      data.type.indexOf("reserve:") !== 0
    )
      return;
    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i];
      if (frame.iframe.contentWindow !== event.source) continue;
      if (typeof data.height === "number" && data.height > 0) {
        frame.iframe.style.height = Math.ceil(data.height) + "px";
      }
      if (data.type === "reserve:navigate") {
        // A new step inside the widget: bring its top into view.
        var top = frame.iframe.getBoundingClientRect().top;
        if (top < 0) frame.iframe.scrollIntoView({ block: "start" });
      }
      frame.el.dispatchEvent(
        new CustomEvent(data.type, { bubbles: true, detail: data }),
      );
    }
  });

  if (
    window.customElements &&
    !window.customElements.get("the-reserve-widget")
  ) {
    window.customElements.define(
      "the-reserve-widget",
      class extends HTMLElement {
        connectedCallback() {
          this.style.display = "block";
          mount(this);
        }
      },
    );
  }

  window.TheReserve = { version: "1.0.0", mount: mount, scan: scan };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      scan();
    });
  } else {
    scan();
  }
})();
