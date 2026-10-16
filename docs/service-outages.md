# Service outages

The app checks `/api/v1/health` on opening a page, once a minute while the tab is
visible, on reconnection, and when the user selects **Check connection**. Checks
have a 15-second timeout, do not overlap, and stop when the layout is destroyed.

A persistent, non-blocking banner describes a connection failure or degraded
service. Checking again does not reload the page or clear editor content. The
banner clears after a successful health response. An unavailable guest
configuration is a separate state: it offers retry rather than claiming an
account is required. Explicitly disabled guest creation still requires sign-in.

Discover distinguishes a failed examples/search request from a successful empty
result. Its Retry button reloads page data. Guest configuration retries reload the
layout data; unavailable configuration is never cached as a disabled feature.
Existing page-level server errors retain their retry action.

These messages are not an external incident monitor. The existing health endpoint
caches successful database probes for up to one hour to avoid keeping Neon awake.
It can therefore lag a new database failure. Individual failed requests still need
their own errors; a healthy banner does not prove a particular save succeeded.
The current change covers guest configuration, Discover and the shared health
banner; it is not a replacement for operation-specific save, claim or game errors.
If the frontend itself cannot load, no in-app banner can render. External uptime
alerts and database-check freshness belong to the production operations tracker
(#72). No new alert destination or production monitoring service was configured.

Browser evidence uses a local fault-injection API, not a production outage.
Regression coverage includes failure/recovery, malformed responses, disabled
guests and an editor retaining unsaved content across health checks.
