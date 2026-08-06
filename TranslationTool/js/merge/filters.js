/* global window */
(function (global) {
  "use strict";

  function isEmpty(value) {
    return value === null || value === undefined || String(value).length === 0;
  }

  function isResourceRef(value) {
    return /^@string\/[A-Za-z0-9_]+$/.test(String(value).trim());
  }

  function isPureUrl(value) {
    return /^(https?:\/\/|mailto:)/i.test(String(value).trim());
  }

  function isPureEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
  }

  function isPureNumber(value) {
    return /^-?\d+(\.\d+)?$/.test(String(value).trim());
  }

  function looksLikeSecret(value) {
    var v = String(value).trim();
    if (v.indexOf(".apps.googleusercontent.com") !== -1) {
      return true;
    }
    if (/^[A-Za-z0-9+/=_-]{40,}$/.test(v) && !/\s/.test(v)) {
      return true;
    }
    if (/^(pk_|sk_|AIza)[A-Za-z0-9_-]+$/.test(v)) {
      return true;
    }
    return false;
  }

  function looksLikeApiKeyName(key) {
    var k = String(key || "").toLowerCase();
    return (
      k.indexOf("api_key") !== -1 ||
      k.indexOf("apikey") !== -1 ||
      k.indexOf("app_id") !== -1 ||
      k.indexOf("client_id") !== -1 ||
      k.indexOf("clientid") !== -1 ||
      k.indexOf("secret") !== -1 ||
      k.indexOf("token") !== -1 && k.indexOf("text") === -1
    );
  }

  /**
   * @returns {null|string} skipReason or null if keep
   */
  function getSkipReason(entry, options) {
    var opts = options || {};
    var includeNonTranslatable = !!opts.includeNonTranslatable;
    var disableHeuristic = !!opts.disableHeuristic;

    if (entry.attributes && entry.attributes.translatable === false && !includeNonTranslatable) {
      return "translatable_false";
    }
    if (isEmpty(entry.decodedValue)) {
      return "empty";
    }
    if (isResourceRef(entry.decodedValue)) {
      return "resource_ref";
    }
    if (!disableHeuristic) {
      if (looksLikeSecret(entry.decodedValue) || looksLikeApiKeyName(entry.key)) {
        return "heuristic_secret";
      }
      if (isPureUrl(entry.decodedValue)) {
        return "heuristic_url";
      }
      if (isPureEmail(entry.decodedValue)) {
        return "heuristic_email";
      }
      if (isPureNumber(entry.decodedValue)) {
        return "heuristic_number";
      }
    }
    return null;
  }

  global.StringI18nFilters = {
    getSkipReason: getSkipReason,
    isEmpty: isEmpty,
    isResourceRef: isResourceRef
  };
})(window);
