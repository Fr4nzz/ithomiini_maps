# Audit Chat Orchestration Drift

- Harness: `t3-code-wings`
- Session ID: `6b5e302a-fb11-4001-8ce6-7f4a2102eeb6`
- Source: `/home/franz/.t3/userdata/state.sqlite`

## Turn 1

### User, 2026-08-31T13:26:29.168000Z (2026-08-31T08:26:29.168000-05:00)

Hi, I would like you to help me update the context summary of this project, I think we have a folder where we summarize ai chats talked about this project right? This is the main chat I am using now for this project, it is a t3 code chat titled: Wings Classifier Maintenance Progress, because in the beginning I gave this chat a prompt explaining the behavior I want from this chat, or maybe I explained the behaviro I want in another chat titled Audit Subspecies Image Datasets, explaining it should be the orchestrator, it should be the chcat that deleggates so it only manages the context and interprets my intent, and I have steered it multiple times in the past explaining how I want the prompt style when sending a prompt to OMX, what not to include in the prompt, etc. but then I stopped reviewing the prompt style which might have reintroduced undesired behavior, and it might also make the tasks to take longer than it used to take in the past, maybe the prompt is requesting to do validations which make omx take longer to finish a task, so I want you to review the behavior of the chats, how they behaved at the beginning when I payed more attention to what it used to send as prompts to OMX and if it has drifted after I stopped reviewing so you can help me find if there are changes so I could mention to the chat I am using to steer it back to my desired behavior, another project where the same could be happening is the insectai project, for that you can check the t3 code chat titled: YOLO26s Training and Mask Review, I want you to do the same for this chat, ie its own context summary from where it last left off and check the behavior of that chat to compare when I used to review to now and check what has been lost, like for example I remember in the past the prompt always included to read the context summary, it also suggested how to split the tasks to parallelize the user request, if using the sanger cluster, it included the relevant files OMX should read to avoid making mistakes, or if using the local egpu I dont know if there is an md file summarizing how to avoid mistakes done in the past, etc. also to use the relevant skills to help write the prompt for OMX to follow some preferred writing style of the user, remove ai slop, etc.

### Final response, 2026-08-31T13:30:33.821000Z (2026-08-31T08:30:33.821000-05:00)

Updated the context summaries and added the orchestration-drift findings in the places you’ll actually reuse.

In Wings, I updated [current-state.md](/home/franz/Documents/CodeProjs/WingsClassificator/docs/project-context/current-state.md:1), [user-intent.md](/home/franz/Documents/CodeProjs/WingsClassificator/docs/project-context/user-intent.md:1), [session-index.md](/home/franz/Documents/CodeProjs/WingsClassificator/docs/project-context/history/session-index.md:1), and [ai-harness-lessons.md](/home/franz/Documents/CodeProjs/WingsClassificator/docs/project-context/lessons/ai-harness-lessons.md:1). These now capture the August 31 state, the `Wings Classifier Maintenance Progress` thread through `2026-08-31`, the `Audit Subspecies Image Datasets` thread, and the prompt-style lessons about over-orchestration, positive directives, exact file guidance, and when delegation actually helps.

For Insect AI, that repo does not use the same `project-context` layout, so I added a dedicated note at [CURRENT_T3_YOLO26S_MANAGER_CHECKPOINT_20260831.md](/home/franz/Documents/CodeProjs/insect-ai-thesis-ml-clean/docs/context/CURRENT_T3_YOLO26S_MANAGER_CHECKPOINT_20260831.md:1). It summarizes where `YOLO26s Training and Mask Review` left off and what drifted there.

Main drift I found:
- Early good behavior: manager chat stayed in the orchestrator lane, told OMX to read exact context files/scripts, used positive owner-based prompts, and only split into independent lanes.
- Later drift: prompts accumulated extra monitor/session mechanics, more validation rhetoric, more negative instructions, and fresh planning branches after the decision was already settled.
- In both projects, the strongest steering rule is: keep T3 as manager, keep OMX as single execution owner, point OMX to exact files, and ask for the next artifact or gate rather than a broad meta-process.

