<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# Security alert review — 16 October 2026

Review of the four CodeQL alerts and one secret-scanning alert shown on `master`.
A successful analysis job means the analysis ran; it does not mean all stored alerts
are closed. Do not dismiss the entire selection together.

| Alert | Assessment and action |
| --- | --- |
| CodeQL #1, local storage path expression | Added one filename boundary for download, upload, size and delete. Rejects parent/absolute/nested paths, backslashes, NULs and symlinks resolving outside the configured directory. Tests check that an outside file cannot be read, overwritten or deleted, while normal storage still works. |
| CodeQL #2 and #3, incomplete HTML sanitization | Replaced regex-based HTML removal with `sanitize-html` and an explicit toolbar-tag allowlist with no attributes. Used parser-based plain-text extraction too. Malformed/nested markup, active attributes, script/style content, encoded text and SSR execution are covered by unit tests. |
| CodeQL #4, guest capability in browser storage | The finding describes an intentional product tradeoff, not a false claim that the value is non-sensitive. Guests need a persistent per-quiz bearer credential to reopen, edit, host, delete and claim without an account. Anyone who can read this browser's origin storage can use it. Same-origin script execution/XSS, extensions or access to the browser profile can expose it. Browser-side encryption with a locally available key does not remove that risk. Keep the finding as accepted risk (`won't fix`) for the current guest model, with this explanation; a server-side guest session with HttpOnly cookies would be a separate auth redesign and needs legacy ownership migration and claim/retry coverage. |
| Secret scanning #1, historical Mapbox token | The value in the historical Dockerfile has Mapbox's `pk.` public client-token prefix, not `sk.` secret-token prefix. It is absent from the current Dockerfile. Classify this particular secret-type finding as a false positive. Public tokens can still incur usage charges; upstream ownership, URL restrictions, activity and revocation have not been verified. No claim that it was rotated. |

Guest capabilities are random 256-bit values; the server stores their hashes,
checks quiz expiry and ownership, excludes them from public responses, and invalidates
them on claim or deletion. The client clears its local copy on successful claim/deletion.
The live production CRUD check confirmed another anonymous browser could not delete a
quiz without its capability. These protections limit authority and lifetime; they do not
encrypt localStorage or protect against XSS in the same origin.

## Full-history scan

Run `38842139956` found nine occurrences in inherited 2022–2024 commits. Five are
confirmed public client tokens/site keys or the documented MinIO playground fixture;
only their exact fingerprints were added to `.gitleaksignore`. No entire file or rule
was excluded.

Four occurrences remain unresolved: a historical signing key and a commented hCaptcha
credential, each in two commits. They were not added to the allowlist. Verify production
signing-key independence and credential ownership/revocation through the operations
tracker. An absent literal in current source is not evidence that an old deployment
never used it. No private values are reproduced in this report.

## GitHub access limitation

The integration returned HTTP 403 `Resource not accessible by integration` when listing
or updating code-scanning and secret-scanning alerts. Source fixes can be reviewed and
analyzed, but the integration cannot manually dismiss #4 or resolve the Mapbox alert.
A repository security administrator must apply the individual dispositions above.
The three code fixes should be rechecked against the default branch's next analysis;
do not call the stored alerts resolved merely because a PR's CodeQL job passes.

## Guest storage decision — 16 October 2026

The maintainer explicitly chose to retain the current guest ownership storage after
reviewing the persistence versus HttpOnly-session tradeoff. No browser encryption,
authentication migration or source suppression was added. Alert #4 remains an
accepted product risk; GitHub alert disposition still requires security-admin access.
