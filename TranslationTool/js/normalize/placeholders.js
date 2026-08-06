/* global window */
(function (global) {
  "use strict";

  /**
   * Placeholder patterns (left-to-right). %% is literal and kept as %%.
   * formatted=false: no % format scanning.
   */
  var NAMED_BRACE_RE = /^\{\{[^{}]+\}\}/;
  var INDEX_BRACE_RE = /^\{[0-9]+\}/;
  // positional or conversion: %1$s, %2$@, %@, %s, %d, %ld, %f, %i, %u, etc.
  var FORMAT_RE = /^%(?:[1-9]\d*\$)?(?:ll[ud]|l[ud]|@|[a-zA-Z])/;

  function normalizePlaceholders(text, options) {
    var formatted = !options || options.formatted !== false;
    var s = String(text);
    var patterns = [];
    var tokens = [];
    var out = "";
    var i = 0;

    while (i < s.length) {
      if (s.charAt(i) === "%" && s.charAt(i + 1) === "%") {
        out += "%%";
        i += 2;
        continue;
      }

      var rest = s.slice(i);
      var named = rest.match(NAMED_BRACE_RE);
      if (named) {
        var tokNamed = "{{PH_" + patterns.length + "}}";
        patterns.push(named[0]);
        tokens.push(tokNamed);
        out += tokNamed;
        i += named[0].length;
        continue;
      }

      var indexed = rest.match(INDEX_BRACE_RE);
      if (indexed) {
        var tokIdx = "{{PH_" + patterns.length + "}}";
        patterns.push(indexed[0]);
        tokens.push(tokIdx);
        out += tokIdx;
        i += indexed[0].length;
        continue;
      }

      if (formatted) {
        var fmt = rest.match(FORMAT_RE);
        if (fmt) {
          var tokFmt = "{{PH_" + patterns.length + "}}";
          patterns.push(fmt[0]);
          tokens.push(tokFmt);
          out += tokFmt;
          i += fmt[0].length;
          continue;
        }
      }

      out += s.charAt(i);
      i += 1;
    }

    return {
      normalized: out,
      placeholderPattern: patterns,
      normalizeTokens: tokens
    };
  }

  function restorePlaceholders(translatedNormalized, placeholderPattern, normalizeTokens) {
    var text = String(translatedNormalized);
    var patterns = placeholderPattern || [];
    var tokens = normalizeTokens || [];
    var i;
    for (i = 0; i < tokens.length; i += 1) {
      var token = tokens[i];
      var replacement = patterns[i];
      if (replacement === undefined) {
        throw new Error("Missing placeholderPattern for token " + token);
      }
      if (text.indexOf(token) === -1) {
        throw new Error("Translation missing placeholder token " + token);
      }
      text = text.split(token).join(replacement);
    }
    // leftover {{PH_n}} means extra/unknown
    if (/\{\{PH_\d+\}\}/.test(text)) {
      throw new Error("Translation contains unexpected placeholder tokens");
    }
    return text;
  }

  function extractPhTokens(text) {
    var re = /\{\{PH_(\d+)\}\}/g;
    var found = [];
    var m;
    while ((m = re.exec(String(text))) !== null) {
      found.push(m[0]);
    }
    return found;
  }

  function validatePlaceholderParity(sourceNormalized, translation) {
    var srcTokens = extractPhTokens(sourceNormalized);
    var dstTokens = extractPhTokens(translation);
    if (srcTokens.length !== dstTokens.length) {
      return {
        ok: false,
        message: "Placeholder count mismatch: source=" + srcTokens.length + " translation=" + dstTokens.length
      };
    }
    var i;
    for (i = 0; i < srcTokens.length; i += 1) {
      if (srcTokens[i] !== dstTokens[i]) {
        return {
          ok: false,
          message: "Placeholder order/content mismatch at index " + i
        };
      }
    }
    return { ok: true, message: "" };
  }

  global.StringI18nPlaceholders = {
    normalizePlaceholders: normalizePlaceholders,
    restorePlaceholders: restorePlaceholders,
    validatePlaceholderParity: validatePlaceholderParity,
    extractPhTokens: extractPhTokens
  };
})(window);
