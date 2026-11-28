"""Validate contributions in a revision 2 watch recording before aggregating it."""
from collections import Counter


def watch_revision(record):
    watch = record.get("watch")
    if not watch:
        raise ValueError("нет диагностической записи")
    revision = watch.get("revision", 1)
    if revision == 1:
        return revision
    if revision != 2 or not watch.get("complete") or watch.get("errors"):
        raise ValueError("диагностическая запись неполна или версия неизвестна")
    if watch["match"] != record["match"] or watch["toTick"] != record["ticks"]:
        raise ValueError("границы диагностики и матча не совпали")
    if watch.get("movementSource") != "REC.prob":
        raise ValueError("нет ссылки на журнал движения матча")
    validate_watch(watch, record.get("prob"))
    return revision


def validate_watch(watch, movement):
    if not isinstance(movement, list):
        raise ValueError("отсутствует полный журнал движения")
    counts = Counter({k: 0 for k in ("stall", "nav", "tug", "wait", "flip", "danger", "kills", "smokeProjected")})
    for seq, row in enumerate(movement):
        if len(row) < 12 or row[9] != seq or not isinstance(row[11], dict):
            raise ValueError(f"пропуск или неполная причина PROB#{seq}")
        if row[2] not in ("stall", "nav", "tug") or not row[3].startswith(row[2] + "."):
            raise ValueError(f"неизвестный тип PROB#{seq}")
        if row[2] == "stall":
            facts = row[11]
            if not facts["fromTick"] <= row[0] <= (watch["toTick"] if facts["endTick"] is None else facts["endTick"]) <= watch["toTick"]:
                raise ValueError(f"некорректные границы PROB#{seq}")
        counts[row[2]] += 1
        counts[row[3]] += 1
        if row[2] == "stall":
            counts["stall.ep"] += 1
            if row[10] != counts["stall.ep"]:
                raise ValueError(f"повтор или разрыв эпизода stall в PROB#{seq}")
    rows = watch["all"]
    by_id = {}
    for key, series in rows.items():
        if key not in ("wait", "flip", "danger", "kills", "smokeProjected", "nade"):
            raise ValueError(f"неизвестный тип события {key}")
        for row in series:
            if len(row) != 6 or row[5] in by_id or not isinstance(row[4], dict):
                raise ValueError(f"повтор или неполная причина WATCH, тип {key}")
            if key == "wait" or key == "danger" and row[2] == "fire.damage":
                data = row[4]
                end = watch["toTick"] if data["toTick"] is None else data["toTick"]
                if not data["fromTick"] <= row[0] <= end <= watch["toTick"]:
                    raise ValueError(f"некорректные границы WATCH#{row[5]}")
            by_id[row[5]] = key, row
        if key != "nade":
            counts[key] += len(series)
    if watch["counts"] != {"watch": len(by_id), "movement": len(movement)}:
        raise ValueError("объявленная длина диагностических журналов не совпала")
    if set(by_id) != set(range(len(by_id))):
        raise ValueError("разрыв последовательности WATCH")
    if dict(counts) != watch["n"]:
        raise ValueError("итог WATCH не совпал с журналом")
    if dict(Counter(row[2] for row in rows.get("danger", []))) != watch["dangerBy"]:
        raise ValueError("итог danger по причинам не совпал с журналом")

    stages = {key: Counter() for key in ("hands", "intent", "reached", "thrown", "lost", "lostWhy", "unassigned", "detonated")}
    rounds = 0
    ended = set()
    thrown = set()
    reached = set()
    releases = set()
    detonations = set()
    stage_deltas = {"rounds": 1, "intent": 1, "reached": 1, "thrown": 1, "lost": 1,
                    "unassigned": 1, "detonated": 1, "ended": 0, "attempt": 0}
    for row in rows.get("nade", []):
        data = row[4]
        task, stage, key, delta = data["task"], data["stage"], data["key"], data["delta"]
        if stage == "hands":
            if not isinstance(delta, int) or delta <= 0:
                raise ValueError("некорректный инвентарь")
        elif stage_deltas.get(stage) != delta:
            raise ValueError(f"некорректный вклад гранаты, стадия {stage}")
        if task is not None:
            source = by_id.get(task)
            if source is None or source[0] != "nade" or source[1][4]["stage"] != "intent" or task > row[5]:
                raise ValueError(f"неизвестная задача гранаты {task}")
            if source[1][1] != row[1] or source[1][4]["type"] != data["type"]:
                raise ValueError(f"событие отнесено к чужой задаче {task}")
        if stage in ("ended", "lost", "thrown", "reached"):
            seen = thrown if stage == "thrown" else reached if stage == "reached" else ended
            if task is None or task in seen:
                raise ValueError(f"повтор или отсутствие задачи, стадия {stage}")
            seen.add(task)
        if stage == "rounds":
            rounds += delta
        elif delta:
            stages[stage][key] += delta
        if stage == "lost":
            stages["lostWhy"][data["type"] + "|" + row[2]] += delta
        if stage in ("thrown", "unassigned"):
            attempt = by_id.get(data["evidence"]["attempt"])
            if not attempt or attempt[0] != "nade":
                raise ValueError("бросок без попытки")
            attempt_data = attempt[1][4]
            if (attempt_data["stage"] != "attempt" or attempt_data["task"] != data["evidence"]["task"] or
                attempt_data["type"] != data["type"] or attempt[1][1] != row[1] or
                not attempt_data["evidence"]["ok"] or attempt[1][5] >= row[5]):
                raise ValueError("бросок не подтверждён соответствующей успешной попыткой")
            attempt_id = attempt[1][5]
            if attempt_id in releases:
                raise ValueError("попытка зачтена повторно")
            releases.add(attempt_id)
        if stage == "detonated" and data["evidence"]["release"] is not None:
            launch = data["evidence"]["release"]
            source = by_id.get(launch)
            if (launch in detonations or source is None or source[0] != "nade" or
                launch >= row[5] or source[1][4]["stage"] not in ("thrown", "unassigned") or
                source[1][1] != row[1] or source[1][4]["type"] != data["type"]):
                raise ValueError("детонация не соответствует выпущенной гранате")
            detonations.add(launch)
    for seq, (kind, row) in by_id.items():
        if kind == "nade" and row[4]["stage"] == "attempt" and row[4]["evidence"]["ok"] and seq not in releases:
            raise ValueError("успешная попытка без записи выпуска")
    expected = {**{key: dict(values) for key, values in stages.items()}, "rounds": rounds}
    if expected != watch["nade"]:
        raise ValueError("итог гранат не совпал с журналом")