I did not run tests because these are doc-only changes; I verified by re-reading the edited sections and cross-checking them against the recovered T3 SQLite thread records. I also left unrelated existing Insect AI changes alone: [CURRENT_V69_YOLO26N_AND_ARTIFACT_REPAIR_20260827.md](/home/franz/Documents/CodeProjs/insect-ai-thesis-ml-clean/docs/context/CURRENT_V69_YOLO26N_AND_ARTIFACT_REPAIR_20260827.md:1) was already modified, and `state/` was already untracked there.

If you want, I can next turn this into one short steering prompt you can paste into `Wings Classifier Maintenance Progress` and another for `YOLO26s Training and Mask Review`.

## Turn 2

### User, 2026-08-31T13:41:29.933000Z (2026-08-31T08:41:29.933000-05:00)

could you make a skill I could point orchestrator chats so they get steered in my desired behavior

### Final response, 2026-08-31T13:41:39.936000Z (2026-08-31T08:41:39.936000-05:00)

Using `skill-creator` for the new skill and `prompt-writing-style` to keep its instructions aligned with your preferred steering style. I’ll read those instructions first, then I’ll add a reusable manager-orchestrator skill you can invoke from future chats.

## Turn 3

### User, 2026-08-31T13:41:44.036000Z (2026-08-31T08:41:44.036000-05:00)

first show me the skill draft so I can give feedback

### Final response, 2026-08-31T13:42:40.033000Z (2026-08-31T08:42:40.033000-05:00)

Drafted it locally at [SKILL.md](/home/franz/.codex/skills/orchestrator-steering/SKILL.md:1), [worker-prompt-shape.md](/home/franz/.codex/skills/orchestrator-steering/references/worker-prompt-shape.md:1), and [openai.yaml](/home/franz/.codex/skills/orchestrator-steering/agents/openai.yaml:1).

`SKILL.md`:

```md
---
name: orchestrator-steering
description: Use when a chat should act as a context manager or orchestrator for another worker chat or OMX session, rather than becoming the main executor.
---

# Orchestrator steering

Use this skill when the current chat should manage context, interpret the user,
and steer another execution owner such as OMX, OpenCode, or a dedicated worker.

The goal is not to make the chat passive. The goal is to keep roles clean:

- The manager chat owns context reconstruction, user-intent interpretation,
  worker selection, wake handling, and evidence review.
- The worker owns substantive implementation, long-running execution, and
  artifact production for the active branch.

## Core behavior

- Start by identifying the current execution owner. If the user already has a
  live worker, steer that worker instead of creating a second owner.
- Read the project context summary before drafting a worker prompt when a local
  context summary exists.
- Point the worker to exact files, scripts, reports, services, or checkpoints
  that should be read first. Prefer concrete paths over "investigate the repo."
- Use positive directives. State the owner, objective, inputs, next artifact,
  and stop condition. Do not pad the prompt with long lists of hypothetical
  mistakes.
- End each worker prompt at the next real gate or artifact, not at a vague
  "continue until everything is done" boundary when the work is phase-based.

## Delegation and splitting

- Treat the worker as the single execution owner for the active branch unless
  the user explicitly wants multiple independent lanes.
- Suggest parallel lanes only when the lanes are genuinely independent, such as:
  repository state, cluster state, service state, or separate repositories.
- Once the needed files and decision path are already known, do not add extra
  delegation just to mirror a multi-step plan.

## Verification and wake handling

- If heavy work runs outside the manager chat, prefer a wake-driven pattern:
  the worker runs until a terminal or phase signal, then the manager inspects
  evidence and relays the next bounded instruction.
- Treat assistant claims as claims, not proof. Verify with the smallest strong
  evidence available: hashes, tests, logs, job IDs, process state, diff, or
  live service checks.
- When a failure is narrow, send a narrow recovery. Repair the specific broken
  contract first instead of reopening the whole strategy.

## Prompt-writing rules

- Prefer "Act as the single execution owner for X" over "do not overorchestrate."
- Prefer "Read these files first" over "research the project."
- Prefer "This phase ends at Y artifact" over "do not continue into Z."
- Keep real safety or authorization boundaries when they matter.

If you need a reusable worker-prompt shape, read
[references/worker-prompt-shape.md](references/worker-prompt-shape.md).

## Scope boundary

This skill improves manager-chat behavior. It does not authorize destructive
actions, production deployment, or new external access on its own.
```

`references/worker-prompt-shape.md`:

```md
# Worker prompt shape

Use this when the manager chat needs to hand off a bounded task to another
worker chat or OMX session.

## Prompt skeleton

```text
Act as the single execution owner for [task name].

