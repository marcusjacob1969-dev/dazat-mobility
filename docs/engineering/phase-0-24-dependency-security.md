# Engineering Phase 0.24 dependency-security review

## Audit result

- High vulnerabilities: **0**
- Critical vulnerabilities: **0**
- Moderate vulnerabilities: **10**
- Low vulnerabilities: **0**

The moderate chain is rooted in Expo development/native build tooling (`@expo/cli`, configuration plugins, Metro configuration, Xcode tooling and transitive `uuid`). The package manager's proposed automatic resolution is a major downgrade from the current Expo generation to Expo 46. That is not accepted because it can break the current React Native application baseline and is not a safe routine security patch.

## Controls completed

- [x] Keep the dependency graph locked.
- [x] Add a CI audit gate that fails on high or critical findings.
- [x] Preserve the current Expo baseline instead of applying an unverified major downgrade.
- [x] Record the moderate build-tool chain for review during Expo device-runtime work.

## Required before device pilot

- [ ] Re-run the audit against the then-current supported Expo SDK.
- [ ] Confirm the upstream Xcode/UUID path no longer carries the advisory or has an Expo-supported fix.
- [ ] Complete Android and iOS build/device tests before accepting any Expo major migration.
