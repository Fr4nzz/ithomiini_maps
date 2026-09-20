#!/usr/bin/env python3
"""Export selected Ithomiini and Wings-classifier chats without tool traffic."""

from __future__ import annotations

import csv
import json
import re
import sqlite3
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs/chat-transcripts"
LOCAL_T3 = Path.home() / ".t3/userdata/state.sqlite"
WINGS_PROJECT = "b3998c68-94bc-44ad-81a4-c68ad72f7081"
REMOTE_HOST = "franz-laptop"
REMOTE_T3_THREAD = "eb7fad5d-f881-4c16-9bff-237d0c08bf13"
LOCAL_ZONE = ZoneInfo("America/Guayaquil")

REMOTE_CODEX = (
    (
        "019f8cf0-b901-7a10-a571-276a7e1b0566",
        "Review worktrees and gitignore files",
        "/home/franz/.codex/sessions/2026/07/22/rollout-2026-07-22T22-06-54-019f8cf0-b901-7a10-a571-276a7e1b0566.jsonl",
    ),
    (
        "019f3cdd-579a-71f2-b769-642131541739",
        "Summarize Ithomiini Maps chats",
        "/home/franz/.codex/sessions/2026/07/07/rollout-2026-07-07T08-56-06-019f3cdd-579a-71f2-b769-642131541739.jsonl",
    ),
    (
        "019dd1d3-7a6f-7040-90e4-a3544df3eee2",
        "Ithomiini Maps Manuscript",
        "/home/franz/.codex/sessions/2026/04/27/rollout-2026-04-27T21-03-10-019dd1d3-7a6f-7040-90e4-a3544df3eee2.jsonl",
    ),
)

REMOTE_CLAUDE = (
    "1d1ffc5c-06df-4e05-8ee1-a5578d64de6e",
    "Review Ithomiini manuscript and figures",
    "/home/franz/.claude/projects/-home-franz-Documents-ManuscriptFiguresIthomiini-maps/1d1ffc5c-06df-4e05-8ee1-a5578d64de6e.jsonl",
)

