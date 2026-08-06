/* global window */
(function (global) {
  "use strict";

  function decodeXmlEntities(text) {
    return String(text)
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, function (_m, n) {
        return String.fromCharCode(Number(n));
      })
      .replace(/&#x([0-9a-fA-F]+);/g, function (_m, h) {
        return String.fromCharCode(parseInt(h, 16));
      })
      .replace(/&amp;/g, "&");
  }

  function encodeXmlEntitiesPreserveTags(text) {
    return String(text).replace(/&(?!(amp|lt|gt|apos|quot|#\d+|#x[0-9a-fA-F]+);)/gi, "&amp;");
  }

  function decodeAndroidEscapes(text) {
    var out = "";
    var i = 0;
    var s = String(text);
    while (i < s.length) {
      if (s.charAt(i) === "\\" && i + 1 < s.length) {
        var next = s.charAt(i + 1);
        if (next === "n") {
          out += "\n";
          i += 2;
          continue;
        }
        if (next === "t") {
          out += "\t";
          i += 2;
          continue;
        }
        if (next === "'" || next === '"' || next === "\\" || next === "@" || next === "?") {
          out += next;
          i += 2;
          continue;
        }
        if (next === "u" && i + 5 < s.length) {
          var hex = s.slice(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            out += String.fromCharCode(parseInt(hex, 16));
            i += 6;
            continue;
          }
        }
      }
      out += s.charAt(i);
      i += 1;
    }
    return out;
  }

  function encodeAndroidEscapes(text) {
    return String(text)
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t")
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');
  }

  function decodeAndroidValue(rawInner) {
    return decodeAndroidEscapes(decodeXmlEntities(rawInner));
  }

  function encodeAndroidValue(decoded) {
    return encodeXmlEntitiesPreserveTags(encodeAndroidEscapes(decoded));
  }

  function decodeIosEscapes(text) {
    var out = "";
    var i = 0;
    var s = String(text);
    while (i < s.length) {
      if (s.charAt(i) === "\\" && i + 1 < s.length) {
        var next = s.charAt(i + 1);
        if (next === "n") {
          out += "\n";
          i += 2;
          continue;
        }
        if (next === "t") {
          out += "\t";
          i += 2;
          continue;
        }
        if (next === "r") {
          out += "\r";
          i += 2;
          continue;
        }
        if (next === '"' || next === "\\") {
          out += next;
          i += 2;
          continue;
        }
        if (next === "U" && i + 5 < s.length) {
          var hex4 = s.slice(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex4)) {
            out += String.fromCharCode(parseInt(hex4, 16));
            i += 6;
            continue;
          }
        }
      }
      out += s.charAt(i);
      i += 1;
    }
    return out;
  }

  function encodeIosEscapes(text) {
    return String(text)
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t")
      .replace(/"/g, '\\"');
  }

  global.StringI18nUnescape = {
    decodeXmlEntities: decodeXmlEntities,
    encodeXmlEntitiesPreserveTags: encodeXmlEntitiesPreserveTags,
    decodeAndroidValue: decodeAndroidValue,
    encodeAndroidValue: encodeAndroidValue,
    decodeIosEscapes: decodeIosEscapes,
    encodeIosEscapes: encodeIosEscapes
  };
})(window);
