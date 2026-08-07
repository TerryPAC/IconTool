# Verification checklist

Run:

```bash
cd tools/string-i18n-merge
node run-tests.js
```

Expected:

- All built-in self-tests pass
- Fixture merge + export keeps Android/iOS key order
- photoart `strings.xml` parses (~1170 entries)

Manual UI check:

1. Open `index.html`
2. Click **Run self-tests** → all green
3. Import `fixtures/android/sample_strings.xml` + `fixtures/ios/Localizable.strings`
4. Merge → download `session.zip` + `merged.simple.json`
5. Fake-translate (prefix each value with `[FR] `, keep `{{PH_n}}` and `{{WS_n}}`)
6. Upload translated JSON + session → export `output.zip`
7. Confirm the archive root contains `sample_strings.xml`, `Localizable.strings`, and `report.json` with no platform folders
8. Confirm keys/order match sources; `Continue`/`continue`/`CONTINUE` remain distinct
