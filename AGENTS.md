# Workout Coach Project Instructions

## Structure

- `apps/web/` contains the runnable browser app.
- `apps/web/src/` contains app source code and `apps/web/public/` contains browser assets.
- `packages/` is reserved for code that is shared by a second app or runtime.
- `docs/` contains product, architecture, design, development, decision, and status documents.
- `scripts/` and `tests/` contain repository-level build and verification tooling.

## Rules

- Read `docs/00_INDEX.md` and `docs/07_STATUS/CURRENT.md` before making a meaningful change.
- Read the related product, architecture, design, and development documents before changing behavior.
- Do not move files without checking package, test, build, and deployment paths.
- Keep app-only code inside `apps/web/`; move code to `packages/` only when another app needs it.
- Treat `docs/07_STATUS/INBOX.md` as unconfirmed ideas. Implement confirmed requests and items listed in `NEXT.md`.

## Documentation

- Update `docs/07_STATUS/CURRENT.md` when the actual project state changes.
- Record completed work and verification in `docs/07_STATUS/WORKLOG.md`.
- Record important technical choices in `docs/06_DECISIONS/`.
- Update the related feature or architecture document when behavior or structure changes.

## Validation

- Run the relevant unit tests, browser checks, and GAS build after meaningful changes.
- Keep local browser verification and real mobile verification clearly separated.
