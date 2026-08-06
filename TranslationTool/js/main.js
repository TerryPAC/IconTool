/* global window, document, StringI18nState, StringI18nAndroidXml, StringI18nIosStrings, StringI18nMergeEngine, StringI18nZip, StringI18nExportWriters, StringI18nValidate */
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function showMsg(el, type, text) {
    el.style.display = "block";
    el.className = "msg " + type;
    el.textContent = text;
  }

  function setStep(step) {
    var tabs = document.querySelectorAll(".step-tab");
    var i;
    for (i = 0; i < tabs.length; i += 1) {
      tabs[i].classList.toggle("active", String(tabs[i].getAttribute("data-step")) === String(step));
    }
    $("panel-1").classList.toggle("active", step === 1);
    $("panel-2").classList.toggle("active", step === 2);
    $("panel-3").classList.toggle("active", step === 3);
  }

  function readOptions() {
    return {
      includeNonTranslatable: $("opt-include-non-translatable").checked,
      disableHeuristic: $("opt-disable-heuristic").checked,
      fallbackToSource: $("opt-fallback-source").checked
    };
  }

  function syncOptionsToState() {
    var opts = readOptions();
    var st = StringI18nState.getState();
    st.options.includeNonTranslatable = opts.includeNonTranslatable;
    st.options.disableHeuristic = opts.disableHeuristic;
    st.options.fallbackToSource = opts.fallbackToSource;
  }

  function summarizeFiles(list) {
    if (!list.length) {
      return "No files yet.";
    }
    return list
      .map(function (f) {
        return (
          f.fileId +
          " — " +
          f.entries.length +
          " entries" +
          (f.warnings.length ? " (" + f.warnings.length + " warnings)" : "")
        );
      })
      .join("\n");
  }

  function refreshFileLists() {
    var st = StringI18nState.getState();
    $("android-list").textContent = summarizeFiles(st.androidFiles);
    $("ios-list").textContent = summarizeFiles(st.iosFiles);
  }

  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result));
      };
      reader.onerror = function () {
        reject(reader.error || new Error("read failed"));
      };
      reader.readAsText(file);
    });
  }

  function normalizeFileId(file, fallbackName) {
    if (file.webkitRelativePath && file.webkitRelativePath.length) {
      return file.webkitRelativePath;
    }
    return file.name || fallbackName || "unnamed";
  }

  function ingestAndroidFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    var xmlFiles = files.filter(function (f) {
      return /\.xml$/i.test(f.name);
    });
    return Promise.all(
      xmlFiles.map(function (file) {
        return readFileAsText(file).then(function (text) {
          var fileId = normalizeFileId(file);
          var parsed = StringI18nAndroidXml.parseAndroidXml(text, fileId);
          StringI18nState.upsertFile("android", fileId, text, parsed);
        });
      })
    ).then(function () {
      refreshFileLists();
      showMsg(
        $("import-msg"),
        "ok",
        "Imported " + xmlFiles.length + " Android XML file(s)."
      );
    });
  }

  function ingestIosFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    var stringFiles = files.filter(function (f) {
      return /\.strings$/i.test(f.name);
    });
    var ignoredDict = files.filter(function (f) {
      return /\.stringsdict$/i.test(f.name);
    });
    return Promise.all(
      stringFiles.map(function (file) {
        return readFileAsText(file).then(function (text) {
          var fileId = normalizeFileId(file);
          var parsed = StringI18nIosStrings.parseIosStrings(text, fileId);
          StringI18nState.upsertFile("ios", fileId, text, parsed);
        });
      })
    ).then(function () {
      refreshFileLists();
      var msg = "Imported " + stringFiles.length + " iOS .strings file(s).";
      if (ignoredDict.length) {
        msg += " Skipped " + ignoredDict.length + " .stringsdict (Phase B).";
      }
      showMsg($("import-msg"), ignoredDict.length ? "warn" : "ok", msg);
    });
  }

  function runMerge() {
    syncOptionsToState();
    var st = StringI18nState.getState();
    var records = StringI18nState.buildFileRecords();
    if (!records.length) {
      showMsg($("merge-msg"), "err", "No source files imported.");
      return;
    }
    var result = StringI18nMergeEngine.mergeAll(records, st.options);
    StringI18nState.setMergeResult(result);
    renderStats(result);
    renderMergeTable(result.mergedFull, "");
    var warn = "";
    if (result.keyValueWarnings.length) {
      warn = " Key/value warnings: " + result.keyValueWarnings.length + ".";
    }
    showMsg(
      $("merge-msg"),
      "ok",
      "Merge complete: " +
        result.stats.mergedCount +
        " unique strings." +
        warn +
        " Please download session.zip before translating."
    );
  }

  function renderStats(result) {
    var s = result.stats;
    $("merge-stats").innerHTML = [
      ["Android", s.androidTotal],
      ["iOS", s.iosTotal],
      ["Merged", s.mergedCount],
      ["Both", s.both],
      ["Android only", s.onlyAndroid],
      ["iOS only", s.onlyIos],
      ["Android skipped", s.androidSkipped],
      ["iOS skipped", s.iosSkipped]
    ]
      .map(function (pair) {
        return (
          '<div class="stat"><div class="n">' +
          pair[1] +
          '</div><div class="l">' +
          pair[0] +
          "</div></div>"
        );
      })
      .join("");
  }

  function renderMergeTable(items, query) {
    var q = String(query || "").toLowerCase();
    var tbody = $("merge-tbody");
    var rows = items.filter(function (m) {
      if (!q) {
        return true;
      }
      var blob =
        (m.id || "") +
        " " +
        (m.source || "") +
        " " +
        ((m.meta && m.meta.refs) || [])
          .map(function (r) {
            return r.key;
          })
          .join(" ");
      return blob.toLowerCase().indexOf(q) !== -1;
    });
    tbody.innerHTML = rows
      .slice(0, 500)
      .map(function (m) {
        return (
          "<tr><td><code>" +
          escapeHtml(m.id) +
          "</code></td><td>" +
          escapeHtml(m.source) +
          "</td><td>" +
          escapeHtml((m.meta.platforms || []).join(", ")) +
          "</td><td>" +
          m.meta.occurrenceCount +
          "</td></tr>"
        );
      })
      .join("");
    if (rows.length > 500) {
      tbody.innerHTML +=
        "<tr><td colspan='4'>Showing first 500 of " + rows.length + " rows.</td></tr>";
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function currentSessionPayload() {
    var st = StringI18nState.getState();
    if (!st.mergeResult) {
      throw new Error("Run merge first.");
    }
    return {
      toolVersion: st.mergeResult.toolVersion,
      stats: st.mergeResult.stats,
      mergedSimple: st.mergeResult.mergedSimple,
      mergedFull: st.mergeResult.mergedFull,
      mapping: st.mergeResult.mapping,
      snapshots: st.snapshots
    };
  }

  function bindUi() {
    document.querySelectorAll(".step-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        setStep(Number(tab.getAttribute("data-step")));
      });
    });

    $("btn-android-files").addEventListener("click", function () {
      $("android-files").click();
    });
    $("btn-android-folder").addEventListener("click", function () {
      $("android-folder").click();
    });
    $("btn-ios-files").addEventListener("click", function () {
      $("ios-files").click();
    });
    $("btn-ios-folder").addEventListener("click", function () {
      $("ios-folder").click();
    });

    $("android-files").addEventListener("change", function (e) {
      ingestAndroidFiles(e.target.files).catch(function (err) {
        showMsg($("import-msg"), "err", String(err.message || err));
      });
      e.target.value = "";
    });
    $("android-folder").addEventListener("change", function (e) {
      ingestAndroidFiles(e.target.files).catch(function (err) {
        showMsg($("import-msg"), "err", String(err.message || err));
      });
      e.target.value = "";
    });
    $("ios-files").addEventListener("change", function (e) {
      ingestIosFiles(e.target.files).catch(function (err) {
        showMsg($("import-msg"), "err", String(err.message || err));
      });
      e.target.value = "";
    });
    $("ios-folder").addEventListener("change", function (e) {
      ingestIosFiles(e.target.files).catch(function (err) {
        showMsg($("import-msg"), "err", String(err.message || err));
      });
      e.target.value = "";
    });

    $("btn-android-clear").addEventListener("click", function () {
      StringI18nState.resetPlatform("android");
      refreshFileLists();
    });
    $("btn-ios-clear").addEventListener("click", function () {
      StringI18nState.resetPlatform("ios");
      refreshFileLists();
    });

    $("btn-goto-merge").addEventListener("click", function () {
      setStep(2);
      runMerge();
    });
    $("btn-run-merge").addEventListener("click", runMerge);

    $("merge-search").addEventListener("input", function (e) {
      var st = StringI18nState.getState();
      if (st.mergeResult) {
        renderMergeTable(st.mergeResult.mergedFull, e.target.value);
      }
    });

    $("btn-dl-session").addEventListener("click", function () {
      try {
        StringI18nZip.buildSessionZip(currentSessionPayload()).then(function (blob) {
          StringI18nZip.downloadBlob("session.zip", blob);
        });
      } catch (err) {
        showMsg($("merge-msg"), "err", String(err.message || err));
      }
    });
    $("btn-dl-simple").addEventListener("click", function () {
      try {
        StringI18nZip.downloadJson("merged.simple.json", currentSessionPayload().mergedSimple);
      } catch (err) {
        showMsg($("merge-msg"), "err", String(err.message || err));
      }
    });
    $("btn-dl-full").addEventListener("click", function () {
      try {
        StringI18nZip.downloadJson("merged.full.json", currentSessionPayload().mergedFull);
      } catch (err) {
        showMsg($("merge-msg"), "err", String(err.message || err));
      }
    });
    $("btn-dl-mapping").addEventListener("click", function () {
      try {
        StringI18nZip.downloadJson("mapping.json", currentSessionPayload().mapping);
      } catch (err) {
        showMsg($("merge-msg"), "err", String(err.message || err));
      }
    });
    $("btn-dl-skipped").addEventListener("click", function () {
      try {
        var mapping = currentSessionPayload().mapping;
        var skipped = [];
        mapping.files.forEach(function (f) {
          f.entries.forEach(function (e) {
            if (e.skipped) {
              skipped.push({
                platform: f.platform,
                fileId: f.fileId,
                key: e.key,
                skipReason: e.skipReason,
                originalDecoded: e.originalDecoded
              });
            }
          });
        });
        StringI18nZip.downloadJson("skipped.json", skipped);
      } catch (err) {
        showMsg($("merge-msg"), "err", String(err.message || err));
      }
    });

    $("btn-translated").addEventListener("click", function () {
      $("translated-file").click();
    });
    $("btn-session-zip").addEventListener("click", function () {
      $("session-file").click();
    });

    $("translated-file").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) {
        return;
      }
      readFileAsText(file)
        .then(function (text) {
          var data = JSON.parse(text);
          if (!Array.isArray(data)) {
            throw new Error("translated.json must be an array");
          }
          StringI18nState.setTranslated(data);
          showMsg($("export-msg"), "ok", "Loaded " + data.length + " translated rows.");
        })
        .catch(function (err) {
          showMsg($("export-msg"), "err", String(err.message || err));
        });
      e.target.value = "";
    });

    $("session-file").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) {
        return;
      }
      StringI18nZip.loadSessionZip(file)
        .then(function (session) {
          StringI18nState.loadSession(session);
          showMsg(
            $("export-msg"),
            "ok",
            "Session loaded (" + Object.keys(session.snapshots).length + " snapshots)."
          );
        })
        .catch(function (err) {
          showMsg($("export-msg"), "err", String(err.message || err));
        });
      e.target.value = "";
    });

    $("btn-export").addEventListener("click", function () {
      syncOptionsToState();
      var st = StringI18nState.getState();
      if (!st.translated) {
        showMsg($("export-msg"), "err", "Upload translated.json first.");
        return;
      }
      if (!StringI18nState.hasSessionInMemory()) {
        showMsg($("export-msg"), "err", "Upload session.zip (or keep merge session in this tab).");
        return;
      }
      var session = {
        mapping: st.mergeResult.mapping,
        snapshots: st.snapshots
      };
      var result = StringI18nExportWriters.exportPlatformFiles(session, st.translated, {
        fallbackToSource: st.options.fallbackToSource
      });
      if (result.report.fileErrors.length) {
        showMsg(
          $("export-msg"),
          "err",
          "Export blocked: " +
            result.report.fileErrors
              .map(function (e) {
                return e.fileId + ": " + e.message;
              })
              .join("; ")
        );
        return;
      }
      StringI18nZip.buildOutputZip(
        result.outputs,
        result.report,
        $("android-locale-dir").value.trim() || "values-xx",
        $("ios-locale-dir").value.trim() || "xx.lproj"
      ).then(function (blob) {
        StringI18nZip.downloadBlob("output.zip", blob);
        showMsg(
          $("export-msg"),
          result.report.failed.length ? "warn" : "ok",
          "Exported " +
            result.outputs.length +
            " file(s). written=" +
            result.report.written.length +
            " failed=" +
            result.report.failed.length +
            " skipped=" +
            result.report.skipped.length
        );
      });
    });

    $("btn-run-tests").addEventListener("click", function () {
      var results = StringI18nValidate.runSelfTests();
      var failed = results.filter(function (r) {
        return !r.ok;
      });
      if (failed.length) {
        showMsg(
          $("test-msg"),
          "err",
          failed
            .map(function (f) {
              return f.name + ": " + f.message;
            })
            .join(" | ")
        );
      } else {
        showMsg($("test-msg"), "ok", "All " + results.length + " self-tests passed.");
      }
    });
  }

  bindUi();
  refreshFileLists();
})();
