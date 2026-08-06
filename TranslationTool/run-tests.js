#!/usr/bin/env node
/* Node harness to run browser IIFE modules + self-tests without a browser. */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var root = path.join(__dirname);
var sandbox = { console: console };
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(rel) {
  var code = fs.readFileSync(path.join(root, rel), "utf8");
  vm.runInContext(code, sandbox, { filename: rel });
}

load("js/normalize/unescape.js");
load("js/normalize/placeholders.js");
load("js/merge/filters.js");
load("js/merge/hash.js");
load("js/parsers/androidXml.js");
load("js/parsers/iosStrings.js");
load("js/parsers/iosStringsdict.js");
load("js/merge/mergeEngine.js");
load("js/export/androidWriter.js");
load("js/export/iosWriter.js");
load("js/validate/roundtrip.js");

var results = sandbox.StringI18nValidate.runSelfTests();
var failed = results.filter(function (r) {
  return !r.ok;
});

// Extra fixture round-trip
var androidXml = fs.readFileSync(path.join(root, "fixtures/android/sample_strings.xml"), "utf8");
var iosBody = fs.readFileSync(path.join(root, "fixtures/ios/Localizable.strings"), "utf8");
var a = sandbox.StringI18nAndroidXml.parseAndroidXml(androidXml, "fixtures/android/sample_strings.xml");
var i = sandbox.StringI18nIosStrings.parseIosStrings(iosBody, "fixtures/ios/Localizable.strings");
var merged = sandbox.StringI18nMergeEngine.mergeAll(
  [
    {
      platform: "android",
      fileId: "fixtures/android/sample_strings.xml",
      rawText: androidXml,
      entries: a.entries
    },
    {
      platform: "ios",
      fileId: "fixtures/ios/Localizable.strings",
      rawText: iosBody,
      entries: i.entries
    }
  ],
  {}
);

var translated = {};
Object.keys(merged.mergedSimple).forEach(function (key) {
  translated[key] = "[FR] " + merged.mergedSimple[key];
});

var session = {
  mapping: merged.mapping,
  snapshots: {
    "android/fixtures/android/sample_strings.xml": androidXml,
    "ios/fixtures/ios/Localizable.strings": iosBody
  }
};

var exported = sandbox.StringI18nExportWriters.exportPlatformFiles(session, translated, {});
if (exported.report.fileErrors.length) {
  failed.push({
    name: "fixture export fileErrors",
    ok: false,
    message: JSON.stringify(exported.report.fileErrors)
  });
}
if (exported.report.failed.length) {
  failed.push({
    name: "fixture export failed entries",
    ok: false,
    message: JSON.stringify(exported.report.failed.slice(0, 5))
  });
}
if (exported.outputs.length !== 2) {
  failed.push({
    name: "fixture export outputs",
    ok: false,
    message: "expected 2 outputs got " + exported.outputs.length
  });
} else {
  var outAndroid = exported.outputs.find(function (o) {
    return o.platform === "android";
  });
  var outIos = exported.outputs.find(function (o) {
    return o.platform === "ios";
  });
  if (outAndroid.content.indexOf("<!--") !== -1 || outIos.content.indexOf("// trailing comment") !== -1) {
    failed.push({
      name: "export removes source comments",
      ok: false,
      message: "comments remained in exported files"
    });
  }
  var parsedOut = sandbox.StringI18nAndroidXml.parseAndroidXml(outAndroid.content, outAndroid.fileId);
  var expectedAndroidEntries = merged.mapping.files
    .filter(function (f) {
      return f.platform === "android";
    })[0]
    .entries.filter(function (entry) {
      return !entry.skipped;
    });
  if (parsedOut.entries.length !== expectedAndroidEntries.length) {
    failed.push({
      name: "android key count",
      ok: false,
      message: parsedOut.entries.length + " vs " + expectedAndroidEntries.length
    });
  }
  for (var idx = 0; idx < expectedAndroidEntries.length; idx += 1) {
    if (parsedOut.entries[idx].key !== expectedAndroidEntries[idx].key) {
      failed.push({
        name: "android key order",
        ok: false,
        message: "at " + idx
      });
      break;
    }
  }
}

// Real photoart smoke (parse + merge only)
var photoartPath = path.join(root, "../../photoart/src/main/res/values/strings.xml");
if (fs.existsSync(photoartPath)) {
  var pa = fs.readFileSync(photoartPath, "utf8");
  var paParsed = sandbox.StringI18nAndroidXml.parseAndroidXml(pa, "photoart/strings.xml");
  var paMerged = sandbox.StringI18nMergeEngine.mergeAll(
    [{ platform: "android", fileId: "photoart/strings.xml", rawText: pa, entries: paParsed.entries }],
    {}
  );
  console.log(
    "photoart strings: parsed=" +
      paParsed.entries.length +
      " merged=" +
      paMerged.stats.mergedCount +
      " skipped=" +
      paMerged.stats.androidSkipped
  );
}

console.log("self-tests: " + results.length + ", fixture merged=" + merged.stats.mergedCount);
if (failed.length) {
  console.error("FAILED:");
  failed.forEach(function (f) {
    console.error(" - " + f.name + ": " + f.message);
  });
  process.exit(1);
}
console.log("ALL OK");
