# SPDX-FileCopyrightText: 2026 frogQuiz contributors
# SPDX-License-Identifier: MPL-2.0
import os
import tempfile
import pathlib
import subprocess
import json

script = str(pathlib.Path(__file__).with_name("enable-guests.sh"))
mock = """#!/usr/bin/env python3
import sys,os,json
from pathlib import Path
a=sys.argv[1:]
with open('calls','a') as f:f.write(json.dumps(a)+'\\n')
if a[0]=='pull':pass
elif a[:2]==['image','inspect']: print(os.environ.get('REV','b72a3e25305ff34e67012a88961bb7d8490eb7a2'))
elif a[:2]==['compose','ps']:print('container-'+a[-1])
elif a[0]=='inspect':
 if 'working_dir' in ' '.join(a): print('/different/deployment' if os.environ.get('WRONG_DIR') else os.getcwd())
 else: print('sha256:previous')
elif a[:2]==['compose','config']:
 enabled='false' if os.environ.get('OVERRIDE') else 'true'
 service = {'image':'ghcr.io/ogfrench/frogquiz-backend:master',
            'environment':{'ANONYMOUS_QUIZZES_ENABLED':enabled}}
 print(json.dumps({'services':{n:service for n in ('api','worker')}}))
elif a[:2]==['compose','up']: sys.exit(int(os.environ.get('FAIL_UP','0')))
else:sys.exit(90)
"""
for case, extra in [
    ("success", {}),
    ("wrong_directory", {"WRONG_DIR": "1"}),
    ("wrong_revision", {"REV": "wrong"}),
    ("override", {"OVERRIDE": "1"}),
    ("restart_failure", {"FAIL_UP": "1"}),
]:
    with tempfile.TemporaryDirectory() as d:
        p = pathlib.Path(d)
        (p / "docker").write_text(mock)
        (p / "docker").chmod(0o700)
        original = "SECRET_KEY=placeholder\nANONYMOUS_QUIZZES_ENABLED=false\n"
        (p / ".env").write_text(original)
        (p / "docker-compose.yml").write_text("services: {}\n")
        result = subprocess.run(
            ["bash", script],
            cwd=d,
            env={**os.environ, **extra, "PATH": d + ":" + os.environ["PATH"]},
            capture_output=True,
            text=True,
        )
        calls = [json.loads(x) for x in (p / "calls").read_text().splitlines()]
        restarted = any(x[:2] == ["compose", "up"] for x in calls)
        assert (result.returncode == 0) == (case == "success"), (case, result.stderr)
        assert restarted == (case in ("success", "restart_failure")), case
        if case in ("wrong_revision", "override", "wrong_directory"):
            assert (p / ".env").read_text() == original
        if restarted:
            backup = next(p.glob(".guest-access-backup.*"))
            assert (backup / "env").read_text() == original
            assert (backup / "api.image").read_text().strip() == "sha256:previous"
            assert "ANONYMOUS_QUIZZES_ENABLED=true" in (p / ".env").read_text()
        assert "SECRET_KEY" not in result.stdout + result.stderr
        print("PASS", case)
