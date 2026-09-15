# SPDX-FileCopyrightText: 2026 frogQuiz contributors
#
# SPDX-License-Identifier: MPL-2.0

"""Which entry of X-Forwarded-For the rate limiter keys on.

Get this wrong to the right and every user shares one bucket, so a limit of five
an hour locks out the whole deployment at once. Get it wrong to the left and the
key is caller-supplied and the limiter is bypassable. Neither failure is visible
until it matters, hence the table.
"""

import pytest

from frogquiz.helpers.ratelimit import client_ip


class _FakeClient:
    def __init__(self, host):
        self.host = host


class _FakeRequest:
    def __init__(self, forwarded=None, peer="10.0.0.1"):
        self.headers = {} if forwarded is None else {"X-Forwarded-For": forwarded}
        self.client = _FakeClient(peer)


@pytest.mark.parametrize(
    "forwarded,hops,expected",
    [
        # One proxy (the bundled Caddy): the entry it appended is the client.
        ("203.0.113.9", 1, "203.0.113.9"),
        # A forged chain cannot move the entry Caddy itself wrote.
        ("1.1.1.1, 203.0.113.9", 1, "203.0.113.9"),
        # Two proxies (a CDN in front of Caddy): the last is the CDN's egress
        # address, identical for every user. Stepping back one reaches the client.
        ("203.0.113.9, 198.51.100.7", 2, "203.0.113.9"),
        # More hops configured than the chain has: clamp rather than wrap round to
        # the far end, which would key every request on the same forged value.
        ("203.0.113.9", 4, "203.0.113.9"),
        # 0 and negatives are meaningless; treat them as one hop.
        ("1.1.1.1, 203.0.113.9", 0, "203.0.113.9"),
        # Whitespace and empty entries are not addresses.
        ("  1.1.1.1 ,, 203.0.113.9  ", 1, "203.0.113.9"),
    ],
)
def test_client_ip_picks_the_configured_hop(monkeypatch, forwarded, hops, expected):
    monkeypatch.setattr(
        "frogquiz.helpers.ratelimit.settings",
        lambda: type("S", (), {"trusted_proxy_hops": hops})(),
    )
    assert client_ip(_FakeRequest(forwarded)) == expected


def test_client_ip_falls_back_to_the_peer():
    assert client_ip(_FakeRequest(forwarded=None, peer="10.0.0.1")) == "10.0.0.1"


def test_client_ip_survives_a_header_with_no_addresses(monkeypatch):
    monkeypatch.setattr(
        "frogquiz.helpers.ratelimit.settings",
        lambda: type("S", (), {"trusted_proxy_hops": 1})(),
    )
    assert client_ip(_FakeRequest(" , ", peer="10.0.0.1")) == "10.0.0.1"
