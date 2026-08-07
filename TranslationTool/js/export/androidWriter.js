/* global window, StringI18nUnescape, StringI18nPlaceholders, StringI18nAndroidXml, StringI18nIosStrings */
(function (global) {
  "use strict";

  function buildTranslationMap(translatedData) {
    var map = {};
    Object.keys(translatedData || {}).forEach(function (key) {
      map[key] = {
        outputKey: key,
        translation: translatedData[key]
      };
    });
    return map;
  }

  function prepareEntryWrite(mapEntry, translationMap, options) {
    var opts = options || {};
    if (mapEntry.skipped) {
      return { action: "skip", reason: mapEntry.skipReason || "skipped" };
    }
    var row = translationMap[mapEntry.mergedId] || translationMap[mapEntry.outputKey];
    if (!row) {
      return {
        action: "fail",
        reason: "missing translation key " + (mapEntry.outputKey || mapEntry.mergedId)
      };
    }
    var translation = row.translation;
    if (translation === null || translation === undefined || translation === "") {
      if (opts.fallbackToSource) {
        translation = row.source || mapEntry.originalDecoded;
      } else {
        return { action: "fail", reason: "empty translation for " + mapEntry.mergedId };
      }
    }
    var sourceNormalized =
      (row.source !== undefined && row.source !== null ? row.source : null) ||
      StringI18nPlaceholders.normalizePlaceholders(mapEntry.originalDecoded, {
        formatted: true
      }).normalized;
    var parity = StringI18nPlaceholders.validatePlaceholderParity(
      sourceNormalized,
      translation
    );
    var wsParity = StringI18nPlaceholders.validateWhitespaceParity(
      sourceNormalized,
      translation
    );
    // Prefer validating against mapping tokens length
    var expectedTokens = mapEntry.normalizeTokens || [];
    var foundTokens = StringI18nPlaceholders.extractPhTokens(translation);
    if (expectedTokens.length !== foundTokens.length) {
      return {
        action: "fail",
        reason:
          "placeholder count mismatch for " +
          mapEntry.key +
          ": expected " +
          expectedTokens.length +
          " got " +
          foundTokens.length
      };
    }
    var ti;
    for (ti = 0; ti < expectedTokens.length; ti += 1) {
      if (foundTokens[ti] !== expectedTokens[ti]) {
        return {
          action: "fail",
          reason: "placeholder order mismatch for " + mapEntry.key + " at " + ti
        };
      }
    }
    var expectedWs = mapEntry.whitespaceTokens || [];
    var foundWs = StringI18nPlaceholders.extractWsTokens(translation);
    if (expectedWs.length !== foundWs.length) {
      return {
        action: "fail",
        reason:
          "whitespace token count mismatch for " +
          mapEntry.key +
          ": expected " +
          expectedWs.length +
          " got " +
          foundWs.length
      };
    }
    for (ti = 0; ti < expectedWs.length; ti += 1) {
      if (foundWs[ti] !== expectedWs[ti]) {
        return {
          action: "fail",
          reason: "whitespace token order mismatch for " + mapEntry.key + " at " + ti
        };
      }
    }
    if (!parity.ok && expectedTokens.length > 0) {
      // still proceed if token list matches mapping; parity uses source field
    }
    if (!wsParity.ok && expectedWs.length > 0) {
      // still proceed if token list matches mapping
    }
    var decodedRestored;
    try {
      decodedRestored = StringI18nPlaceholders.restoreAll(translation, mapEntry);
    } catch (err) {
      return { action: "fail", reason: String(err.message || err) };
    }
    return { action: "write", decoded: decodedRestored };
  }

  function getAndroidRemovalRange(raw, entryStart, entryEnd) {
    var lineStart = raw.lastIndexOf("\n", entryStart - 1) + 1;
    var lineEnd = raw.indexOf("\n", entryEnd);
    if (lineEnd === -1) {
      lineEnd = raw.length;
    }
    var before = raw.slice(lineStart, entryStart);
    var after = raw.slice(entryEnd, lineEnd);
    if (/^\s*$/.test(before + after)) {
      return {
        entryStart: lineStart,
        entryEnd: lineEnd < raw.length ? lineEnd + 1 : lineEnd
      };
    }
    return {
      entryStart: entryStart,
      entryEnd: entryEnd
    };
  }

  function exportPlatformFiles(session, translatedData, options) {
    var translationMap = buildTranslationMap(translatedData || {});
    var report = {
      written: [],
      failed: [],
      skipped: [],
      fileErrors: []
    };
    var outputs = [];
    var files = session.mapping.files || [];
    var snapshots = session.snapshots || {};
    var fi;

    for (fi = 0; fi < files.length; fi += 1) {
      var fileMeta = files[fi];
      var snapKey = fileMeta.platform + "/" + fileMeta.fileId;
      var raw = snapshots[snapKey];
      if (raw === undefined || raw === null) {
        report.fileErrors.push({ fileId: fileMeta.fileId, message: "missing snapshot" });
        continue;
      }
      var sourceRaw = raw;
      raw =
        fileMeta.platform === "android"
          ? StringI18nAndroidXml.stripAndroidComments(raw)
          : StringI18nIosStrings.stripIosComments(raw);
      var hashNow =
        global.StringI18nHash && global.StringI18nHash.contentHash
          ? global.StringI18nHash.contentHash(sourceRaw)
          : null;
      if (hashNow && fileMeta.contentHash && hashNow !== fileMeta.contentHash) {
        report.fileErrors.push({
          fileId: fileMeta.fileId,
          message: "contentHash mismatch; re-import sources and regenerate session"
        });
        continue;
      }

      var parsed;
      if (fileMeta.platform === "android") {
        parsed = StringI18nAndroidXml.parseAndroidXml(raw, fileMeta.fileId);
      } else {
        parsed = StringI18nIosStrings.parseIosStrings(raw, fileMeta.fileId);
      }

      if (parsed.entries.length !== fileMeta.entries.length) {
        report.fileErrors.push({
          fileId: fileMeta.fileId,
          message:
            "entry count mismatch: snapshot=" +
            parsed.entries.length +
            " mapping=" +
            fileMeta.entries.length
        });
        continue;
      }

      var replacements = [];
      var removals = [];
      var ei;
      var structureOk = true;
      for (ei = 0; ei < fileMeta.entries.length; ei += 1) {
        var mapEntry = fileMeta.entries[ei];
        var live = parsed.entries[ei];
        if (
          live.key !== mapEntry.key ||
          live.order !== mapEntry.order ||
          live.entryType !== mapEntry.entryType
        ) {
          report.fileErrors.push({
            fileId: fileMeta.fileId,
            message:
              "structure mismatch at order " +
              mapEntry.order +
              ": expected key " +
              mapEntry.key +
              " got " +
              live.key
          });
          structureOk = false;
          break;
        }
        var prep = prepareEntryWrite(mapEntry, translationMap, options);
        if (prep.action === "skip") {
          report.skipped.push({
            fileId: fileMeta.fileId,
            key: mapEntry.key,
            reason: prep.reason
          });
          if (
            fileMeta.platform === "android" &&
            mapEntry.entryStart !== undefined &&
            mapEntry.entryEnd !== undefined
          ) {
            removals.push(
              getAndroidRemovalRange(raw, live.entryStart, live.entryEnd)
            );
          }
          continue;
        }
        if (prep.action === "fail") {
          report.failed.push({
            fileId: fileMeta.fileId,
            key: mapEntry.key,
            mergedId: mapEntry.mergedId,
            reason: prep.reason
          });
          continue;
        }
        var newRaw =
          fileMeta.platform === "android"
            ? StringI18nUnescape.encodeAndroidValue(prep.decoded)
            : StringI18nUnescape.encodeIosEscapes(prep.decoded);
        replacements.push({
          valueStart: live.valueStart,
          valueEnd: live.valueEnd,
          newRawValue: newRaw
        });
        report.written.push({
          fileId: fileMeta.fileId,
          key: mapEntry.key,
          mergedId: mapEntry.mergedId
        });
      }

      if (!structureOk) {
        continue;
      }

      var outText =
        fileMeta.platform === "android"
          ? StringI18nAndroidXml.rewriteAndroidXml(raw, replacements, removals)
          : StringI18nIosStrings.rewriteIosStrings(raw, replacements);

      // verify keys/order
      var verify =
        fileMeta.platform === "android"
          ? StringI18nAndroidXml.parseAndroidXml(outText, fileMeta.fileId)
          : StringI18nIosStrings.parseIosStrings(outText, fileMeta.fileId);
      var keysOk = true;
      var expectedEntries = parsed.entries.filter(function (entry, index) {
        return !(
          fileMeta.platform === "android" &&
          fileMeta.entries[index] &&
          fileMeta.entries[index].skipped
        );
      });
      if (verify.entries.length !== expectedEntries.length) {
        keysOk = false;
      } else {
        var vi;
        for (vi = 0; vi < expectedEntries.length; vi += 1) {
          if (verify.entries[vi].key !== expectedEntries[vi].key) {
            keysOk = false;
            break;
          }
        }
      }
      if (!keysOk) {
        report.fileErrors.push({
          fileId: fileMeta.fileId,
          message: "post-write key/order verification failed"
        });
        continue;
      }

      outputs.push({
        platform: fileMeta.platform,
        fileId: fileMeta.fileId,
        content: outText
      });
    }

    return { outputs: outputs, report: report };
  }

  global.StringI18nExportWriters = {
    exportPlatformFiles: exportPlatformFiles,
    prepareEntryWrite: prepareEntryWrite
  };
})(window);
