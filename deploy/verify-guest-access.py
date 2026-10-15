#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 frogQuiz contributors
# SPDX-License-Identifier: MPL-2.0
"""Read-only checks against production, with no cookies or account credentials."""
import json
import urllib.request

base = 'https://api.frogquiz.xyz'
def get(path):
    with urllib.request.urlopen(base + path, timeout=20) as response:
        return json.load(response)

config = get('/api/v1/utils/config')
assert config.get('anonymous_quizzes_enabled') is True, 'Guest creation is still disabled'
print('PASS: anonymous quiz creation enabled')
examples = get('/api/v1/quiz/examples')
assert isinstance(examples.get('quizzes'), list), 'Invalid examples response'
assert examples['quizzes'], 'Discover has no public examples configured'
print(f"PASS: {len(examples['quizzes'])} public examples accessible without sign-in")
print('Still required: signed-out browser creation, Excel import, edit, and host checks.')
