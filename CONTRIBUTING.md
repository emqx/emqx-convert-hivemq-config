# Contributing

Use Node.js 22+ and the pnpm version pinned in `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Conversion logic belongs in `src/converters/`; the CLI and HTTP API share `ConversionService`. Return migration warnings through the converter's warning callback so they reach every interface. Keep input values out of console logs and use the HOCON generator to escape output.

For a behavior change, add a focused test under `test/`. If it affects generated EMQX settings, include a synthetic XML example in `test/emqx-inputs.txt` and run the Docker integration suite. Document limitations rather than silently treating unsupported settings as equivalent.

Before opening a pull request:

```bash
pnpm format
pnpm type-check
pnpm test
pnpm test:emqx
```

Do not commit real broker configurations, credentials, certificate/private key files, generated HOCON or test logs. Use a minimal redacted input when reporting a bug, together with the converter/Node.js version, expected output and actual diagnostics.
