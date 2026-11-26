"""Offline probes; no simulator, no dependency install, no writes outside stdout."""
import ast
import json
import math
import os
import statistics
import tempfile
import glob
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]


def function_nodes(path, *names):
    source = ROOT / path
    tree = ast.parse(source.read_text())
    return source, [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]


def evaluate(source, body, scope):
    exec(compile(ast.Module(body=body, type_ignores=[]), str(source), "exec"), scope)
    return scope


def situation_probes():
    source, body = function_nodes("tools/measure/situations.py", "behave", "share")
    scope = evaluate(source, body, {"np": SimpleNamespace(hypot=math.hypot)})
    behave = scope["behave"]
    ticks = [16 * i for i in range(13)]
    x = [25 * i for i in range(13)]
    zero = [0] * 13
    goal = [400] * 13
    result = behave(x, zero, ticks, ticks[-1], goal, zero, [80], None)
    assert result[0] == (True, True, True, False)
    assert result[-1] == (None, None, False, False)
    gapped = [2 * t for t in ticks]
    observed = behave(x, zero, gapped, gapped[-1], goal, zero, [], None)
    assert observed[0][0:2] == (True, True)
    assert gapped[4] == 128
    # One physical throw or death appears in multiple overlapping windows.
    assert sum(r[2] for r in result) == 5
    return [
        {"id": "S01_end_of_round", "observed": list(result[-1]), "note": "nade/death become false when horizon is incomplete, movement/approach become unknown"},
        {"id": "S02_sample_gaps", "observed": gapped[4], "note": "four samples treated as one second even when elapsed 128 ticks"},
        {"id": "S03_overlapping_windows", "observed": sum(r[2] for r in result), "note": "one throw contributes five near-future windows"},
    ]


def aggregation_probes():
    source, body = function_nodes("tools/measure/counters.py", "count", "fmt")
    parsed = ast.parse(source.read_text())
    report = next(node for node in parsed.body if isinstance(node, ast.If) and ast.unparse(node.test) == "'base' in opt")
    with tempfile.TemporaryDirectory() as target:
        folder = Path(target)
        for label, n in (("base", 0), ("new", 1)):
            sub = folder / label
            sub.mkdir()
            for m in (1, 2):
                d = {"rounds": [{"t0": 1, "t1": 100}]}
                if m == 1:
                    d["watch"] = {"n": {"nav": n}}
                (sub / f"rec_{m}.json").write_text(json.dumps(d))
        scope = evaluate(source, body, {"glob": glob, "os": os, "json": json, "R": target, "statistics": statistics})
        old, onr, onm = scope["count"]("base")
        new, nr, nm = scope["count"]("new")
        assert new[1] == 50 and nr == 2
        scope.update(opt={"base": "base"}, rows=[], lab="new", new=new, nr=nr, nm=nm, SPEC=[("unused", .15, 0), ("nav", .2, 1)])
        evaluate(source, [report], scope)
        label = scope["rows"][-1]
        assert "+0 %" in label and "шум" in label
    return [
        {"id": "C01_missing_watcher", "observed": new[1], "note": "one recorded hit in one observed round is divided by both rounds"},
        {"id": "C02_zero_baseline", "observed": label, "note": "0→50 per 100 rounds is labeled 0% noise by actual report"},
    ]


if __name__ == "__main__":
    print(json.dumps(situation_probes() + aggregation_probes(), ensure_ascii=False, indent=2))
