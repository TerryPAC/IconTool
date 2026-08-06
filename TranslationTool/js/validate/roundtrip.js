/* global window, StringI18nPlaceholders, StringI18nUnescape, StringI18nAndroidXml, StringI18nIosStrings, StringI18nMergeEngine, StringI18nHash */
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
    });

    test("formatted=false skips percent formats", function () {
      var n = StringI18nPlaceholders.normalizePlaceholders("use %s literally", {
        formatted: false
      });
      assert(n.normalized === "use %s literally", n.normalized);
      assert(n.placeholderPattern.length === 0, "no patterns");
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

    return results;
  }

  global.StringI18nValidate = {
    runSelfTests: runSelfTests
  };
})(window);
