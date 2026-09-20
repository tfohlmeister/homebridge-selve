# Contributing

Use the Node 24 LTS patch in `.node-version` and the pnpm version pinned in `package.json`. Corepack or `pnpm/action-setup` can install that pnpm version. pnpm does not select it on its own: `pmOnFail: ignore` in `pnpm-workspace.yaml` keeps pnpm's self-management pin out of `pnpm-lock.yaml`, because GitHub's dependency graph reads only the first YAML document of the lockfile and would otherwise miss every project dependency.

```sh
pnpm install --frozen-lockfile
pnpm check
```

`check` runs lint, a strict TypeScript build, regression tests with coverage, the Homebridge startup/shutdown smoke test, and package validation. The smoke test uses a temporary bridge identity and a nonexistent USB path; it does not operate real shutters. Homebridge's five-second shutdown fallback is accepted and reported explicitly, rather than described as clean teardown.

## Tests and supported versions

Tests use Node's built-in runner and the HAP implementation shipped with the Homebridge version under test. Add regressions for observable failures, especially serial ordering, cancellation, reconnects, missing replies and HomeKit state.

CI tests current Node 22 and 24 patches against Homebridge 1.8.0 and the latest 2.x, plus Node 26 against the latest Homebridge 2.x. Node 26 requires Homebridge 2.3 or newer. Keep this compatibility contract when changing tool versions; raising the minimum supported runtime requires a major plugin release.

The Quality job tests the exact committed lockfile on Node 24. It enforces at least 90% line, 85% branch and 90% function coverage for compiled plugin code. `coverage/lcov.info` is uploaded as an Actions artifact. Do not lower thresholds to make a change pass. Hardware behavior still needs a real gateway test.

Dependabot checks npm/pnpm dependencies and GitHub Actions weekly. Minor and patch updates are grouped; majors stay separate for compatibility review. TypeScript stays on 6.x until typescript-eslint supports TypeScript 7's compiler API. Revisit that exception when updating the linter. Keep `.node-version` on the current supported Node 24 LTS patch; the runtime matrix also tests the latest patches automatically. A weekly dependency audit detects new advisories even when no code changes.

## Pull requests

Use a focused branch and describe the user-visible change and validation. An approving review and the required CI checks are needed before merging. Never publish as part of a dependency update or ordinary merge.

## Releases

For 3.0.0, wait for Mateusz's physical USB unplug/replug confirmation on PR #22 before creating a release. Confirm automatic recovery without restarting Homebridge or sending a HomeKit command to trigger recovery, subsequent movement and stop, and no unexpected delayed movement after an interrupted command. This is a maintainer decision, not an automated hardware-test gate.

1. Update `package.json` and `CHANGELOG.md` through a reviewed PR. Test the exact release candidate on hardware when runtime behavior or dependencies change.
2. After merge and green CI, create a GitHub release tagged `v<package version>`. Publishing the release reruns the same compatibility and quality workflow.
3. `publish.yml` builds and stages the tarball using npm Trusted Publishing (OIDC). Stable releases use `latest`; prereleases use `next`. The package is **not public yet**.
4. An npm owner inspects the staged version and approves it with 2FA using `pnpm stage approve <stage-id>`. Check package contents, version and provenance on the first release. No workflow performs this approval automatically.

The npm Trusted Publisher must name owner `tfohlmeister`, repository `homebridge-selve`, and workflow `publish.yml`. Keep direct publishing disabled; no GitHub environment or stored npm token is needed.

`main` is protected. It requires one approving review, an up-to-date branch, and the checks `Quality`, `Analyse`, `test (22.x, 1.8.0)`, `test (22.x, 2.x)`, `test (24.x, 1.8.0)`, `test (24.x, 2.x)` and `test (26.x, 2.x)`. A new push dismisses stale approvals. The repository stores no npm token; publishing authenticates through Trusted Publishing alone. These settings live in the repository configuration rather than in the versioned workflows, so renaming a job means updating them there as well.

Run the **Publish** workflow manually for a full compatibility, packaging and staging dry run. A manual run never uploads a package to npm. It cannot verify the registry-side OIDC configuration or provenance of a real publication.
