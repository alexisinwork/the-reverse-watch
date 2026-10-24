(function () {
  "use strict";
  var config = window.RESERVE_DEMO_CONFIG || {};
  var status = document.getElementById("status");
  var retry = document.getElementById("retry");
  var widgets = document.getElementById("widgets");
  var buttons = Array.from(document.querySelectorAll("[data-feature]"));
  var panels = new Map();
  var active = "quiz";

  function message(text, canRetry) {
    status.textContent = text;
    retry.hidden = !canRetry;
  }
  retry.addEventListener("click", function () {
    window.location.reload();
  });

  if (!/^pk_live_[A-Za-z0-9]{24}$/.test(config.publicKey || "")) {
    message(
      "Setup required: add your public partner key to config.js, then reload this page.",
      false,
    );
    return;
  }
  var origin;
  try {
    var url = new URL(config.origin);
    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && url.hostname === "localhost")
    )
      throw new Error("Invalid origin");
    origin = url.origin;
  } catch {
    message(
      "Setup required: use an HTTPS Reserve origin in config.js (HTTP localhost is allowed for development).",
      false,
    );
    return;
  }
  if (window.location.protocol === "file:") {
    message(
      "Serve this folder over HTTP or HTTPS. Local file previews cannot use a registered website origin.",
      false,
    );
    return;
  }

  function show(feature) {
    active = feature;
    buttons.forEach(function (button) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.feature === feature),
      );
    });
    panels.forEach(function (panel, name) {
      panel.element.hidden = name !== feature;
    });
    var panel = panels.get(feature);
    if (!panel) {
      var element = document.createElement("div");
      element.setAttribute("data-reserve", feature);
      element.setAttribute("data-key", config.publicKey);
      element.setAttribute("data-height", "720");
      panel = { element: element, ready: false, timedOut: false };
      panels.set(feature, panel);
      var current = panel;
      var timer = window.setTimeout(function () {
        current.timedOut = true;
        if (active === feature)
          message(
            "The advisor has not confirmed it is ready. Check the registered domain, public key, connection and content security policy, then reload.",
            true,
          );
      }, 20000);
      element.addEventListener("reserve:ready", function () {
        window.clearTimeout(timer);
        current.ready = true;
        if (active === feature) message("Watch advisor ready.", false);
      });
      widgets.appendChild(element);
      window.TheReserve.scan(widgets);
    }
    message(
      panel.ready
        ? "Watch advisor ready."
        : panel.timedOut
          ? "The advisor has not confirmed it is ready. Check your domain, key and connection, then reload."
          : "Loading the watch advisor…",
      panel.timedOut && !panel.ready,
    );
  }

  var script = document.createElement("script");
  script.src = origin + "/embed.js";
  script.setAttribute("data-key", config.publicKey);
  script.async = true;
  var loadTimer = window.setTimeout(function () {
    message(
      "The widget script is taking too long to load. Check your connection and content security policy.",
      true,
    );
  }, 20000);
  script.onerror = function () {
    window.clearTimeout(loadTimer);
    message(
      "The widget script could not load. Check your connection and content security policy.",
      true,
    );
  };
  script.onload = function () {
    window.clearTimeout(loadTimer);
    if (!window.TheReserve || typeof window.TheReserve.scan !== "function") {
      message(
        "The widget loader is unavailable. Reload the page to try again.",
        true,
      );
      return;
    }
    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        show(button.dataset.feature);
      });
    });
    show(active);
  };
  message("Loading the watch advisor…", false);
  document.head.appendChild(script);
})();
