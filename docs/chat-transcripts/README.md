# Project chat transcripts

This archive preserves the user messages and final assistant response for each
turn. It excludes progress updates, reasoning, commands, tool calls, and tool
output. Timestamps are recorded in UTC and `America/Guayaquil` time.

The Ithomiini set contains the four most recent substantive project sources
identified by the August continuation audit:

- the August 1 T3 Code continuation audit;
- the July 22 Codex worktree and repository audit;
- the July 7 Codex context and manuscript-package pass;
- the July 8 Claude Code manuscript and figure review.

The primary April 27 to May 24 Codex manuscript thread is also included because
it records the manuscript edits, writing preferences, host-plant revisions,
Google Doc work, and communication drafts that the later chats refer to.

The Wings-classifier set contains all eight chats in the local T3 Code
`WingsClassificator` project. These cover BioCLIP feature and head training,
wing segmentation, subspecies datasets, classifier context, overnight training,
and taxonomy reconciliation.

The June Claude manuscript sessions named in the continuation audit no longer
have raw session files on `franz-laptop`. Their surviving prompt-index entries
were not presented as complete transcripts. The July and August chats retain
their summaries and session identifiers.

`index.json` and `index.csv` list the harness, title, session ID, dates, number
of user turns, source host, and committed path. The exporter reads the original
T3 database in place and streams the selected remote JSONL files over SSH. It
redacts credential patterns before writing Markdown.

Regenerate from a machine that can reach the configured `franz-laptop` SSH
alias with:

```bash
python scripts/archive/export_project_chats.py
```