SECRET_PATTERNS = (
    re.compile(r"(?i)\b(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}"),
    re.compile(r"\b(?:AIza|sk-or-v1-|sk-proj-|sk-ant-|sk-)[A-Za-z0-9_-]{12,}"),
    re.compile(r"\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}"),
    re.compile(r"(?i)((?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*[\"']?)[^\s\"']{8,}"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----.*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", re.S),
    re.compile(r"(?i)([?&](?:token|access_token|api_key|key|secret)=)[^&#\s]+"),
)


@dataclass
class Message:
    role: str
    text: str
    timestamp: str


def sanitize(text: str) -> str:
    for pattern in SECRET_PATTERNS:
        text = pattern.sub(
            lambda match: (match.group(1) if match.lastindex else "") + "[REDACTED]",
            text,
        )
    return "\n".join(line.rstrip() for line in text.splitlines())


def parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def display_time(value: str) -> str:
    parsed = parse_time(value)
    utc = parsed.isoformat().replace("+00:00", "Z")
    return f"{utc} ({parsed.astimezone(LOCAL_ZONE).isoformat()})"


def pair_turns(messages: Iterable[Message]) -> list[tuple[Message, Message | None]]:
    ordered = list(messages)
    pairs = []
    for index, message in enumerate(ordered):
        if message.role != "user":
            continue
        assistants = []
        for following in ordered[index + 1 :]:
            if following.role == "user":
                break
            if following.role == "assistant" and following.text.strip():
                assistants.append(following)
        pairs.append((message, assistants[-1] if assistants else None))
    return pairs


def slug(title: str, session_id: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:72]
    return f"{value or 'untitled'}-{session_id[:8]}.md"


def write_chat(harness: str, session_id: str, title: str, messages: list[Message], source: str) -> dict:
    destination = OUTPUT / harness / slug(title, session_id)
    destination.parent.mkdir(parents=True, exist_ok=True)
    turns = pair_turns(messages)
    lines = [
        f"# {sanitize(title)}",
        "",
        f"- Harness: `{harness}`",
        f"- Session ID: `{session_id}`",
        f"- Source: `{source}`",
        "",
    ]
    for number, (user, assistant) in enumerate(turns, 1):
        lines.extend((f"## Turn {number}", "", f"### User, {display_time(user.timestamp)}", "", sanitize(user.text).strip(), ""))
        if assistant:
            lines.extend((f"### Final response, {display_time(assistant.timestamp)}", "", sanitize(assistant.text).strip(), ""))
        else:
            lines.extend(("### Final response", "", "[No final response: interrupted]", ""))
    destination.write_text("\n".join(lines), encoding="utf-8")
    stamps = [parse_time(message.timestamp) for message in messages]
    return {
        "harness": harness,
        "title": title,
        "session_id": session_id,
        "started_at_utc": min(stamps).isoformat().replace("+00:00", "Z") if stamps else None,
        "ended_at_utc": max(stamps).isoformat().replace("+00:00", "Z") if stamps else None,
        "turns": len(turns),
        "source_host": "local" if harness == "t3-code-wings" else REMOTE_HOST,
        "path": str(destination.relative_to(ROOT)),
    }


def t3_rows(connection: sqlite3.Connection, where: str, parameters: tuple[str, ...]) -> list[tuple[str, str, list[Message]]]:
    connection.row_factory = sqlite3.Row
    threads = connection.execute(
        f"SELECT thread_id,title FROM projection_threads WHERE {where} AND deleted_at IS NULL ORDER BY updated_at",
        parameters,
    ).fetchall()
    result = []
    for thread in threads:
        messages = [
            Message(row["role"], row["text"], row["created_at"])
            for row in connection.execute(
                "SELECT role,text,created_at FROM projection_thread_messages WHERE thread_id=? AND role IN ('user','assistant') ORDER BY created_at,message_id",
                (thread["thread_id"],),
            )
        ]
        result.append((thread["thread_id"], thread["title"], messages))
    return result


def export_local_wings() -> list[dict]:
    connection = sqlite3.connect(f"file:{LOCAL_T3}?mode=ro", uri=True)
    chats = t3_rows(connection, "project_id=?", (WINGS_PROJECT,))
    connection.close()
    return [write_chat("t3-code-wings", session_id, title, messages, str(LOCAL_T3)) for session_id, title, messages in chats]


def remote_t3() -> tuple[str, str, list[Message]]:
    script = f'''import json, sqlite3\ndb=sqlite3.connect("/home/franz/.t3/userdata/state.sqlite")\ndb.row_factory=sqlite3.Row\nt=db.execute("SELECT thread_id,title FROM projection_threads WHERE thread_id=?",("{REMOTE_T3_THREAD}",)).fetchone()\nm=db.execute("SELECT role,text,created_at FROM projection_thread_messages WHERE thread_id=? AND role IN ('user','assistant') ORDER BY created_at,message_id",("{REMOTE_T3_THREAD}",)).fetchall()\nprint(json.dumps({{"thread_id":t["thread_id"],"title":t["title"],"messages":[dict(x) for x in m]}}))\n'''
    completed = subprocess.run(["ssh", REMOTE_HOST, "python3"], input=script, text=True, capture_output=True, check=True)
    data = json.loads(completed.stdout)
    return data["thread_id"], data["title"], [
        Message(message["role"], message["text"], message["created_at"])
        for message in data["messages"]
    ]


def remote_lines(path: str) -> Iterator[str]:
    process = subprocess.Popen(["ssh", REMOTE_HOST, "cat", path], text=True, stdout=subprocess.PIPE)
    assert process.stdout is not None
    yield from process.stdout
    if process.wait() != 0:
        raise RuntimeError(f"failed to read {path} from {REMOTE_HOST}")


def block_text(blocks: object, allowed: tuple[str, ...]) -> str:
    if isinstance(blocks, str):
        return blocks
    if not isinstance(blocks, list):
        return ""
    return "\n".join(str(block.get("text", "")) for block in blocks if isinstance(block, dict) and block.get("type") in allowed)


def injected_codex(text: str) -> bool:
    stripped = text.lstrip()
    return stripped.startswith(("<recommended_plugins>", "<environment_context>", "# AGENTS.md instructions", "<skills_instructions>"))


def parse_codex(path: str) -> list[Message]:
    messages = []
    for line in remote_lines(path):
        record = json.loads(line)
        if record.get("type") != "response_item":
            continue
        payload = record.get("payload", {})
        if payload.get("type") != "message" or payload.get("role") not in ("user", "assistant"):
            continue
        allowed = ("input_text",) if payload["role"] == "user" else ("output_text",)
        text = block_text(payload.get("content"), allowed).strip()
        if text and not injected_codex(text):
            messages.append(Message(payload["role"], text, record["timestamp"]))
    return messages


def parse_claude(path: str) -> list[Message]:
    messages = []
    for line in remote_lines(path):
        record = json.loads(line)
        role = record.get("type")
        if role not in ("user", "assistant") or not record.get("timestamp"):
            continue
        content = (record.get("message") or {}).get("content")
        if role == "user":
            if not isinstance(content, str) or content.lstrip().startswith(("<local-command", "<command-", "<system-reminder>")):
                continue
            text = content
        else:
            text = block_text(content, ("text",))
        if text.strip():
            messages.append(Message(role, text, record["timestamp"]))
    return messages


def write_index(rows: list[dict]) -> None:
    rows.sort(key=lambda row: (row["started_at_utc"] or "", row["harness"], row["session_id"]))
    (OUTPUT / "index.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    with (OUTPUT / "index.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys(), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    rows = export_local_wings()
    session_id, title, messages = remote_t3()
    rows.append(write_chat("t3-code-ithomiini", session_id, title, messages, f"{REMOTE_HOST}:~/.t3/userdata/state.sqlite"))
    for session_id, title, path in REMOTE_CODEX:
        rows.append(write_chat("codex-ithomiini", session_id, title, parse_codex(path), f"{REMOTE_HOST}:{path}"))
    session_id, title, path = REMOTE_CLAUDE
    rows.append(write_chat("claude-code-ithomiini", session_id, title, parse_claude(path), f"{REMOTE_HOST}:{path}"))
    write_index(rows)
    print(f"Exported {len(rows)} chats with {sum(row['turns'] for row in rows)} user turns")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
