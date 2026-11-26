#!/usr/bin/env python3
"""Two parallel wallet_debit calls; exactly one must win; remaining == 0."""
from __future__ import annotations

import concurrent.futures
import json
import subprocess
import sys
import uuid

DB = sys.argv[1] if len(sys.argv) > 1 else "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
ORG = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
CLIENT = str(uuid.uuid4())


def psql(sql: str) -> str:
    return subprocess.check_output(["psql", DB, "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql], text=True).strip()


psql(
    f"""
insert into clients (id, org_id, name, status)
values ('{CLIENT}', '{ORG}', 'Parallel Client', 'active');
select public.wallet_credit('{ORG}', '{CLIENT}', 100, 'compensation', 'parallel stake');
"""
)


def debit(tag: str) -> dict:
    raw = psql(f"select public.wallet_debit('{ORG}', '{CLIENT}', 100, 'desk_sale', '{tag}');")
    return json.loads(raw)


with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(debit, ["p1", "p2"]))

wins = sum(1 for r in results if r.get("ok") is True)
remaining = float(
    psql(
        f"""
select coalesce(sum(remaining),0) from wallet_transactions
where client_id = '{CLIENT}' and type = 'credit' and remaining > 0
  and (expires_at is null or expires_at > now());
"""
    )
)
print({"results": results, "wins": wins, "remaining": remaining})
if wins != 1 or remaining != 0:
    sys.exit(1)
print("concurrency_parallel OK")
