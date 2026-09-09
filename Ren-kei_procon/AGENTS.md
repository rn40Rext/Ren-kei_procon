# Expo changes between SDK versions

This app uses the Expo SDK version pinned in `package.json` (`expo` dependency) —
currently `^54`. Before writing any code, check that version and read the matching
docs at `https://docs.expo.dev/versions/v<N>.0.0/` (replace `<N>` with the major
version from `package.json`). Do not hardcode a version number here — it will go
stale the next time the SDK is upgraded (this file previously pointed to v57,
which was never the version actually installed; see [#55](../../issues/55)).
