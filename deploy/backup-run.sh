#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
# SPDX-License-Identifier: MPL-2.0
#
# Runs on the GitHub runner (.github/workflows/backup.yml): pulls the database and the
# uploads from the VM, part by part, and encrypts each as it arrives. Plaintext only ever
# exists in the pipe. The repo is public and so are its artifacts' names; the contents
# are readable only with the private key that matches deploy/backup-recipient.txt.
#
#   backup-run.sh OUT_DIR DEPLOY_DIR
#   REMOTE  the command that runs a script read from stdin on the VM, with arguments
#           appended. The workflow passes its ssh command; the test passes `bash -s --`.
set -euo pipefail

out=${1:?usage: backup-run.sh OUT_DIR DEPLOY_DIR}
deploy_dir=${2:?usage: backup-run.sh OUT_DIR DEPLOY_DIR}
here=$(cd -- "$(dirname -- "$0")" && pwd)
recipients=${BACKUP_RECIPIENTS:-$here/backup-recipient.txt}
read -r -a remote <<<"${REMOTE:?set REMOTE to the command that runs a script on the VM}"
mkdir -p -- "$out"

# Anything else on the stream (a login banner, a shell rc file's echo, a docker warning)
# would still encrypt into a file that looks fine and cannot be restored. A custom-format
# dump starts with PGDMP, and a tar has "ustar" at byte 257. Checked in memory, before
# encrypting; nothing is written to disk.
check_stream() {
  python3 -c '
import sys
part = sys.argv[1]
src, dst = sys.stdin.buffer, sys.stdout.buffer
head = b""
while len(head) < 512:
    chunk = src.read(512 - len(head))
    if not chunk:
        break
    head += chunk
ok = head.startswith(b"PGDMP") if part == "db" else head[257:262] == b"ustar"
if not ok:
    sys.stderr.write(f"::error::The {part} stream is not a {part} backup (something else wrote to it).\n")
    sys.exit(1)
dst.write(head)
while chunk := src.read(1 << 20):
    dst.write(chunk)
' "$1"
}

# The database first: an image uploaded after the dump is an orphan the app ignores,
# while an image deleted before the tar would be a quiz with a missing picture.
for part in db uploads; do
  file="$out/$part.age"
  if ! "${remote[@]}" "$deploy_dir" "$part" <"$here/backup.sh" | check_stream "$part" |
    age --encrypt -R "$recipients" -o "$file"; then
    rm -f -- "$file"
    echo "::error::The $part backup failed; nothing was kept." >&2
    exit 1
  fi
  # age's own header is about 200 bytes: anything that small carried no data.
  size=$(stat -c %s "$file")
  if (( size < 1024 )); then
    rm -f -- "$file"
    echo "::error::The $part backup is $size bytes, too small to hold anything." >&2
    exit 1
  fi
done

{
  echo "created_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "source_dir=$deploy_dir"
  echo "recipient=$(grep -v '^#' "$recipients" | head -n1)"
  for part in db uploads; do
    echo "$part.age bytes=$(stat -c %s "$out/$part.age") sha256=$(sha256sum "$out/$part.age" | cut -d' ' -f1)"
  done
} >"$out/MANIFEST.txt"
cat "$out/MANIFEST.txt"
