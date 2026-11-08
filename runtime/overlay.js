// Shared overlay typography and local clock. No renderer or audio ownership.
// CommonJS exports the factory for tests; classic browser scripts install the API.
(function (createOverlay) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = createOverlay;
    return;
  }
  window.StreamOverlay = createOverlay(window, document);
})(function createOverlay(window, document) {
  "use strict";

  // Keep the original functions unchanged while making clock dependencies testable.
  var Date = window.Date;
  function setInterval(callback, delay) { return window.setInterval(callback, delay); }
  function clearInterval(timer) { window.clearInterval(timer); }

  function startDateTimeTicker(element) {
    if (!element) {
      return function () {};
    }

    var formatDateTime = createDateTimeFormatter();

    function updateDateTime() {
      element.textContent = formatDateTime(new Date());
    }

    updateDateTime();
    var timer = setInterval(updateDateTime, 1000);

    return function stopTicker() {
      if (!timer) {
        return;
      }
      clearInterval(timer);
      timer = 0;
    };
  }


  function createDateTimeFormatter() {
    var dateTimeFormatter = null;
    var timeZoneFormatter = null;

    if (window.Intl && typeof window.Intl.DateTimeFormat === "function") {
      try {
        dateTimeFormatter = new window.Intl.DateTimeFormat(undefined, {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit"
        });
      } catch (error) {
        dateTimeFormatter = null;
      }

      try {
        timeZoneFormatter = new window.Intl.DateTimeFormat(undefined, {
          timeZoneName: "short"
        });
      } catch (error) {
        timeZoneFormatter = null;
      }
    }

    return function formatDateTime(dateValue) {
      var date = dateValue instanceof Date ? dateValue : new Date(dateValue);
      var dateText = dateTimeFormatter ? dateTimeFormatter.format(date) : date.toLocaleString();
      var timeZoneText = extractTimeZoneLabel(timeZoneFormatter, date) || fallbackTimeZoneLabel(date);
      return dateText + " " + timeZoneText;
    };
  }


  function extractTimeZoneLabel(formatter, date) {
    if (!formatter || typeof formatter.formatToParts !== "function") {
      return "";
    }

    try {
      var parts = formatter.formatToParts(date);
      for (var i = 0; i < parts.length; i += 1) {
        if (parts[i] && parts[i].type === "timeZoneName" && parts[i].value) {
          return parts[i].value;
        }
      }
    } catch (error) {
      return "";
    }

    return "";
  }


  function fallbackTimeZoneLabel(date) {
    var offsetMinutes = -date.getTimezoneOffset();
    var sign = offsetMinutes >= 0 ? "+" : "-";
    var absMinutes = Math.abs(offsetMinutes);
    var hours = Math.floor(absMinutes / 60);
    var minutes = absMinutes % 60;
    return "UTC" + sign + pad2(hours) + ":" + pad2(minutes);
  }


  function pad2(value) {
    return value < 10 ? "0" + value : String(value);
  }


  function applyOverlayTypography(overlayConfig) {
    if (!overlayConfig) {
      return;
    }

    var root = document.documentElement;
    if (root) {
      setRootCssVariable(root, "--font-title", overlayConfig.titleFontFamily);
      setRootCssVariable(root, "--font-subtitle", overlayConfig.subtitleFontFamily);
      setRootCssVariable(root, "--title-weight", overlayConfig.titleFontWeight);
      setRootCssVariable(root, "--subtitle-weight", overlayConfig.subtitleFontWeight);
      setRootCssVariable(root, "--title-transform", overlayConfig.titleTextTransform);
      setRootCssVariable(root, "--subtitle-transform", overlayConfig.subtitleTextTransform);
      setRootCssVariable(root, "--overlay-top", overlayConfig.overlayTop, "px");
      setRootCssVariable(root, "--overlay-top-mobile", overlayConfig.overlayTopMobile, "px");
      setRootCssVariable(root, "--title-offset-x", overlayConfig.titleOffsetX, "px");
      setRootCssVariable(root, "--title-offset-y", overlayConfig.titleOffsetY, "px");
      setRootCssVariable(root, "--subtitle-offset-x", overlayConfig.subtitleOffsetX, "px");
      setRootCssVariable(root, "--subtitle-offset-y", overlayConfig.subtitleOffsetY, "px");
      setRootCssVariable(root, "--title-kerning", overlayConfig.titleKerning, "em");
      setRootCssVariable(root, "--subtitle-kerning", overlayConfig.subtitleKerning, "em");
    }

    var head = document.head;
    if (!head) {
      return;
    }

    var stylesheetUrls = ensureArray(overlayConfig.externalFontStylesheets);
    for (var i = 0; i < stylesheetUrls.length; i += 1) {
      var href = stylesheetUrls[i];
      if (typeof href !== "string") {
        continue;
      }

      var trimmedHref = href.trim();
      if (!trimmedHref) {
        continue;
      }

      var stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = trimmedHref;
      head.appendChild(stylesheet);
    }

    var customFaces = ensureArray(overlayConfig.customFontFaces);
    var faceRules = [];
    for (var f = 0; f < customFaces.length; f += 1) {
      var face = customFaces[f];
      if (!face || typeof face !== "object") {
        continue;
      }

      var family = typeof face.family === "string" ? face.family.trim() : "";
      var src = normalizeFontSource(face.src);
      if (!family || !src) {
        continue;
      }

      var style = pickDefined(face.style, "normal");
      var weight = pickDefined(face.weight, "400");
      var display = pickDefined(face.display, "swap");

      faceRules.push(
        "@font-face{" +
          "font-family:'" + escapeCssText(family) + "';" +
          "src:" + src + ";" +
          "font-style:" + style + ";" +
          "font-weight:" + weight + ";" +
          "font-display:" + display + ";" +
        "}"
      );
    }

    if (faceRules.length > 0) {
      var faceStyleTag = document.createElement("style");
      faceStyleTag.type = "text/css";
      faceStyleTag.textContent = faceRules.join("\n");
      head.appendChild(faceStyleTag);
    }
  }


  function setRootCssVariable(root, variableName, rawValue, defaultUnit) {
    if (!root || !variableName) {
      return;
    }

    var cssValue = normalizeCssValue(rawValue, defaultUnit);
    if (!cssValue) {
      return;
    }

    root.style.setProperty(variableName, cssValue);
  }


  function normalizeCssValue(value, defaultUnit) {
    if (value === undefined || value === null) {
      return "";
    }

    if (typeof value === "number") {
      if (!isFinite(value)) {
        return "";
      }
      return String(value) + (defaultUnit || "");
    }

    if (typeof value === "string") {
      var trimmedValue = value.trim();
      return trimmedValue || "";
    }

    return "";
  }


  function normalizeFontSource(srcValue) {
    if (typeof srcValue !== "string") {
      return "";
    }

    var trimmed = srcValue.trim();
    if (!trimmed) {
      return "";
    }

    if (/^url\(/i.test(trimmed)) {
      return trimmed;
    }

    if (trimmed.charAt(0) === "@") {
      trimmed = trimmed.slice(1).trim();
    }

    if (!trimmed) {
      return "";
    }

    var format = guessFontFormat(trimmed);
    var src = "url('" + escapeCssText(trimmed.replace(/\\/g, "/")) + "')";
    if (format) {
      src += " format('" + format + "')";
    }
    return src;
  }


  function guessFontFormat(path) {
    if (typeof path !== "string") {
      return "";
    }

    var plainPath = path.split("?")[0].split("#")[0].toLowerCase();
    var extensionIndex = plainPath.lastIndexOf(".");
    if (extensionIndex < 0) {
      return "";
    }

    var extension = plainPath.slice(extensionIndex + 1);
    if (extension === "woff2") {
      return "woff2";
    }
    if (extension === "woff") {
      return "woff";
    }
    if (extension === "ttf") {
      return "truetype";
    }
    if (extension === "otf") {
      return "opentype";
    }
    return "";
  }


  function escapeCssText(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }


  function pickDefined(value, fallback) {
    return value === undefined || value === null ? fallback : value;
  }


  function ensureArray(value) {
    if (Array.isArray(value)) {
      return value.slice();
    }
    if (value === undefined || value === null || value === "") {
      return [];
    }
    return [value];
  }


  return { applyTypography: applyOverlayTypography, startClock: startDateTimeTicker };
});
