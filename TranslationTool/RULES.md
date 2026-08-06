# TranslationTool Rules

This document is the maintenance source of truth for TranslationTool input, merge, translation, and export behavior. Update it when the implementation changes.

## 1. Supported files

- Android: `<string>` entries in XML files.
- iOS: `"key" = "value";` entries in `.strings` files.
- Android `<plurals>` and `<string-array>` write-back is not supported yet.
- iOS `.stringsdict` and `.xcstrings` are not supported.

## 2. Import and comments

- Android accepts `strings.xml` and other XML files containing `<string>`.
- iOS accepts `.strings` files.
- The following comments are removed immediately after import:
  - Android XML: `<!-- ... -->`
  - iOS: `// ...` and `/* ... */`
- Comment-like text inside string values is preserved, for example iOS `"URL: https://example.com/a//b"`.
- The comment-free content is used for:
  - file previews;
  - snapshots;
  - merging;
  - final write-back.
- Exported files contain no source comments.

## 3. Merge rules

- Deduplication uses placeholder-normalized source text and is case-sensitive.
- Leading and trailing whitespace is preserved.
- Curly apostrophes are not normalized.
- `%%` is always treated as literal text, not a placeholder.
- Android `formatted="false"` disables `%...` format placeholder detection.
- Generated translation keys follow these steps:
  1. Convert the source text to lowercase.
  2. Replace runs of non-alphanumeric characters with `_`.
  3. Limit the base key to 40 characters.
  4. Append the 1-based merged order.
- `Continue`, `continue`, and `CONTINUE` are three distinct entries.
- Equivalent Android and iOS format placeholders are normalized together, such as Android `%1$s` and iOS `%@`.

## 4. Default skip rules

The following entries are skipped by default:

- Android entries with `translatable="false"`;
- empty values;
- `@string/...` references;
- values heuristically identified as secrets, URLs, email addresses, or numbers.

Advanced options can:

- enable `Include translatable="false"` to merge non-translatable Android entries;
- enable `Disable secret/URL/number heuristic skip` to disable heuristic filtering.

During Android localized export, skipped entries are omitted from the localized file so they fall back to the default `values` resources. They remain in the source snapshot and `skipped.json` report.

## 5. Translation JSON rules

`merged.simple.json` is the compact key/value file sent to the translation backend:

```json
{
  "hello_ph_0_1": "Bonjour, {{PH_0}}!"
}
```

- One JSON file represents one target language.
- Every `{{PH_n}}` placeholder must be preserved with the same count and order.
- Generated translation keys must not change.
- When a translation value is empty:
  - with `Empty translation falls back to source` enabled, the source text is written back;
  - with it disabled, the entry fails and is recorded in the failure report.

## 6. Export rules

- `session.zip` must be used with `translated.json` because it contains the mapping and source snapshots.
- Before writing, the exporter validates the snapshot content hash, entry count, key order, and entry type.
- An entry is not written when placeholder validation fails.
- Key and order are validated again after writing.
- `output.zip` contains:
  - rewritten Android XML / iOS `.strings` files;
  - `report.json` with written, failed, skipped, and fileErrors results.
- Output files are written at the archive root; duplicate file names receive a numeric suffix.

