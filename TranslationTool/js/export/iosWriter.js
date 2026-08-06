/* global window, StringI18nExportWriters */
(function (global) {
  "use strict";

  // Shared write-back lives in androidWriter.js as StringI18nExportWriters.
  // This file exists for plan layout symmetry and future iOS-specific hooks.
  global.StringI18nIosWriter = {
    exportPlatformFiles: function (session, translatedData, options) {
      return StringI18nExportWriters.exportPlatformFiles(session, translatedData, options);
    }
  };
})(window);
