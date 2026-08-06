/* global window, StringI18nUnescape */
(function (global) {
  "use strict";

  /**
   * Parse iOS .strings files: "key" = "value";
   * Skips // and /* * / comments for entry discovery; offsets refer to original text.
   */
  function parseIosStrings(rawText, fileId) {
    var text = String(rawText);
    var entries = [];
    var warnings = [];
    var seenKeys = {};
    var order = 0;
    var i = 0;
    var len = text.length;

    function skipWhitespaceAndComments() {
      while (i < len) {
        var ch = text.charAt(i);
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
          i += 1;
          continue;
        }
        if (ch === "/" && text.charAt(i + 1) === "/") {
          i += 2;
          while (i < len && text.charAt(i) !== "\n") {
            i += 1;
          }
          continue;
        }
        if (ch === "/" && text.charAt(i + 1) === "*") {
          i += 2;
          while (i + 1 < len && !(text.charAt(i) === "*" && text.charAt(i + 1) === "/")) {
            i += 1;
          }
          i += 2;
          continue;
        }
        break;
      }
    }

    function readQuotedString() {
      if (text.charAt(i) !== '"') {
        return null;
      }
      i += 1;
      var startContent = i;
      var raw = "";
      while (i < len) {
        var ch = text.charAt(i);
        if (ch === "\\") {
          raw += ch;
          if (i + 1 < len) {
            raw += text.charAt(i + 1);
            i += 2;
            continue;
          }
          i += 1;
          continue;
        }
        if (ch === '"') {
          var endContent = i;
          i += 1;
          return {
            raw: raw,
            valueStart: startContent,
            valueEnd: endContent
          };
        }
        raw += ch;
        i += 1;
      }
      return null;
    }

    while (i < len) {
      skipWhitespaceAndComments();
      if (i >= len) {
        break;
      }
      var keyPart = readQuotedString();
      if (!keyPart) {
        warnings.push("unexpected token near offset " + i);
        break;
      }
      skipWhitespaceAndComments();
      if (text.charAt(i) !== "=") {
        warnings.push("expected = after key near offset " + i);
        break;
      }
      i += 1;
      skipWhitespaceAndComments();
      var valuePart = readQuotedString();
      if (!valuePart) {
        warnings.push("expected value string near offset " + i);
        break;
      }
      skipWhitespaceAndComments();
      if (text.charAt(i) === ";") {
        i += 1;
      } else {
        warnings.push("missing ; after value near offset " + i);
      }

      var key = StringI18nUnescape.decodeIosEscapes(keyPart.raw);
      var decodedValue = StringI18nUnescape.decodeIosEscapes(valuePart.raw);
      if (seenKeys[key] !== undefined) {
        warnings.push("duplicate key in file: " + key);
      }
      seenKeys[key] = order;

      entries.push({
        platform: "ios",
        fileId: fileId,
        key: key,
        rawValue: valuePart.raw,
        decodedValue: decodedValue,
        entryType: "string",
        pluralQuantity: null,
        arrayIndex: null,
        order: order,
        valueStart: valuePart.valueStart,
        valueEnd: valuePart.valueEnd,
        attributes: {
          translatable: true,
          formatted: true,
          toolsIgnore: null
        },
        skipReason: null
      });
      order += 1;
    }

    return {
      platform: "ios",
      fileId: fileId,
      entries: entries,
      warnings: warnings
    };
  }

  function rewriteIosStrings(rawText, replacements) {
    var text = String(rawText);
    var list = (replacements || []).slice().sort(function (a, b) {
      return b.valueStart - a.valueStart;
    });
    var i;
    for (i = 0; i < list.length; i += 1) {
      var r = list[i];
      text = text.slice(0, r.valueStart) + r.newRawValue + text.slice(r.valueEnd);
    }
    return text;
  }

  global.StringI18nIosStrings = {
    parseIosStrings: parseIosStrings,
    rewriteIosStrings: rewriteIosStrings
  };
})(window);
