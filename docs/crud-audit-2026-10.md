<!--
SPDX-FileCopyrightText: 2026 frogQuiz contributors

SPDX-License-Identifier: MPL-2.0
-->

# CRUD audit, October 2026

Run on 2026-10-04 on branch `crud-audit` (cut from `ccr-370df3e4-c44t1l`, PR #23), against
the local e2e stack. Production was not touched. The question for every entity: who can
create, read, change and delete it, what each change leaves behind, whether the UI lets a
person do all four, and what input each write accepts.

Findings are numbered **C1 to C18** (C15 and C17 were folded into C8 and C6 while writing
this up, so those two numbers are unused) so they do not collide with the H/M/L numbers in
[`e2e-findings.md`](e2e-findings.md). **Every bug below was fixed the same day, on this
branch** (see [How each was fixed](#how-each-was-fixed)); C2 and C13 are decisions, not
bugs. The tables are kept as the record of what was wrong. Each bug was first written as a
test marked as an expected failure and checked to fail on the assertion it names; the
markers are gone now and the same tests stand as regression guards.

| Test file | What it covers |
|---|---|
| `frontend/e2e/crud-authz.e2e.ts` | who may call what: other accounts, signed out, admin, flag-off routers |
| `frontend/e2e/crud-lifecycle.e2e.ts` | files on disk, quota, rows left behind; needs the arq worker |
| `frontend/e2e/crud-account.e2e.ts` | password change and account deletion through My Account |
| `frogquiz/tests/test_ratelimit.py` | C5's rate limit (rate limiting is off in the e2e stack, so it cannot live there) |
| `frogquiz/tests/test_storage_cleanup.py` | C5's orphan sweep and C9's admin delete, which e2e cannot reach (a cron job, an admin account) |

Audit run, before the fixes: full e2e with the worker, Windows/Edge, 163 of 166 passed,
every expected failure among them. The three that failed had nothing to do with the audit: `journey-recovery`
was a Windows bug in the e2e mail sink (fixed on this branch, passes now), and
`editor-column` › moved and deleted and `practice` › end to end each failed once and
passed straight after in isolation (logged in `TODO.md`). Each expected failure was also
run with its marker switched off, to check it fails on the assertion it names and not on
setup.

## The worker was never running in e2e

`e2e/run.sh` started Postgres, Redis, Meilisearch, the API and Vite, but not the arq worker
that production runs as its own container (`docker-compose.yml`, `worker`). The worker
hashes every upload, adds its size to the owner's `storage_used`, links images to a quiz
when it is edited, and runs the two clean-up sweeps. None of that had ever run under e2e,
which is why C14, C16 and C18 went unnoticed. `run.sh` now starts it (on fakeredis through
`e2e/worker.py`, which skips arq's start-up `INFO` call that fakeredis does not support),
logs to `e2e/.data/worker.log` and leaves a pid file for `stop.sh`.

**Open question for production:** whether the worker container is actually running on the
VM. If it is, C14 and C16 are live until this branch is deployed. If it is not, no upload is ever counted against the
quota and expired anonymous quizzes are never swept. `docker compose ps` on the VM answers it.

## Findings

Severity follows `e2e-findings.md`: **High** loses data, breaks a core flow, or lets anyone
harm the service; **Medium** breaks a flow with a workaround or needs an account to abuse;
**Low** is an edge, a leak of something already public, or API-only with no UI.

| # | Sev | Finding | Where | Test |
|---|---|---|---|---|
| C5 | High | Anyone can upload without an account, with no rate limit and no quota, and an upload that never reaches a saved quiz is never cleaned up | `routers/storage.py:190`, `worker/storage.py:28` | `test_ratelimit.py` › anonymous uploads are rate limited; `test_storage_cleanup.py` › an upload no quiz uses is swept |
| C14 | Medium | Saving a **new** quiz whose image is already hashed returns 500, though the quiz is saved | `routers/editor.py:306-311` | `crud-lifecycle` › a new quiz with an image saves cleanly |
| C16 | Medium | Taking an image off a question never deletes the file or gives the bytes back | `worker/storage.py:121-128` | `crud-lifecycle` › taking an image off a question… |
| C18 | Medium | `DELETE /storage/meta/{id}` gives the quota back but never deletes the file, which stays downloadable | `routers/storage.py:329` | `crud-lifecycle` › deleting an image through the API removes the file |
| C4 | Medium | An export token opens any game's player data, not just the game it was made for; an unknown PIN is a 500 | `routers/quiz.py:333-340` | `crud-authz` › an export token only opens the game it was made for |
| C3 | Low | A quiz can use an image another account uploaded | `routers/editor.py:306`, `worker/storage.py:135` | `crud-lifecycle` › a quiz cannot use an image somebody else uploaded |
| C1 | Low | `GET /eximport/{id}` exports any quiz to any signed-in account | `routers/eximport.py:91` | `crud-authz` › another account cannot export… |
| C7 | Low | Claiming a quiz moves the quiz but not its images | `routers/quiz.py:236-239` | `crud-lifecycle` › claiming a quiz brings its images into the account |
| C8 | Low | Account deletion leaves the `storage_items` rows, and `/storage/info` and `/storage/download` answer 200 for them | `routers/users/__init__.py:518-525` | `crud-lifecycle` › after an account is deleted, its images are gone… |
| C6 | Low | The hash job raises on every anonymous upload | `worker/storage.py:75` | `crud-lifecycle` › the worker processes an anonymous upload… |
| C11 | Low | `/storage/list/last` lists deleted images | `routers/storage.py:375` | `crud-authz` › a deleted image is not listed… |
| C12 | Low | No upper bound on image alt text, the quiz list's page size, or a result note | `routers/storage.py:336`, `quiz.py:272`, `results.py:47` | `crud-authz` › image alt text…, the quiz list refuses… |
| C9 | Low | Admin delete-user skips every clean-up account deletion does | `routers/admin.py:16-28` | `test_storage_cleanup.py` › an admin deleting an account… |
| C10 | Low | `DELETE /storage/meta/{id}` deletes an image a quiz still shows | `routers/storage.py:321` | `crud-lifecycle` › an image a quiz still uses cannot be deleted… |

Two leads from planning turned out not to be bugs:

- **C2.** `GET /quiz/get/public/{id}` serves any non-expired quiz, unlisted ones included,
  with `right` on every answer. That is decision D12 in `MVP.md`: the view page hides the
  key from visitors, "presentation only: the public API still returns the answers", and an
  unlisted quiz is shareable by link on purpose. Recorded so nobody files it again.
- **C13.** There is no way to change a username or email. Email change is a recorded cut
  (`docs/mvp-scope.md`, issue #13). Username change was not mentioned anywhere; on
  2026-10-04 the call was that usernames do not change, recorded in `docs/mvp-scope.md`.

### C5. Anonymous uploads: no rate limit, no quota, no clean-up (High)

`POST /api/v1/storage/` takes uploads with no account, because the editor works without
one. For a signed-out caller there is no quota to check, and unlike `editor/start`,
`quiz/start` and `quiz/delete` there is no `rate_limit()` either. Caddy caps a single
request at 6 MB; nothing caps how many. Forty uploads in a row all answered 200.

An upload is only ever freed through a quiz: deleting the quiz, editing the image off it,
or the expired-anonymous sweep. An image that never reaches a saved quiz is never freed.
`clean_editor_images_up` (every six hours) is meant to catch exactly that, but it reads
`edit_session:{id}:images`, and nothing in the codebase writes that key. So a script
can fill the VM's disk without signing in, and nothing reclaims it.

A fix needs both halves: a per-IP limit on anonymous uploads, and a sweep for rows with no
quiz and no owner older than an hour (or recording uploads against the edit session as the
sweep expects).

### C14. A new quiz with an image answers 500 (Medium)

On the first save of a quiz, `_persist` links the quiz to its images in the request
(`quiz.storageitems.add(item)`, `editor.py:311`). That loads the `StorageItem` rows onto the
quiz object the route returns. Once the worker has hashed an image, its `hash` column is raw
bytes, and FastAPI's encoder calls `.decode()` on bytes: `UnicodeDecodeError`, 500.

The quiz row is already saved by then, so nothing is lost, but the editor shows "500" as a
failed save. The next save recovers, because the edit session was already switched to
"editing this quiz" before the link step, and the editor (autosave and the Save button
alike) only ever calls `/editor/save`. `/editor/finish` would not recover, since it ends the
session before saving, but nothing in the frontend calls it.

Who hits it: anyone whose first save carries an image, which happens when an image goes on
before the title (autosave waits for a title and one question with answers, then fires
2.5 s after typing stops). It only happens once the worker is running, which is why the e2e
suite never saw it.

### C16. Removing an image from a question frees nothing (Medium)

When a quiz is edited, the `quiz_update` job diffs old and new images and, for each removed
one, calls `new_quiz.storageitems.remove(item)` and then
`delete_storage_item_if_unreferenced`. But `new_quiz` is fetched with `Quiz.objects.get()`,
without its relations, and ormar's `remove()` checks the in-memory relation
(`ormar/relations/relation_proxy.py:278`). It raises `NoMatch`, the job catches it and
`continue`s, and the job finishes green. The image stays linked, on disk and counted.

The code comment above the call says this path is how people reclaim space, and
`docs/uploads.md` relies on it. It has never worked. Every swapped cover image costs its
full size against the 1 GiB cap for good. Deleting the whole quiz does free its images
(tested, holds).

### C18. Deleting an image through the API keeps the file (Medium)

`DELETE /api/v1/storage/meta/{id}` calls `storage.delete(storage_path)` with a string. The
method takes a list, and the local backend loops over its argument, so it tries to delete
one file per character of the name and ignores each `FileNotFoundError`. The real file
stays. The route then marks the row deleted and releases the quota anyway, and
`/storage/download` does not check `deleted_at`, so the "deleted" image is still served.
Upload, delete, repeat: the 1 GiB cap means nothing to a signed-in account.

The only UI for this route is `/edit/files`, which is hidden (`hidden_routes.ts`), so it is
reachable by API only. Every other caller of `storage.delete` passes a list.

### C4. Export tokens are not tied to their game (Medium)

The host gets an export token over the socket (`get_export_token`) for their own game's
results. `GET /quiz/export_data/{token}?game_pin=` then reads the player custom fields and
scores of whatever PIN the query string names. A host who knows or guesses another game's
six-digit PIN gets that game's player names, scores and custom fields, which can be email
addresses. An unknown PIN is a 500, because `model_validate_json(None)` is called on a
missing game. The token should carry its PIN.

### C3. Quizzes can use other accounts' images (Low)

Neither the first save nor `quiz_update` checks who uploaded an image before linking it.
Account B can put account A's image id on B's quiz. Image ids are visible to anyone who
can see A's quiz. Consequences: A cannot reclaim those bytes by deleting A's quiz while B's
still points at them, and when A deletes their account the file goes and B's quiz shows a
broken image. Nobody can delete anyone else's file this way: release is reference-counted.

### C1. `.cqa` export has no owner check (Low)

`GET /api/v1/eximport/{quiz_id}` takes the signed-in user as `_` and exports any quiz,
private and anonymous ones included, answers and images inlined. D18 made the Excel export
owner-only, and `journey-teammate` checks it on the grounds that hiding a button is not a
guard; this sibling was missed. It exposes nothing `/quiz/get/public` does not already
serve under D12, which is why it is Low. The fix is the same 404 the Excel route returns.

### C7, C8, C6, C11, C12 (Low)

- **C7.** `claim_quiz` sets the quiz's owner and clears its secret, but the images
  uploaded while anonymous keep `user = NULL`. They never count against the new owner's
  quota and are not deleted with the account.
- **C8.** Account deletion deletes the files but not the `storage_items` rows, which the
  foreign key sets to `NULL`. `/storage/info/{id}` then answers 200 from the row, and
  `/storage/download/{id}` answers 200 with an empty body, because the local backend
  yields `None` for a missing file instead of raising. Setting `deleted_at` on those rows
  in the same transaction fixes both.
- **C6.** `calculate_hash` ends with `User.objects.get_or_none(id=file_data.user.id)`, and
  an anonymous upload has no user, so the job raises `AttributeError` every time. The hash
  is saved before that line, so nothing visible breaks. A related race: if the account is
  deleted before the job runs, it fails with a `ValidationError` instead.
- **C11.** `/storage/list/last` does not filter `deleted_at`; `/storage/list` does.
- **C12.** `UpdateStorageItem.alt_text` and `.filename`, `quiz/list`'s `page_size` and
  `results/set_note`'s `note` have no upper bound. Alt text matters most: it is sent back,
  base64-encoded, in an `X-Alt-Text` header on every download, and a 100 KB alt text was
  accepted.

### C9 and C10 (Low)

- **C9.** `DELETE /api/v1/admin/user/{id,username,email}` is a bare
  `User.objects.delete(...)`. It skips everything `DELETE /users/me` does: files on disk,
  Meilisearch documents, the Redis user cache (so the deleted account keeps authenticating
  for up to 24 h) and token revocation. Only a migration can make an account admin, which
  the e2e stack cannot, so its test is a backend one that sets the flag in the database.
- **C10.** `DELETE /storage/meta/{id}` does not check whether a quiz still uses the image.
  Only the owner can call it, against their own quiz, and only through the API since
  `/edit/files` is hidden.

## How each was fixed

| # | Fix |
|---|---|
| C5 | Anonymous uploads are limited to 30 per ten minutes per address. `clean_orphaned_uploads` replaces the editor sweep: every six hours it deletes uploads more than a day old that no quiz's JSON names, so leftovers from before the C16 fix go too. The dead `edit_sessions` bookkeeping in the editor is removed. |
| C14 | The first save returns the quiz without the images it just linked. Upstream's legacy `uuid--uuid` keys, which raised there, are skipped. |
| C16 | `quiz_update` loads the quiz with its images before unlinking, and also frees a removed image that was never linked. |
| C18 | `storage.delete()` gets a list. Download, info and HEAD treat a row with `deleted_at` as gone. |
| C4 | The token stores its PIN; `export_data` answers 404 for any other PIN, or a game that no longer exists. |
| C3 | A save that adds an image another account uploaded is refused with 400. Images a quiz already had, and uploads made without an account, are still allowed. |
| C1 | `GET /eximport/{id}` is the owner's only, as the Excel export is. |
| C7 | Claiming hands the quiz's ownerless images to the claimer and counts the hashed ones; the hash job counts the rest once it runs. |
| C8 | Account deletion sets `deleted_at` on the account's uploads inside the same transaction. |
| C6 | The hash job skips the quota step for an upload with no owner, and returns early for one already deleted. |
| C11 | `/storage/list/last` filters deleted rows. |
| C12 | Alt text up to 500 characters, file name 255, a result note 2,000, `page_size` 1 to 100 (the most the UI asks for). |
| C9 | The clean-up moved out of `DELETE /users/me` into `delete_account()`, which the admin routes now call. |
| C10 | The route answers 409 while one of the owner's quizzes shows the image. |

## What held up

Tested and passing, so worth knowing before anyone "fixes" them:

- **Another account is refused** on every owner-only route: quiz get, start, delete and
  edit; Excel export; storage meta get, update and delete. All answer 404, the same as a
  quiz that does not exist.
- **Signed out**, the account routes (quiz list, storage list and limit, `/users/me`,
  sessions, results, sign-out-everywhere) answer 401.
- **Admin and moderation routes** refuse an ordinary account, and the target survives.
- **Flag-off routers** (quiztivity, box controller, ratings) answer 404.
- **Deleting a quiz** deletes its linked images from disk and gives the bytes back.
- **Deleting an account**, by API and through My Account, removes its quizzes and files,
  and its cookies stop working at once, replayed from another browser too.
- **Changing the password** through My Account signs other devices out; the old password
  stops working and the new one works.
- **The live-stats API** (`/api/v1/live/*`) checks that the API key's owner is the game's
  host.

Already covered elsewhere and not repeated here: anonymous ownership by secret
(`test_anonymous_quiz.py`, `e2e-findings.md` › What held up), logout (`test_logout.py`),
hostile and oversized quiz text (`hostile-text.e2e.ts`), malformed questions and timer
bounds (`api-edge.e2e.ts`), upload size and type limits (`uploads.e2e.ts`).

## Can a person do it in the UI?

| Thing | Create | Read | Update | Delete | Browser test |
|---|---|---|---|---|---|
| Account | Register | My Account | Password only (C13) | My Account, with password | `account`, `crud-account` |
| Session | Log in | My Account lists devices | n/a | Other devices only; Log out for this one | `account` |
| Quiz, signed in | Editor | My Quizzes, view page | Editor | My Quizzes | `journey-returning-host`, `my-quizzes` |
| Quiz, no account | Editor | My Quizzes (this browser) | Editor | My Quizzes | `my-quizzes`, `editor` |
| Claim a browser quiz | n/a | n/a | My Quizzes › Claim | n/a | `my-quizzes` |
| Image | Editor upload | On the quiz | Replace in editor | X in editor (frees the file since the C16 fix) | `uploads` |
| Live game | Play on view page | Lobby | Host controls | End or cancel | `game-exits`, `live-socket` |
| Game results | Save at the podium | `/results` is hidden (D4) | n/a | n/a | `account` |
| API key | API only, no UI | API only | n/a | API only | none |

Gaps: no email change (C13; usernames do not change, by decision); "sign out everywhere" has no button of its own,
it happens as part of a password change; API keys have no UI at all (nothing in
`frontend/src` calls `/users/api_keys`); saved game results cannot be seen while
`/results` is hidden.
