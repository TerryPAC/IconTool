/* global window, document, StringI18nState, StringI18nAndroidXml, StringI18nIosStrings, StringI18nMergeEngine, StringI18nZip, StringI18nExportWriters, StringI18nValidate */
(function () {
  "use strict";

  var selectedPreview = {
    android: null,
    ios: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function showMsg(el, type, text) {
    el.style.display = "block";
    el.className = "msg " + type;
    el.textContent = text;
  }

  function showMsgLines(el, type, lines) {
    el.style.display = "block";
    el.className = "msg " + type;
    el.innerHTML = lines.map(escapeHtml).join("<br>");
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
    refreshSessionStatus();
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setPreview(platform, fileRec) {
    var previewEl = $(platform + "-preview");
    var pathEl = $(platform + "-preview-path");
    if (!fileRec) {
      selectedPreview[platform] = null;
      pathEl.textContent = "Select a file to preview";
      previewEl.textContent = "No file selected.";
      return;
    }
    selectedPreview[platform] = fileRec.fileId;
    pathEl.textContent = fileRec.fileId;
    previewEl.textContent = fileRec.rawText || "";
  }

  function renderFileList(platform, list) {
    var container = $(platform + "-list");
    var countEl = $(platform + "-count");
    var label = platform === "android" ? "Android" : "iOS";
    countEl.textContent = label + ": " + list.length;

    if (!list.length) {
      container.innerHTML = '<div class="empty-state">No ' + label + " files yet.</div>";
      setPreview(platform, null);
      return;
    }

    var selectedId = selectedPreview[platform];
    var selectedRec = null;
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i].fileId === selectedId) {
        selectedRec = list[i];
        break;
      }
    }
    if (!selectedRec) {
      selectedRec = list[0];
    }

    container.innerHTML = list
      .map(function (f) {
        var active = f.fileId === selectedRec.fileId ? " active" : "";
        var warn =
          f.warnings && f.warnings.length
            ? " · " + f.warnings.length + " warning" + (f.warnings.length === 1 ? "" : "s")
            : "";
        return (
          '<button type="button" class="file-item' +
          active +
          '" role="option" aria-selected="' +
          (active ? "true" : "false") +
          '" data-platform="' +
          platform +
          '" data-file-id="' +
          escapeHtml(f.fileId) +
          '">' +
          '<span class="file-id">' +
          escapeHtml(f.fileId) +
          "</span>" +
          '<span class="file-meta">' +
          f.entries.length +
          " entries" +
          warn +
          "</span>" +
          "</button>"
        );
      })
      .join("");

    setPreview(platform, selectedRec);
  }

  function refreshFileLists() {
    var st = StringI18nState.getState();
    renderFileList("android", st.androidFiles);
    renderFileList("ios", st.iosFiles);
  }

  function refreshSessionStatus() {
    var el = $("session-status");
    if (!el) {
      return;
    }
    if (StringI18nState.hasSessionInMemory()) {
      el.textContent = "In-tab session ready.";
      el.className = "status-line ready";
    } else {
      el.textContent = "Upload session.zip if merge data is not in this tab.";
      el.className = "status-line";
    }
    var st = StringI18nState.getState();
    var hasMapping = !!(
      st.mergeResult &&
      st.mergeResult.mapping &&
      Array.isArray(st.mergeResult.mapping.files)
    );
    $("session-card").style.display = hasMapping ? "none" : "block";
  }

  function parseTranslatedJson(text) {
    var data = JSON.parse(String(text || "").trim());
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("translated.json must be a key/value object");
    }
    return data;
  }

  function updateTranslatedPreviewStatus() {
    var text = $("translated-preview").value.trim();
    var status = $("translated-preview-status");
    if (!text) {
      status.textContent = "Paste or upload JSON to continue.";
      status.className = "status-line";
      return;
    }
    try {
      var data = parseTranslatedJson(text);
      status.textContent = "Valid JSON · " + Object.keys(data).length + " translated entries.";
      status.className = "status-line ready";
    } catch (err) {
      status.textContent = "JSON needs attention: " + String(err.message || err);
      status.className = "status-line invalid";
    }
  }

  function getExportResult() {
    syncOptionsToState();
    var translatedData;
    try {
      translatedData = parseTranslatedJson($("translated-preview").value);
    } catch (err) {
      updateTranslatedPreviewStatus();
      showMsg($("export-msg"), "err", "Fix the translated JSON in the preview before continuing.");
      return null;
    }
    StringI18nState.setTranslated(translatedData);
    var st = StringI18nState.getState();
    if (!StringI18nState.hasSessionInMemory()) {
      showMsg($("export-msg"), "err", "Upload session.zip to load mapping and source snapshots.");
      return null;
    }
    var result = StringI18nExportWriters.exportPlatformFiles(
      {
        mapping: st.mergeResult.mapping,
        snapshots: st.snapshots
      },
      translatedData,
      {
        fallbackToSource: st.options.fallbackToSource
      }
    );
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
      return null;
    }
    return result;
  }

  function renderOutputGroup(id, platform, outputs) {
    var platformOutputs = outputs.filter(function (output) {
      return output.platform === platform;
    });
    if (!platformOutputs.length) {
      $(id).textContent = "No " + platform + " files in this session.";
      return;
    }
    $(id).innerHTML = platformOutputs
      .map(function (output) {
        return (
          '<section class="output-file"><h4>' +
          escapeHtml(output.fileId) +
          "</h4><pre>" +
          escapeHtml(output.content) +
          "</pre></section>"
        );
      })
      .join("");
  }

  function renderExportPreview(result) {
    $("export-preview").style.display = "grid";
    renderOutputGroup("android-output-preview", "android", result.outputs);
    renderOutputGroup("ios-output-preview", "ios", result.outputs);
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
          var cleanText = StringI18nAndroidXml.stripAndroidComments(text);
          var parsed = StringI18nAndroidXml.parseAndroidXml(cleanText, fileId);
          StringI18nState.upsertFile("android", fileId, cleanText, parsed);
          selectedPreview.android = fileId;
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
          var cleanText = StringI18nIosStrings.stripIosComments(text);
          var parsed = StringI18nIosStrings.parseIosStrings(cleanText, fileId);
          StringI18nState.upsertFile("ios", fileId, cleanText, parsed);
          selectedPreview.ios = fileId;
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
    renderMergeTable(result.mergedFull, $("merge-search").value || "");
    renderKeyValueWarnings(result.keyValueWarnings);
    refreshSessionStatus();
    var warningLine = result.keyValueWarnings.length
      ? result.keyValueWarnings.length + " key/value warning(s) are shown below."
      : "No key/value warnings.";
    showMsgLines(
      $("merge-msg"),
      "ok",
      [
        "Merge complete: " + result.stats.mergedCount + " unique strings.",
        warningLine,
        "Download session.zip and merged.simple.json next."
      ]
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

  function renderKeyValueWarnings(warnings) {
    var container = $("merge-warnings");
    if (!warnings.length) {
      container.innerHTML = "";
      container.style.display = "none";
      return;
    }
    container.innerHTML =
      "<h3>Key/value warnings (" +
      warnings.length +
      ")</h3><ul class=\"warning-list\">" +
      warnings
        .map(function (warning) {
          return (
            "<li><code>" +
            escapeHtml(warning.key) +
            "</code><span>" +
            escapeHtml(warning.platform) +
            "</span><span>" +
            escapeHtml(warning.message) +
            "</span></li>"
          );
        })
        .join("") +
      "</ul>";
    container.style.display = "block";
  }

  function renderMergeTable(items, query) {
    var q = String(query || "").toLowerCase();
    var tbody = $("merge-tbody");
    var rows = items.filter(function (m) {
      if (!q) {
        return true;
      }
      var blob =
        (m.outputKey || "") +
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
          escapeHtml(m.outputKey) +
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

  function selectFileFromList(platform, fileId) {
    var st = StringI18nState.getState();
    var list = platform === "android" ? st.androidFiles : st.iosFiles;
    var found = null;
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i].fileId === fileId) {
        found = list[i];
        break;
      }
    }
    if (!found) {
      return;
    }
    selectedPreview[platform] = fileId;
    renderFileList(platform, list);
  }

  function bindDropZone(platform) {
    var zone = document.querySelector('.drop-zone[data-platform="' + platform + '"]');
    var dragDepth = 0;
    var ingest = platform === "android" ? ingestAndroidFiles : ingestIosFiles;

    zone.addEventListener("dragenter", function (e) {
      e.preventDefault();
      dragDepth += 1;
      zone.classList.add("drag-over");
    });
    zone.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });
    zone.addEventListener("dragleave", function (e) {
      e.preventDefault();
      dragDepth -= 1;
      if (dragDepth <= 0) {
        dragDepth = 0;
        zone.classList.remove("drag-over");
      }
    });
    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      dragDepth = 0;
      zone.classList.remove("drag-over");
      ingest(e.dataTransfer.files).catch(function (err) {
        showMsg($("import-msg"), "err", String(err.message || err));
      });
    });
  }

  function loadTranslatedFile(file) {
    return readFileAsText(file)
      .then(function (text) {
        var data = parseTranslatedJson(text);
        StringI18nState.setTranslated(data);
        $("translated-preview").value = JSON.stringify(data, null, 2);
        updateTranslatedPreviewStatus();
        var status = $("translated-status");
        status.textContent = "Loaded " + Object.keys(data).length + " entries from " + file.name;
        status.className = "status-line ready";
        showMsg(
          $("export-msg"),
          "ok",
          "Loaded " + Object.keys(data).length + " translated entries."
        );
      })
      .catch(function (err) {
        showMsg($("export-msg"), "err", String(err.message || err));
      });
  }

  function bindJsonDropZone() {
    var zone = document.querySelector(".json-drop-zone");
    var dragDepth = 0;

    zone.addEventListener("dragenter", function (e) {
      e.preventDefault();
      dragDepth += 1;
      zone.classList.add("drag-over");
    });
    zone.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });
    zone.addEventListener("dragleave", function (e) {
      e.preventDefault();
      dragDepth -= 1;
      if (dragDepth <= 0) {
        dragDepth = 0;
        zone.classList.remove("drag-over");
      }
    });
    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      dragDepth = 0;
      zone.classList.remove("drag-over");
      var file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) {
        return;
      }
      if (!/\.json$/i.test(file.name) && file.type !== "application/json") {
        showMsg($("export-msg"), "err", "Please drop a JSON file.");
        return;
      }
      loadTranslatedFile(file);
    });
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
    bindJsonDropZone();

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
    bindDropZone("android");
    bindDropZone("ios");

    $("android-list").addEventListener("click", function (e) {
      var btn = e.target.closest(".file-item");
      if (!btn) {
        return;
      }
      selectFileFromList("android", btn.getAttribute("data-file-id"));
    });
    $("ios-list").addEventListener("click", function (e) {
      var btn = e.target.closest(".file-item");
      if (!btn) {
        return;
      }
      selectFileFromList("ios", btn.getAttribute("data-file-id"));
    });

    $("btn-android-clear").addEventListener("click", function () {
      StringI18nState.resetPlatform("android");
      selectedPreview.android = null;
      refreshFileLists();
      refreshSessionStatus();
    });
    $("btn-ios-clear").addEventListener("click", function () {
      StringI18nState.resetPlatform("ios");
      selectedPreview.ios = null;
      refreshFileLists();
      refreshSessionStatus();
    });

    $("btn-goto-merge").addEventListener("click", function () {
      setStep(2);
      runMerge();
    });
    $("btn-run-merge").addEventListener("click", runMerge);
    $("btn-goto-export").addEventListener("click", function () {
      setStep(3);
    });

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
      loadTranslatedFile(file);
      e.target.value = "";
    });

    $("translated-preview").addEventListener("input", updateTranslatedPreviewStatus);

    $("btn-preview").addEventListener("click", function () {
      var result = getExportResult();
      if (!result) {
        return;
      }
      renderExportPreview(result);
      showMsg(
        $("export-msg"),
        result.report.failed.length ? "warn" : "ok",
        "Preview ready: " +
          result.outputs.length +
          " file(s), written=" +
          result.report.written.length +
          " failed=" +
          result.report.failed.length +
          " skipped=" +
          result.report.skipped.length
      );
    });

    $("session-file").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) {
        return;
      }
      StringI18nZip.loadSessionZip(file)
        .then(function (session) {
          StringI18nState.loadSession(session);
          refreshSessionStatus();
          var status = $("session-status");
          status.textContent =
            "Session loaded (" + Object.keys(session.snapshots).length + " snapshots).";
          status.className = "status-line ready";
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
      var result = getExportResult();
      if (!result) {
        return;
      }
      StringI18nZip.buildOutputZip(result.outputs, result.report).then(function (blob) {
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
  refreshSessionStatus();
  updateTranslatedPreviewStatus();
})();
