/* global window, StringI18nUnescape, StringI18nPlaceholders, StringI18nAndroidXml, StringI18nIosStrings */
(function (global) {
  "use strict";

  function buildTranslationMap(translatedArray) {
    var map = {};
    var i;
    for (i = 0; i < translatedArray.length; i += 1) {
      var row = translatedArray[i];
      if (!row || !row.id) {
        continue;
      }
      map[row.id] = row;
    }
    return map;
  }

  function prepareEntryWrite(mapEntry, translationMap, options) {
    var opts = options || {};
    if (mapEntry.skipped) {
      return { action: "skip", reason: mapEntry.skipReason || "skipped" };
    }
    var row = translationMap[mapEntry.mergedId];
    if (!row) {
      return { action: "fail", reason: "missing translation id " + mapEntry.mergedId };
    }
    var translation = row.translation;
    if (translation === null || translation === undefined || translation === "") {
      if (opts.fallbackToSource) {
        translation = row.source || mapEntry.originalDecoded;
      } else {
        return { action: "fail", reason: "empty translation for " + mapEntry.mergedId };
      }
    }
    var parity = StringI18nPlaceholders.validatePlaceholderParity(
      (row.source !== undefined && row.source !== null ? row.source : null) ||
        StringI18nPlaceholders.normalizePlaceholders(mapEntry.originalDecoded, {
          formatted: true
        }).normalized,
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
    if (!parity.ok && expectedTokens.length > 0) {
      // still proceed if token list matches mapping; parity uses source field
    }
    var decodedRestored;
    try {
      decodedRestored = StringI18nPlaceholders.restorePlaceholders(
        translation,
        mapEntry.placeholderPattern,
        mapEntry.normalizeTokens
      );
    } catch (err) {
      return { action: "fail", reason: String(err.message || err) };
    }
    return { action: "write", decoded: decodedRestored };
  }

  function exportPlatformFiles(session, translatedArray, options) {
    var translationMap = buildTranslationMap(translatedArray || []);
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
      var hashNow =
        global.StringI18nHash && global.StringI18nHash.contentHash
          ? global.StringI18nHash.contentHash(raw)
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
          ? StringI18nAndroidXml.rewriteAndroidXml(raw, replacements)
          : StringI18nIosStrings.rewriteIosStrings(raw, replacements);

      // verify keys/order
      var verify =
        fileMeta.platform === "android"
          ? StringI18nAndroidXml.parseAndroidXml(outText, fileMeta.fileId)
          : StringI18nIosStrings.parseIosStrings(outText, fileMeta.fileId);
      var keysOk = true;
      if (verify.entries.length !== parsed.entries.length) {
        keysOk = false;
      } else {
        var vi;
        for (vi = 0; vi < parsed.entries.length; vi += 1) {
          if (verify.entries[vi].key !== parsed.entries[vi].key) {
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