Working context
- Repository or worktree: [path]
- Runtime or session to continue: [session, pane, service, or none]
- Current context summary: [exact files to read first]
- Relevant implementation files: [exact scripts, reports, configs, or docs]

Objective
- Produce [artifact or decision] for [scope].

Execution shape
- Read the context summary and the listed implementation files first.
- Reuse the existing worker/session if one already owns this branch.
- Run the smallest proving step before scaling when the runtime or contract is uncertain.
- Keep the work inside this phase until the stated artifact or gate is reached.

Deliverable
- Return with [artifact, updated file, report, commit, job ID, receipt, or URL].
- Include the minimal evidence needed to verify the result.

Stop boundary
- Stop after [artifact or decision gate].
```

## Good defaults

- Name the exact files to read first.
- Name the exact script or command entry point when already known.
- Name the exact service, dashboard, cluster job family, or model artifact when
  the project has several similar ones.
- Keep recovery prompts narrow and phase-specific.

## Avoid

- Long lists of prohibitions that only restate earlier mistakes.
- Broad research language when the local files already identify the path.
- Creating a second execution owner for the same active branch.
- Reopening already-settled ablations unless the user changed the decision.
```

`agents/openai.yaml`:

```yaml
display_name: Orchestrator Steering
short_description: Steer manager chats toward context management and clean worker handoffs.
default_prompt: Use this skill to keep the chat in the manager lane and hand bounded work to a single execution owner.
policy:
  allow_implicit_invocation: false
```

Main choices I made:
- Explicit-only invocation, since you said you want to point chats to it.
- Short entrypoint, with the reusable prompt shape moved to a reference file.
- Emphasis on positive directives, exact files, one execution owner, and wake-driven relay.

Tell me what you want changed and I’ll revise it.

## Turn 4

### User, 2026-08-31T13:47:04.680000Z (2026-08-31T08:47:04.680000-05:00)

can you include the paths of context summary for insect ai and wings classifier

### Final response, 2026-08-31T13:47:22.109000Z (2026-08-31T08:47:22.109000-05:00)

Yes. I added the paths to the draft.

Updated files:
- [SKILL.md](/home/franz/.codex/skills/orchestrator-steering/SKILL.md:1)
- [worker-prompt-shape.md](/home/franz/.codex/skills/orchestrator-steering/references/worker-prompt-shape.md:1)

The added paths are:
- Wings Classificator: `/home/franz/Documents/CodeProjs/WingsClassificator/docs/project-context/README.md`
- Insect AI: `/home/franz/Documents/CodeProjs/insect-ai-thesis-ml-clean/docs/context/CANONICAL_PROJECT_INTENT_AND_ROADMAP_20260821.md`
- Insect AI manager-behavior note: `/home/franz/Documents/CodeProjs/insect-ai-thesis-ml-clean/docs/context/CURRENT_T3_YOLO26S_MANAGER_CHECKPOINT_20260831.md`

If you want, I can also make the skill more opinionated and say “for these two repos, always read these files first unless the user gives a narrower file set.”

## Turn 5

### User, 2026-08-31T13:49:41.046000Z (2026-08-31T08:49:41.046000-05:00)

other mistakes I have noticed is that sometimes the chats forget which websites we use to deploy and present the user the results like the tiputini gallery, the artifact review website, the review for masks to grade them and comment them, the clone(s) of the shiny ikiam wings gallery, it would be good if you include that so they dont accidentally create a new one

### Final response, 2026-08-31T13:51:00.408000Z (2026-08-31T08:51:00.408000-05:00)

Added that to the draft.

The skill now explicitly tells orchestrator chats to identify and reuse the canonical live surfaces before proposing any new deployment, clone, or review site. It includes these concrete URLs:

- Wings review dashboard and mask grading/comments: `https://franz-gpdwin4.tailf5d2f1.ts.net:8470/`
- Wings candidate comparison and automatic-mask galleries: `https://franz-gpdwin4.tailf5d2f1.ts.net:8470/#wings-candidate-comparison/...` and `https://franz-gpdwin4.tailf5d2f1.ts.net:8470/#wings-automatic-mask-gallery/...`
- Insect AI observatory routes: `https://franz-gpdwin4.tailf5d2f1.ts.net:8469/#resolver-calibration/...` and `https://franz-gpdwin4.tailf5d2f1.ts.net:8469/#v69-automatic-gallery/...`
- Canonical Tiputini gallery and artifact-review writer surface: `https://tbs-insect-gallery.duckdns.org/?view=maskqc&...`
- Public Wings classifier: `https://rapidspeciation.github.io/WingsClassificator/`

