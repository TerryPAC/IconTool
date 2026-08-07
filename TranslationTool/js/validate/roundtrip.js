/* global window, StringI18nPlaceholders, StringI18nUnescape, StringI18nAndroidXml, StringI18nIosStrings, StringI18nMergeEngine, StringI18nHash, StringI18nExportWriters */
(function (global) {
  "use strict";

  function assert(cond, msg) {
    if (!cond) {
      throw new Error(msg || "assertion failed");
    }
  }

  function runSelfTests() {
    var results = [];

    function test(name, fn) {
      try {
        fn();
        results.push({ name: name, ok: true, message: "" });
      } catch (err) {
        results.push({ name: name, ok: false, message: String(err.message || err) });
      }
    }

    test("android escape roundtrip with apostrophe and amp", function () {
      var decoded = "User's A & B";
      var encoded = StringI18nUnescape.encodeAndroidValue(decoded);
      var back = StringI18nUnescape.decodeAndroidValue(encoded);
      assert(back === decoded, "got " + back);
    });

    test("placeholder %% stays literal", function () {
      var n = StringI18nPlaceholders.normalizePlaceholders("100%% done %1$s");
      assert(n.normalized === "100%% done {{PH_0}}", n.normalized);
      assert(n.placeholderPattern.length === 1, "patterns");
      assert(n.placeholderPattern[0] === "%1$s", n.placeholderPattern[0]);
      assert(n.whitespacePattern.length === 0, "single spaces stay literal");
    });

    test("formatted=false skips percent formats", function () {
      var n = StringI18nPlaceholders.normalizePlaceholders("use %s literally", {
        formatted: false
      });
      assert(n.normalized === "use %s literally", n.normalized);
      assert(n.placeholderPattern.length === 0, "no patterns");
      assert(n.whitespaceTokens.length === 0, "single spaces stay literal");
    });

    test("single ascii space is not tokenized", function () {
      var n = StringI18nPlaceholders.normalizePlaceholders("Hello World");
      assert(n.normalized === "Hello World", n.normalized);
      assert(n.whitespaceTokens.length === 0, "no ws tokens");
      var multi = StringI18nPlaceholders.normalizePlaceholders("Hello  World");
      assert(multi.normalized === "Hello{{WS_0}}World", multi.normalized);
      assert(multi.whitespacePattern[0] === "  ", "two spaces tokenized");
    });

    test("android %1$s and ios %@ merge to same id", function () {
      var a = StringI18nPlaceholders.normalizePlaceholders("Hello, %1$s!");
      var b = StringI18nPlaceholders.normalizePlaceholders("Hello, %@!");
      assert(a.normalized === b.normalized, a.normalized + " vs " + b.normalized);
      assert(
        StringI18nHash.makeMergedId(a.normalized) === StringI18nHash.makeMergedId(b.normalized),
        "ids differ"
      );
    });

    test("whitespace-only differences merge and restore per platform", function () {
      var androidText = "Line1\nLine2";
      var iosText = "Line1\tLine2";
      var a = StringI18nPlaceholders.normalizePlaceholders(androidText);
      var b = StringI18nPlaceholders.normalizePlaceholders(iosText);
      assert(a.normalized === b.normalized, a.normalized + " vs " + b.normalized);
      assert(a.normalized === "Line1{{WS_0}}Line2", a.normalized);
      assert(a.whitespacePattern[0] === "\n", "android newline");
      assert(b.whitespacePattern[0] === "\t", "ios tab");

      var androidXml =
        "<resources>\n" +
        '<string name="a">Line1\\nLine2</string>\n' +
        "</resources>";
      var iosBody = '"a" = "Line1\\tLine2";\n';
      var parsedA = StringI18nAndroidXml.parseAndroidXml(androidXml, "ws.xml");
      var parsedI = StringI18nIosStrings.parseIosStrings(iosBody, "ws.strings");
      var merged = StringI18nMergeEngine.mergeAll(
        [
          {
            platform: "android",
            fileId: "ws.xml",
            rawText: androidXml,
            entries: parsedA.entries
          },
          {
            platform: "ios",
            fileId: "ws.strings",
            rawText: iosBody,
            entries: parsedI.entries
          }
        ],
        {}
      );
      assert(merged.stats.mergedCount === 1, "mergedCount=" + merged.stats.mergedCount);
      assert(merged.stats.both === 1, "both=" + merged.stats.both);
      var outputKey = merged.mergedFull[0].outputKey;
      var translated = {};
      translated[outputKey] = "[FR] " + merged.mergedSimple[outputKey];
      var exported = StringI18nExportWriters.exportPlatformFiles(
        {
          mapping: merged.mapping,
          snapshots: {
            "android/ws.xml": androidXml,
            "ios/ws.strings": iosBody
          }
        },
        translated,
        {}
      );
      assert(exported.report.fileErrors.length === 0, "fileErrors");
      assert(exported.report.failed.length === 0, "failed");
      var outA = StringI18nAndroidXml.parseAndroidXml(
        exported.outputs.filter(function (o) {
          return o.platform === "android";
        })[0].content,
        "ws.xml"
      );
      var outI = StringI18nIosStrings.parseIosStrings(
        exported.outputs.filter(function (o) {
          return o.platform === "ios";
        })[0].content,
        "ws.strings"
      );
      assert(outA.entries[0].decodedValue === "[FR] Line1\nLine2", outA.entries[0].decodedValue);
      assert(outI.entries[0].decodedValue === "[FR] Line1\tLine2", outI.entries[0].decodedValue);
    });

    test("backslash and quote differences do not merge", function () {
      var a = StringI18nPlaceholders.normalizePlaceholders('say "hi"');
      var b = StringI18nPlaceholders.normalizePlaceholders("say hi");
      assert(a.normalized !== b.normalized, "quote should keep strings distinct");
      var c = StringI18nPlaceholders.normalizePlaceholders("path\\nname");
      var d = StringI18nPlaceholders.normalizePlaceholders("pathname");
      assert(c.normalized !== d.normalized, "backslash should keep strings distinct");
    });

    test("case sensitive Continue variants are distinct", function () {
      var ids = ["Continue", "continue", "CONTINUE"].map(function (s) {
        return StringI18nHash.makeMergedId(
          StringI18nPlaceholders.normalizePlaceholders(s).normalized
        );
      });
      assert(ids[0] !== ids[1] && ids[1] !== ids[2] && ids[0] !== ids[2], ids.join(","));
    });

    test("android parse preserves order and keys", function () {
      var xml =
        '<?xml version="1.0"?>\n<resources>\n' +
        '    <string name="a">Continue</string>\n' +
        '    <string name="b">continue</string>\n' +
        '    <string name="c" translatable="false">SECRET</string>\n' +
        '    <string name="d">Hello, %1$s!</string>\n' +
        "</resources>\n";
      var parsed = StringI18nAndroidXml.parseAndroidXml(xml, "sample.xml");
      assert(parsed.entries.length === 4, "count");
      assert(parsed.entries[0].key === "a", "first key");
      var rewritten = StringI18nAndroidXml.rewriteAndroidXml(xml, [
        {
          valueStart: parsed.entries[0].valueStart,
          valueEnd: parsed.entries[0].valueEnd,
          newRawValue: "Go"
        }
      ]);
      var again = StringI18nAndroidXml.parseAndroidXml(rewritten, "sample.xml");
      assert(again.entries[0].decodedValue === "Go", again.entries[0].decodedValue);
      assert(again.entries[1].key === "b", "order");
    });

    test("source comments are removed before parsing", function () {
      var android = StringI18nAndroidXml.stripAndroidComments(
        "<resources><!-- header -->\n<string name=\"a\">A</string><!-- inline --></resources>"
      );
      var ios = StringI18nIosStrings.stripIosComments(
        "/* header */\n// line\n\"a\" = \"A // stays in value\";\n"
      );
      assert(android.indexOf("<!--") === -1, "Android comment remains");
      assert(ios.indexOf("/*") === -1 && ios.indexOf("// line") === -1, "iOS comment remains");
      assert(ios.indexOf("A // stays in value") !== -1, "comment marker in value was removed");
      assert(StringI18nAndroidXml.parseAndroidXml(android, "a.xml").entries.length === 1, "Android entries");
      assert(StringI18nIosStrings.parseIosStrings(ios, "a.strings").entries.length === 1, "iOS entries");
    });

    test("ios parse and rewrite", function () {
      var body =
        '/* header */\n"hello" = "Hello, %@!";\n"cont" = "Continue";\n';
      var parsed = StringI18nIosStrings.parseIosStrings(body, "Localizable.strings");
      assert(parsed.entries.length === 2, "count");
      var out = StringI18nIosStrings.rewriteIosStrings(body, [
        {
          valueStart: parsed.entries[1].valueStart,
          valueEnd: parsed.entries[1].valueEnd,
          newRawValue: StringI18nUnescape.encodeIosEscapes("Weiter")
        }
      ]);
      var again = StringI18nIosStrings.parseIosStrings(out, "Localizable.strings");
      assert(again.entries[0].key === "hello", "key0");
      assert(again.entries[1].decodedValue === "Weiter", again.entries[1].decodedValue);
    });

    test("merge engine skip heuristic and case split", function () {
      var androidXml =
        "<resources>\n" +
        '<string name="k1">Continue</string>\n' +
        '<string name="k2">continue</string>\n' +
        '<string name="dropbox_api_key">35vefmcjc2q2pvpxxxxxxxxxxxxxxxxxxxxxxxx</string>\n' +
        '<string name="greet">Hello, %1$s!</string>\n' +
        "</resources>";
      var iosBody = '"g" = "Hello, %@!";\n"c" = "CONTINUE";\n';
      var a = StringI18nAndroidXml.parseAndroidXml(androidXml, "a.xml");
      var i = StringI18nIosStrings.parseIosStrings(iosBody, "Localizable.strings");
      var result = StringI18nMergeEngine.mergeAll(
        [
          { platform: "android", fileId: "a.xml", rawText: androidXml, entries: a.entries },
          {
            platform: "ios",
            fileId: "Localizable.strings",
            rawText: iosBody,
            entries: i.entries
          }
        ],
        { disableHeuristic: false }
      );
      assert(result.stats.mergedCount === 4, "mergedCount=" + result.stats.mergedCount);
      assert(result.stats.both === 1, "both=" + result.stats.both);
      var skipped = result.mapping.files[0].entries.filter(function (e) {
        return e.skipped;
      });
      assert(skipped.length >= 1, "expected skip");
    });

    test("translatable false stays out unless explicitly included", function () {
      var xml =
        "<resources>" +
        '<string name="hidden" translatable="false">Hidden</string>' +
        '<string name="visible">Visible</string>' +
        "</resources>";
      var parsed = StringI18nAndroidXml.parseAndroidXml(xml, "skip.xml");
      var defaultResult = StringI18nMergeEngine.mergeAll(
        [{ platform: "android", fileId: "skip.xml", rawText: xml, entries: parsed.entries }],
        {}
      );
      var includedResult = StringI18nMergeEngine.mergeAll(
        [{ platform: "android", fileId: "skip.xml", rawText: xml, entries: parsed.entries }],
        { includeNonTranslatable: true }
      );
      assert(defaultResult.stats.mergedCount === 1, "default merged count");
      assert(defaultResult.mergedFull[0].source === "Visible", "skipped item entered merge list");
      assert(
        !Object.prototype.hasOwnProperty.call(defaultResult.mergedSimple, "hidden_1"),
        "skipped item entered simple JSON"
      );
      var exported = StringI18nExportWriters.exportPlatformFiles(
        {
          mapping: defaultResult.mapping,
          snapshots: { "android/skip.xml": xml }
        },
        defaultResult.mergedSimple,
        {}
      );
      assert(exported.report.fileErrors.length === 0, "export file error");
      var exportedEntries = StringI18nAndroidXml.parseAndroidXml(
        exported.outputs[0].content,
        "skip.xml"
      ).entries;
      assert(
        exportedEntries.length === 1 && exportedEntries[0].key === "visible",
        "skipped Android entries were written back"
      );
      assert(includedResult.stats.mergedCount === 2, "included merged count");
    });

    test("merge simple output uses compact key/value format", function () {
      var parsed = StringI18nAndroidXml.parseAndroidXml(
        "<resources><string name=\"photo\">Photo Art</string></resources>",
        "simple.xml"
      );
      var result = StringI18nMergeEngine.mergeAll(
        [{ platform: "android", fileId: "simple.xml", rawText: "", entries: parsed.entries }],
        {}
      );
      assert(!Array.isArray(result.mergedSimple), "must be an object");
      assert(result.mergedSimple.photo_art_1 === "Photo Art", JSON.stringify(result.mergedSimple));
      assert(result.mergedFull[0].outputKey === "photo_art_1", "output key");
    });

    test("merge key limits the generated base to 40 characters", function () {
      var longValue =
        "This is a deliberately very long source string that exceeds forty characters and must remain intact.";
      var parsed = StringI18nAndroidXml.parseAndroidXml(
        "<resources><string name=\"long\">" + longValue + "</string></resources>",
        "long.xml"
      );
      var result = StringI18nMergeEngine.mergeAll(
        [{ platform: "android", fileId: "long.xml", rawText: "", entries: parsed.entries }],
        {}
      );
      var outputKey = result.mergedFull[0].outputKey;
      var baseKey = outputKey.replace(/_\d+$/, "");
      assert(baseKey.length <= 40, outputKey);
      assert(/_\d+$/.test(outputKey), outputKey);
      var expectedNormalized = StringI18nPlaceholders.normalizePlaceholders(longValue).normalized;
      assert(result.mergedSimple[outputKey] === expectedNormalized, "value was truncated or changed");
    });

    return results;
  }

  global.StringI18nValidate = {
    runSelfTests: runSelfTests
  };
})(window);
