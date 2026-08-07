/* global window */
(function (global) {
  "use strict";

  /**
   * Placeholder patterns (left-to-right). %% is literal and kept as %%.
   * formatted=false: no % format scanning.
   * Non-trivial whitespace / control runs become {{WS_n}} so Android/iOS can
   * merge when only special characters differ; originals are restored per
   * mapping entry. A single ASCII space is left as-is for translation quality.
   */
  var NAMED_BRACE_RE = /^\{\{[^{}]+\}\}/;
  var INDEX_BRACE_RE = /^\{[0-9]+\}/;
  // positional or conversion: %1$s, %2$@, %@, %s, %d, %ld, %f, %i, %u, etc.
  var FORMAT_RE = /^%(?:[1-9]\d*\$)?(?:ll[ud]|l[ud]|@|[a-zA-Z])/;
  // Space, tab, LF, CR, other C0 controls, DEL, and Unicode whitespace (\s).
  var SPECIAL_CHAR_RE = /^[\s\x00-\x1F\x7F]+/;

  function isSingleAsciiSpace(run) {
    return run.length === 1 && run === " ";
  }

  function normalizePlaceholders(text, options) {
    var formatted = !options || options.formatted !== false;
    var s = String(text);
    var patterns = [];
    var tokens = [];
    var whitespacePattern = [];
    var whitespaceTokens = [];
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

      var special = rest.match(SPECIAL_CHAR_RE);
      if (special) {
        if (isSingleAsciiSpace(special[0])) {
          out += " ";
          i += 1;
          continue;
        }
        var tokWs = "{{WS_" + whitespacePattern.length + "}}";
        whitespacePattern.push(special[0]);
        whitespaceTokens.push(tokWs);
        out += tokWs;
        i += special[0].length;
        continue;
      }

      out += s.charAt(i);
      i += 1;
    }

    return {
      normalized: out,
      placeholderPattern: patterns,
      normalizeTokens: tokens,
      whitespacePattern: whitespacePattern,
      whitespaceTokens: whitespaceTokens
    };
  }

  function restoreTokens(text, patterns, tokens, label) {
    var out = String(text);
    var pats = patterns || [];
    var toks = tokens || [];
    var i;
    for (i = 0; i < toks.length; i += 1) {
      var token = toks[i];
      var replacement = pats[i];
      if (replacement === undefined) {
        throw new Error("Missing " + label + " for token " + token);
      }
      if (out.indexOf(token) === -1) {
        throw new Error("Translation missing " + label + " token " + token);
      }
      out = out.split(token).join(replacement);
    }
    return out;
  }

  function restorePlaceholders(translatedNormalized, placeholderPattern, normalizeTokens) {
    var text = restoreTokens(
      translatedNormalized,
      placeholderPattern,
      normalizeTokens,
      "placeholderPattern"
    );
    if (/\{\{PH_\d+\}\}/.test(text)) {
      throw new Error("Translation contains unexpected placeholder tokens");
    }
    return text;
  }

  function restoreWhitespace(translatedNormalized, whitespacePattern, whitespaceTokens) {
    var text = restoreTokens(
      translatedNormalized,
      whitespacePattern,
      whitespaceTokens,
      "whitespacePattern"
    );
    if (/\{\{WS_\d+\}\}/.test(text)) {
      throw new Error("Translation contains unexpected whitespace tokens");
    }
    return text;
  }

  function restoreAll(translatedNormalized, mapEntry) {
    var text = restorePlaceholders(
      translatedNormalized,
      mapEntry.placeholderPattern,
      mapEntry.normalizeTokens
    );
    return restoreWhitespace(text, mapEntry.whitespacePattern, mapEntry.whitespaceTokens);
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

  function extractWsTokens(text) {
    var re = /\{\{WS_(\d+)\}\}/g;
    var found = [];
    var m;
    while ((m = re.exec(String(text))) !== null) {
      found.push(m[0]);
    }
    return found;
  }

  function validateTokenList(expectedTokens, foundTokens, label) {
    if (expectedTokens.length !== foundTokens.length) {
      return {
        ok: false,
        message:
          label +
          " count mismatch: expected=" +
          expectedTokens.length +
          " got=" +
          foundTokens.length
      };
    }
    var i;
    for (i = 0; i < expectedTokens.length; i += 1) {
      if (expectedTokens[i] !== foundTokens[i]) {
        return {
          ok: false,
          message: label + " order/content mismatch at index " + i
        };
      }
    }
    return { ok: true, message: "" };
  }

  function validatePlaceholderParity(sourceNormalized, translation) {
    return validateTokenList(
      extractPhTokens(sourceNormalized),
      extractPhTokens(translation),
      "Placeholder"
    );
  }

  function validateWhitespaceParity(sourceNormalized, translation) {
    return validateTokenList(
      extractWsTokens(sourceNormalized),
      extractWsTokens(translation),
      "Whitespace"
    );
  }

  global.StringI18nPlaceholders = {
    normalizePlaceholders: normalizePlaceholders,
    restorePlaceholders: restorePlaceholders,
    restoreWhitespace: restoreWhitespace,
    restoreAll: restoreAll,
    validatePlaceholderParity: validatePlaceholderParity,
    validateWhitespaceParity: validateWhitespaceParity,
    extractPhTokens: extractPhTokens,
    extractWsTokens: extractWsTokens
  };
})(window);