Updated draft files:
- [SKILL.md](/home/franz/.codex/skills/orchestrator-steering/SKILL.md:1)
- [worker-prompt-shape.md](/home/franz/.codex/skills/orchestrator-steering/references/worker-prompt-shape.md:1)

If you want, the next refinement is to make this even stricter by adding a rule like: “before any UI/deployment work, list the existing canonical surface and explain why it is insufficient if proposing a new one.”

## Turn 6

### User, 2026-08-31T13:57:51.956000Z (2026-08-31T08:57:51.956000-05:00)

ok install the skill to codex

### Final response, 2026-08-31T13:58:05.477000Z (2026-08-31T08:58:05.477000-05:00)

Installed and validated.

The skill is now available to Codex at:
- [orchestrator-steering/SKILL.md](/home/franz/.codex/skills/orchestrator-steering/SKILL.md:1)
- [orchestrator-steering/references/worker-prompt-shape.md](/home/franz/.codex/skills/orchestrator-steering/references/worker-prompt-shape.md:1)
- [orchestrator-steering/agents/openai.yaml](/home/franz/.codex/skills/orchestrator-steering/agents/openai.yaml:1)

Validation result: `Skill is valid!`

You can invoke it explicitly in a manager chat as `$orchestrator-steering`. Since `allow_implicit_invocation: false`, it will only load when you point a chat to it directly.

## Turn 7

### User, 2026-08-31T14:15:53.237000Z (2026-08-31T09:15:53.237000-05:00)

check the recent essages in the chat YOLO26s Training and Mask Review, this might help you improve the skill

### Final response, 2026-08-31T14:16:42.905000Z (2026-08-31T09:16:42.905000-05:00)

I checked the recent `YOLO26s Training and Mask Review` thread in T3 (`thread_id 890476b8-80be-44d1-bf6c-baf33e3e228a`, from `~/.t3/userdata/state.sqlite`) and used the August 31, 2026 feedback to improve the skill.

What changed in `$orchestrator-steering`:
- It now says not to turn reasonable checks into a mandatory ceremony, and to describe the outcome/gate instead of every micro-step.
- It now prefers “choose the fastest valid path to reach Y gate” when OMX can decide the proving sequence itself.
- It now says to reuse the existing worker session when it already owns the branch and is not stale.
- It now makes “draft prompt for review” explicit: stop at the draft and do not send it until the user approves.

Updated files:
- [SKILL.md](/home/franz/.codex/skills/orchestrator-steering/SKILL.md:18)
- [worker-prompt-shape.md](/home/franz/.codex/skills/orchestrator-steering/references/worker-prompt-shape.md:21)

Validation passed again: `Skill is valid!`

The key new lesson from those recent messages was exactly your point: the manager prompt should name the repo, context files, canonical site, objective, and stop gate, but avoid prescribing a long pre-GPU checklist when OMX can choose that itself.

## Turn 8

### User, 2026-09-02T14:27:53.897000Z (2026-09-02T09:27:53.897000-05:00)

does the skill mention the paths of the context summary for each project? which one is the path for insect ai?

### Final response, 2026-09-02T14:28:05.262000Z (2026-09-02T09:28:05.262000-05:00)

Yes.

In `$orchestrator-steering`, the skill mentions context-summary entry paths for both projects.

Wings Classificator:
- `/home/franz/Documents/CodeProjs/WingsClassificator/docs/project-context/README.md`

Insect AI:
- `/home/franz/Documents/CodeProjs/insect-ai-thesis-ml-clean/docs/context/CANONICAL_PROJECT_INTENT_AND_ROADMAP_20260821.md`
- `/home/franz/Documents/CodeProjs/insect-ai-thesis-ml-clean/docs/context/CURRENT_T3_YOLO26S_MANAGER_CHECKPOINT_20260831.md`

The main Insect AI context-summary path is the first one. The second is the manager-chat behavior addendum I added from the recent T3 chat.
