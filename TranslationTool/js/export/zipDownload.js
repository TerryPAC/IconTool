/* global window, JSZip, StringI18nMergeEngine */
(function (global) {
  "use strict";

  function downloadBlob(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function downloadJson(filename, obj) {
    var text = JSON.stringify(obj, null, 2);
    downloadBlob(filename, new Blob([text], { type: "application/json;charset=utf-8" }));
  }

  function downloadText(filename, text, mime) {
    downloadBlob(filename, new Blob([text], { type: mime || "text/plain;charset=utf-8" }));
  }

  function ensureJsZip() {
    if (typeof JSZip === "undefined") {
      throw new Error("JSZip not loaded. Ensure vendor/jszip.min.js is present.");
    }
  }

  function buildSessionZip(session) {
    ensureJsZip();
    var zip = new JSZip();
    zip.file("mapping.json", JSON.stringify(session.mapping, null, 2));
    zip.file("merged.simple.json", JSON.stringify(session.mergedSimple, null, 2));
    zip.file("merged.full.json", JSON.stringify(session.mergedFull, null, 2));
    zip.file(
      "manifest.json",
      JSON.stringify(
        {
          toolVersion: session.toolVersion || StringI18nMergeEngine.TOOL_VERSION,
          createdAt: session.mapping.createdAt,
          stats: session.stats,
          files: (session.mapping.files || []).map(function (f) {
            return { platform: f.platform, fileId: f.fileId, contentHash: f.contentHash };
          })
        },
        null,
        2
      )
    );
    var snapFolder = zip.folder("snapshots");
    var keys = Object.keys(session.snapshots || {});
    var i;
    for (i = 0; i < keys.length; i += 1) {
      snapFolder.file(keys[i], session.snapshots[keys[i]]);
    }
    return zip.generateAsync({ type: "blob" });
  }

  function getFlatFilename(fileId, usedNames) {
    var baseName = String(fileId || "output").replace(/^.*[\\/]/, "") || "output";
    var dot = baseName.lastIndexOf(".");
    var stem = dot > 0 ? baseName.slice(0, dot) : baseName;
    var ext = dot > 0 ? baseName.slice(dot) : "";
    var candidate = baseName;
    var suffix = 2;
    while (usedNames[candidate]) {
      candidate = stem + "_" + suffix + ext;
      suffix += 1;
    }
    usedNames[candidate] = true;
    return candidate;
  }

  function buildOutputZip(outputs, report) {
    ensureJsZip();
    var zip = new JSZip();
    var usedNames = {};
    var i;
    for (i = 0; i < outputs.length; i += 1) {
      var o = outputs[i];
      zip.file(getFlatFilename(o.fileId, usedNames), o.content);
    }
    zip.file("report.json", JSON.stringify(report, null, 2));
    return zip.generateAsync({ type: "blob" });
  }

  function loadSessionZip(file) {
    ensureJsZip();
    return JSZip.loadAsync(file).then(function (zip) {
      var mappingFile = zip.file("mapping.json");
      if (!mappingFile) {
        throw new Error("session.zip missing mapping.json");
      }
      return mappingFile.async("string").then(function (mappingText) {
        var mapping = JSON.parse(mappingText);
        var snapFiles = [];
        zip.folder("snapshots").forEach(function (relativePath, file) {
          if (!file.dir) {
            snapFiles.push(relativePath);
          }
        });
        var snapshots = {};
        var tasks = snapFiles.map(function (rel) {
          return zip
            .file("snapshots/" + rel)
            .async("string")
            .then(function (content) {
              snapshots[rel] = content;
            });
        });
        var simpleP = zip.file("merged.simple.json")
          ? zip.file("merged.simple.json").async("string").then(JSON.parse)
          : Promise.resolve([]);
        var fullP = zip.file("merged.full.json")
          ? zip.file("merged.full.json").async("string").then(JSON.parse)
          : Promise.resolve([]);
        return Promise.all(tasks.concat([simpleP, fullP])).then(function (results) {
          var mergedSimple = results[results.length - 2];
          var mergedFull = results[results.length - 1];
          return {
            mapping: mapping,
            snapshots: snapshots,
            mergedSimple: mergedSimple,
            mergedFull: mergedFull,
            toolVersion: mapping.toolVersion,
            stats: null
          };
        });
      });
    });
  }

  global.StringI18nZip = {
    downloadBlob: downloadBlob,
    downloadJson: downloadJson,
    downloadText: downloadText,
    buildSessionZip: buildSessionZip,
    buildOutputZip: buildOutputZip,
    loadSessionZip: loadSessionZip
  };
})(window);
