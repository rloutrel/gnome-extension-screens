# Screens

A GNOME Shell extension to monitor and control screens (displays) from the
top bar. It targets **GNOME Shell 50/51** (ESM imports
`resource:///org/gnome/shell/...`).

## What's in the box

- **GNOME Shell 50/51 skeleton** — ESM imports, `extension.js` lifecycle
  only, `indicator.js` (PanelMenu listing connected screens from
  `global.display`), `prefs.js` (GTK4/Adwaita), GSettings schema,
  theme-aware `stylesheet.css`, `logger.js`.
- **Pure vs GJS module architecture** — domain logic lives in pure modules
  with zero GJS imports, unit-tested under plain Node (see `AGENTS.md`).
- **No build step** — no bundler, no transpiler; source files are shipped
  as-is.
- **Test pipeline** — Node built-in test runner (no framework, no runtime
  dependencies), ESLint 9 flat config, `node --check` syntax checks,
  `metadata.json` validation, coverage (lcov).
- **CI (GitHub Actions)**:
  - `test.yml` — lint, syntax, metadata validation, unit tests, coverage artifact.
  - `release.yml` — on `v*` tags: schema validation, translation compilation,
    zip packaging, zip structure validation, attach to the GitHub release.
  - `codeql.yml` — CodeQL JavaScript analysis.
  - SonarCloud-ready via `sonar-project.properties`.
- **i18n scaffolding** — `po/` with `POTFILES` and `LINGUAS`, gettext domain
  wired in `metadata.json`, translations compiled at release time.
- **AI-agent tooling** — `AGENTS.md`, `.github/agents/`, `.github/skills/`
  (GJS/GTK4 practices, Shell 50/51 migration, knowledge cache, runtime
  validation) and a GJS runtime MCP server (`.github/mcp/`).

## Installing (development / manual)

1. Copy or symlink the extension folder into your GNOME Shell extensions
   directory:

   ```bash
   cp -r screens@rloutrel.github.com \
       ~/.local/share/gnome-shell/extensions/
   ```

   Or symlink it for development (edits are picked up on reload):

   ```bash
   ln -s "$PWD/screens@rloutrel.github.com" \
       ~/.local/share/gnome-shell/extensions/screens@rloutrel.github.com
   ```

2. Compile the GSettings schema (required by the preferences process;
   `gschemas.compiled` is gitignored, so this stays a local artifact):

   ```bash
   glib-compile-schemas screens@rloutrel.github.com/schemas/
   ```

3. Restart GNOME Shell (`Alt+F2` → `r` → `Enter` on X11, or log out and back
   in on Wayland).
4. Enable the extension:

   ```bash
   gnome-extensions enable screens@rloutrel.github.com
   ```

## Template sync

This project was derived from
[`rloutrel/gnome-extension-template`](https://github.com/rloutrel/gnome-extension-template)
and tracks absorbed upstream changes with a `.template-sync.json` manifest
and `template/v*` tags. See
[`TEMPLATE_SYNC.md`](TEMPLATE_SYNC.md) for the tag convention, the manifest
format and both sync procedures (template → consumer and backport).

## Repository layout

```text
screens@rloutrel.github.com/
  extension.js       # GNOME Shell entry point: enable/disable lifecycle only
  indicator.js       # Panel indicator: menu construction, polling
  logger.js          # Unified debug/warn/error + notification helpers
  prefs.js           # Preferences window (separate GTK4/Adwaita process)
  screens.js         # PURE: screen descriptors + label formatting (Node-tested)
  stylesheet.css     # Theme-aware styles (no hardcoded colors)
  metadata.json      # Shell version, UUID, version
  schemas/           # GSettings schema
po/                  # Translation sources (gettext): POTFILES, LINGUAS
test/                # Unit tests (Node built-in runner) + metadata validation
.github/workflows/   # CI: test, release packaging, CodeQL
.github/agents/      # AI coding-agent definition
.github/skills/      # AI skills (GJS practices, migration, validation)
.github/mcp/         # GJS runtime MCP server
```

## Testing

Pure modules are unit-tested with Node's built-in test runner — no test
framework, no dependencies:

```bash
node --test "test/"*.test.js
```

`extension.js`, `indicator.js` and `prefs.js` run inside GNOME Shell (GJS) and
cannot be unit-tested outside it; check them for syntax only with
`node --check`. The full CI check set is in `.github/workflows/test.yml`.

## License

GPL-2.0 — see [LICENSE](LICENSE).
