/* global window */
(function (global) {
  "use strict";

  function parseIosStringsdict(_rawText, fileId) {
    return {
      platform: "ios",
      fileId: fileId,
      entries: [],
      warnings: ["stringsdict is not supported in Phase A (MVP)"]
    };
  }

  global.StringI18nIosStringsdict = {
    parseIosStringsdict: parseIosStringsdict
  };
})(window);
