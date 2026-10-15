<!-- SPDX-FileCopyrightText: 2026 frogQuiz contributors -->
<!-- SPDX-License-Identifier: MPL-2.0 -->

# Production access through GitHub Actions

The **Production guest access** workflow connects to the existing Oracle VM over
SSH. It runs only when manually dispatched from `master`; a push or pull request
never deploys. Merge the workflow before it appears under Actions.

## One-time setup

In repository **Settings → Environments**, create `production`. Restrict it to
`master`; add a required reviewer if your GitHub plan supports it.

Add these environment secrets (repository Actions secrets also work):

| Secret | Value |
| --- | --- |
| `SSH_HOST` | The VM's public IP or hostname |
| `SSH_USER` | `ubuntu` for the current Ubuntu VM |
| `SSH_PRIVATE_KEY` | An unencrypted private deployment key, with its public key already authorized on the VM |
| `SSH_KNOWN_HOSTS` | A verified known_hosts entry for SSH_HOST on port 22 |

A key cannot be recovered using the instance OCID. If the original key is lost,
establish administrator access to the VM and install a new public key first.
Never put the private key in an issue, commit, workflow input, or chat.

Get the server host key through a trusted VM console, for example
`sudo cat /etc/ssh/ssh_host_ed25519_key.pub`. Construct the known_hosts entry as
`HOST ssh-ed25519 BASE64_PUBLIC_KEY`. Verify it through that trusted channel;
do not blindly trust a key obtained with ssh-keyscan over the network.

The VM must permit SSH from the runner. Standard GitHub-hosted runners do not
have one fixed source IP. If your firewall requires a narrow source allowlist,
use a runner with static egress or a suitably protected self-hosted runner;
do not open SSH to all addresses just to make the workflow pass.

The SSH user needs Docker Compose access and write access to the installation's
`.env`. Docker access is effectively administrator access: use a dedicated key,
keep this environment restricted, and revoke the key when it is no longer needed.

## Check first

Open **Actions → Production guest access → Run workflow**. Select `master`, mode
`check`, and the absolute deployment directory containing the existing `.env`
and `docker-compose.yml` (for example `/home/ubuntu/frogQuiz`, only if that is
the actual installation path). It checks SSH, Compose, the two services, and the
effective guest setting without changing the VM.

The path currently supports letters, numbers, underscores, dots, slashes, and
hyphens. SSH is on port 22. A passphrase-protected key is not supported by this
non-interactive workflow.

## Repair guest access

Run mode `repair` only after the connection check passes, during a window when
no live games are running: recreating the API interrupts active sessions.

This is a targeted repair for #69, not a general release pipeline. It downloads
the backend `master` image and refuses to proceed unless its revision label
matches the tested #67 merge, `b72a3e25305ff34e67012a88961bb7d8490eb7a2`.
If the tag has advanced, review the newer release and update the pinned revision
in a reviewed change. Do not bypass the check.

The script preserves the existing Compose selection (including a Neon override
selected by `COMPOSE_FILE` in `.env`). It backs up `.env` and the current API/worker
image IDs, enables guests, checks the resolved Compose values, and recreates only
API and worker. It does not update the VM checkout, migrate the database, or
restart the database, storage, Redis, or proxy. An incompatible Compose file
must be reviewed and updated separately.

The runner then checks the public config and examples endpoints without cookies.
Both must pass, and the examples list must contain at least one quiz. An empty
catalog requires separate example setup; the workflow does not seed production.

## Failures and rollback

Backups are private `.guest-access-backup.*` directories in the installation.
Do not upload them as artifacts; `.env` contains credentials. The run prints
the backup directory before recreating containers.

There is no automatic rollback after restart: a failed public check can mean a
network problem or empty examples, and does not prove that the image is broken.
Inspect container health first. To roll back, restore `.env` from the recorded
backup and recreate API/worker using the respective image IDs recorded in
`api.image` and `worker.image`, via a temporary Compose override. Preserve the
original Compose files and Neon settings. Old images are not pruned by this workflow.

An endpoint check is not an end-to-end test. Before closing #69, verify signed-out
scratch creation, Excel import, editing, hosting, and Discover template copying
in a fresh browser and capture the actual screens.
