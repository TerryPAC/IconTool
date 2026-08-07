/* global window, StringI18nPlaceholders, StringI18nFilters, StringI18nHash */
(function (global) {
  "use strict";

  var TOOL_VERSION = "1.0.0";

  function applySkipReasons(entries, options) {
    var i;
    for (i = 0; i < entries.length; i += 1) {
      entries[i].skipReason = StringI18nFilters.getSkipReason(entries[i], options);
    }
    return entries;
  }

  function makeTranslationKey(source, order) {
    var key = String(source || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    key = (key || "string").slice(0, 40).replace(/_+$/g, "");
    return (key || "string") + "_" + String(order + 1);
  }

  function mergeAll(fileRecords, options) {
    var opts = options || {};
    var mergedMap = {};
    var mergedList = [];
    var mappingFiles = [];
    var keyValueWarnings = [];
    var keyValueSeen = {};
    var stats = {
      androidTotal: 0,
      iosTotal: 0,
      androidSkipped: 0,
      iosSkipped: 0,
      mergedCount: 0,
      onlyAndroid: 0,
      onlyIos: 0,
      both: 0
    };

    var fi;
    for (fi = 0; fi < fileRecords.length; fi += 1) {
      var rec = fileRecords[fi];
      var entries = applySkipReasons(rec.entries.slice(), opts);
      var mapEntries = [];
      var ei;
      for (ei = 0; ei < entries.length; ei += 1) {
        var entry = entries[ei];
        if (entry.platform === "android") {
          stats.androidTotal += 1;
        } else {
          stats.iosTotal += 1;
        }

        var kvKey = entry.platform + "::" + entry.key;
        if (!keyValueSeen[kvKey]) {
          keyValueSeen[kvKey] = entry.decodedValue;
        } else if (keyValueSeen[kvKey] !== entry.decodedValue) {
          keyValueWarnings.push({
            key: entry.key,
            platform: entry.platform,
            message: "same key appears with different values across files"
          });
        }

        if (entry.skipReason) {
          if (entry.platform === "android") {
            stats.androidSkipped += 1;
          } else {
            stats.iosSkipped += 1;
          }
          mapEntries.push({
            order: entry.order,
            key: entry.key,
            entryType: entry.entryType,
            mergedId: null,
            skipped: true,
            skipReason: entry.skipReason,
            originalDecoded: entry.decodedValue,
            placeholderPattern: [],
            normalizeTokens: [],
            whitespacePattern: [],
            whitespaceTokens: [],
            entryStart: entry.entryStart,
            entryEnd: entry.entryEnd,
            valueStart: entry.valueStart,
            valueEnd: entry.valueEnd
          });
          continue;
        }

        var norm = StringI18nPlaceholders.normalizePlaceholders(entry.decodedValue, {
          formatted: entry.attributes ? entry.attributes.formatted !== false : true
        });
        var mergedId = StringI18nHash.makeMergedId(norm.normalized);
        var item = mergedMap[mergedId];
        if (!item) {
          item = {
            id: mergedId,
            source: norm.normalized,
            translation: "",
            outputKey: makeTranslationKey(norm.normalized, mergedList.length),
            meta: {
              originalSamples: {},
              platforms: [],
              occurrenceCount: 0,
              refs: []
            }
          };
          mergedMap[mergedId] = item;
          mergedList.push(item);
        }
        item.meta.occurrenceCount += 1;
        if (item.meta.platforms.indexOf(entry.platform) === -1) {
          item.meta.platforms.push(entry.platform);
        }
        if (!item.meta.originalSamples[entry.platform]) {
          item.meta.originalSamples[entry.platform] = entry.decodedValue;
        }
        item.meta.refs.push({
          platform: entry.platform,
          fileId: entry.fileId,
          key: entry.key
        });

        mapEntries.push({
          order: entry.order,
          key: entry.key,
          entryType: entry.entryType,
          mergedId: mergedId,
          outputKey: item.outputKey,
          skipped: false,
          skipReason: null,
          originalDecoded: entry.decodedValue,
          placeholderPattern: norm.placeholderPattern,
          normalizeTokens: norm.normalizeTokens,
          whitespacePattern: norm.whitespacePattern,
          whitespaceTokens: norm.whitespaceTokens,
          entryStart: entry.entryStart,
          entryEnd: entry.entryEnd,
          valueStart: entry.valueStart,
          valueEnd: entry.valueEnd
        });
      }

      mappingFiles.push({
        fileId: rec.fileId,
        platform: rec.platform,
        contentHash: StringI18nHash.contentHash(rec.rawText),
        entries: mapEntries
      });
    }

    var mi;
    for (mi = 0; mi < mergedList.length; mi += 1) {
      var platforms = mergedList[mi].meta.platforms;
      var hasA = platforms.indexOf("android") !== -1;
      var hasI = platforms.indexOf("ios") !== -1;
      if (hasA && hasI) {
        stats.both += 1;
      } else if (hasA) {
        stats.onlyAndroid += 1;
      } else {
        stats.onlyIos += 1;
      }
    }
    stats.mergedCount = mergedList.length;

    var mapping = {
      version: 1,
      createdAt: new Date().toISOString(),
      toolVersion: TOOL_VERSION,
      options: {
        includeNonTranslatable: !!opts.includeNonTranslatable,
        disableHeuristic: !!opts.disableHeuristic
      },
      files: mappingFiles
    };

    var simple = {};
    mergedList.forEach(function (m) {
      simple[m.outputKey] = m.source;
    });

    return {
      toolVersion: TOOL_VERSION,
      stats: stats,
      mergedSimple: simple,
      mergedFull: mergedList,
      mapping: mapping,
      keyValueWarnings: keyValueWarnings
    };
  }

  global.StringI18nMergeEngine = {
    TOOL_VERSION: TOOL_VERSION,
    mergeAll: mergeAll,
    applySkipReasons: applySkipReasons
  };
})(window);
