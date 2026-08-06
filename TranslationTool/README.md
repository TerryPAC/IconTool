# String i18n Merge Tool

Local browser tool to merge Android and iOS source strings into one JSON for backend translation, then write translations back while preserving keys and order.

## Open

- Preferred: open `index.html` directly (`file://`) — works offline if `vendor/jszip.min.js` is present.
- Or serve this folder with any static server:

```bash
cd tools/string-i18n-merge
python3 -m http.server 8765
# open http://localhost:8765
```

## Workflow

1. **Import** Android XML (`strings.xml` and any XML containing `<string>`) and/or iOS `.strings` files. Use multi-select or folder upload.
2. **Merge** → download **`session.zip`** (required for write-back) and **`merged.simple.json`** (send to backend).
3. Backend fills `translation` for each row (**keep `id` and `{{PH_n}}` tokens**).
4. **Export**: upload `translated.json` + `session.zip` → download `output.zip`.

## Backend JSON contract

Input / output array:

```json
[
  { "id": "v1_a1b2c3d4", "source": "Hello, {{PH_0}}!", "translation": "Bonjour, {{PH_0}}!" }
]
```

Rules:

- Do **not** change `id`.
- Preserve every `{{PH_n}}` token (count and order).
- One JSON file = one target language.
- Case matters: `Continue` / `continue` / `CONTINUE` are three separate rows.

## Merge rules (Phase A)

- Deduplicate by **case-sensitive** placeholder-normalized source text.
- Do **not** trim whitespace; do not normalize curly apostrophes.
- `%%` stays literal (not a placeholder token).
- Android `formatted="false"`: `%...` is not treated as format placeholders.
- Default skip: `translatable="false"`, empty values, `@string/...`, heuristic secrets/URLs/emails/numbers (toggleable).

## What to upload from PhotoArt

Source language files only, for example:

- `photoart/src/main/res/values/strings.xml`
- `common_libs_android/mydealslib/src/main/res/values/strings.xml`

Do **not** upload already-translated folders like `values-de/` as source unless you intentionally want those texts as the merge base.

Flavor-specific trees (`mydealslib/src/free`, `us_fla`, …) are optional — choose what your release needs.

## Output

`output.zip` contains:

- `android/<values-xx>/...` rewritten XML
- `ios/<xx.lproj>/...` rewritten `.strings`
- `report.json` (written / failed / skipped)

Folder names are labels only; keys inside files are unchanged.

## Self-tests

On step 1, click **Run self-tests**.

## Known limitations (MVP / Phase A)

- No Android `<plurals>` / `<string-array>` write path yet (files with only those yield 0 `<string>` entries).
- No iOS `.stringsdict` / `.xcstrings`.
- Same normalized value always merges (homographs share one translation).

## Fixtures

See `fixtures/android/sample_strings.xml` and `fixtures/ios/Localizable.strings`.
