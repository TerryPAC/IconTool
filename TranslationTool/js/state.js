/* global window */
(function (global) {
  "use strict";

  var state = {
    options: {
      includeNonTranslatable: false,
      disableHeuristic: false,
      fallbackToSource: false
    },
    androidFiles: [], // {fileId, rawText, entries, warnings}
    iosFiles: [],
    mergeResult: null,
    snapshots: {},
    translated: null
  };

  function getState() {
    return state;
  }

  function resetPlatform(platform) {
    if (platform === "android") {
      state.androidFiles = [];
      Object.keys(state.snapshots).forEach(function (k) {
        if (k.indexOf("android/") === 0) {
          delete state.snapshots[k];
        }
      });
    } else {
      state.iosFiles = [];
      Object.keys(state.snapshots).forEach(function (k) {
        if (k.indexOf("ios/") === 0) {
          delete state.snapshots[k];
        }
      });
    }
    state.mergeResult = null;
  }

  function clearAll() {
    state.androidFiles = [];
    state.iosFiles = [];
    state.mergeResult = null;
    state.snapshots = {};
    state.translated = null;
  }

  function upsertFile(platform, fileId, rawText, parseResult) {
    var list = platform === "android" ? state.androidFiles : state.iosFiles;
    var existing = -1;
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i].fileId === fileId) {
        existing = i;
        break;
      }
    }
    var rec = {
      platform: platform,
      fileId: fileId,
      rawText: rawText,
      entries: parseResult.entries,
      warnings: parseResult.warnings || []
    };
    if (existing >= 0) {
      list[existing] = rec;
    } else {
      list.push(rec);
    }
    state.snapshots[platform + "/" + fileId] = rawText;
    state.mergeResult = null;
  }

  function setMergeResult(result) {
    state.mergeResult = result;
  }

  function setTranslated(arr) {
    state.translated = arr;
  }

  function loadSession(session) {
    state.mergeResult = {
      toolVersion: session.toolVersion,
      stats: session.stats,
      mergedSimple: session.mergedSimple,
      mergedFull: session.mergedFull,
      mapping: session.mapping,
      keyValueWarnings: []
    };
    state.snapshots = session.snapshots || {};
  }

  function buildFileRecords() {
    return state.androidFiles.concat(state.iosFiles);
  }

  function hasSessionInMemory() {
    return !!(state.mergeResult && state.mergeResult.mapping && Object.keys(state.snapshots).length);
  }

  global.StringI18nState = {
    getState: getState,
    resetPlatform: resetPlatform,
    clearAll: clearAll,
    upsertFile: upsertFile,
    setMergeResult: setMergeResult,
    setTranslated: setTranslated,
    loadSession: loadSession,
    buildFileRecords: buildFileRecords,
    hasSessionInMemory: hasSessionInMemory
  };
})(window);
