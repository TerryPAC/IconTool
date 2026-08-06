/* global window, StringI18nUnescape */
(function (global) {
  "use strict";

  function parseAttributes(attrText) {
    var attrs = {
      name: null,
      translatable: true,
      formatted: true,
      toolsIgnore: null
    };
    var nameMatch = attrText.match(/\bname\s*=\s*"([^"]+)"/);
    if (nameMatch) {
      attrs.name = nameMatch[1];
    }
    var transMatch = attrText.match(/\btranslatable\s*=\s*"([^"]+)"/);
    if (transMatch) {
      attrs.translatable = String(transMatch[1]).toLowerCase() !== "false";
    }
    var formattedMatch = attrText.match(/\bformatted\s*=\s*"([^"]+)"/);
    if (formattedMatch) {
      attrs.formatted = String(formattedMatch[1]).toLowerCase() !== "false";
    }
    var toolsIgnore = attrText.match(/\btools:ignore\s*=\s*"([^"]+)"/);
    if (toolsIgnore) {
      attrs.toolsIgnore = toolsIgnore[1];
    }
    return attrs;
  }

  /**
   * Parse Android resource XML for <string> entries.
   * Tracks valueStart/valueEnd for in-place rewrite.
   */
  function parseAndroidXml(rawText, fileId) {
    var text = String(rawText);
    var entries = [];
    var warnings = [];
    var seenKeys = {};
    var order = 0;
    var re = /<string\b([^>]*?)(?:\/>|>([\s\S]*?)<\/string\s*>)/g;
    var match;

    while ((match = re.exec(text)) !== null) {
      var attrText = match[1] || "";
      var attrs = parseAttributes(attrText);
      if (!attrs.name) {
        warnings.push("string without name near offset " + match.index);
        continue;
      }
      var isSelfClosing = match[0].charAt(match[0].length - 2) === "/" || match[2] === undefined;
      var rawValue = isSelfClosing ? "" : match[2];
      var openEnd = match.index + match[0].indexOf(">") + 1;
      var valueStart;
      var valueEnd;
      if (isSelfClosing) {
        valueStart = match.index;
        valueEnd = match.index;
        rawValue = "";
      } else {
        valueStart = openEnd;
        valueEnd = valueStart + rawValue.length;
      }

      if (seenKeys[attrs.name] !== undefined) {
        warnings.push("duplicate key in file: " + attrs.name);
      }
      seenKeys[attrs.name] = order;

      var decodedValue = StringI18nUnescape.decodeAndroidValue(rawValue);
      entries.push({
        platform: "android",
        fileId: fileId,
        key: attrs.name,
        rawValue: rawValue,
        decodedValue: decodedValue,
        entryType: "string",
        pluralQuantity: null,
        arrayIndex: null,
        order: order,
        valueStart: valueStart,
        valueEnd: valueEnd,
        attributes: {
          translatable: attrs.translatable,
          formatted: attrs.formatted,
          toolsIgnore: attrs.toolsIgnore
        },
        skipReason: null
      });
      order += 1;
    }

    return {
      platform: "android",
      fileId: fileId,
      entries: entries,
      warnings: warnings
    };
  }

  function rewriteAndroidXml(rawText, replacements) {
    // replacements: [{valueStart, valueEnd, newRawValue}] sorted by start desc
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

  global.StringI18nAndroidXml = {
    parseAndroidXml: parseAndroidXml,
    rewriteAndroidXml: rewriteAndroidXml,
    parseAttributes: parseAttributes
  };
})(window);
