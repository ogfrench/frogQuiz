# FrogQuiz Backlog

Living backlog of feature ideas, gaps, and planned work, grounded in a comparison against Kahoot! and Mentimeter (the two products FrogQuiz sits between: game-show quizzing and live audience polling/presentation).

Format: each backlog section is a milestone. Items are one-liners with a short rationale; move an item to "Done" (or delete it) once shipped, and log the actual change in `CHANGELOG.md` as usual.

---

## Reference: Kahoot! — value proposition, journey, features

**Value proposition**: turn a room (physical or remote) into a live game. The host's screen is the shared spectacle (question, timer, music, podium); everyone else's device is just a game controller. Optimized for energy, competition, and memorable "aha" moments — a teaching/training tool that feels like a party game.

**Core user journey**:
1. Host picks or authors a "kahoot" (quiz) in an editor with question templates.
2. Host starts a live session, gets a 6-digit game PIN + shareable link/QR.
3. Players join on any device via a join page (`kahoot.it` + PIN), type a nickname — no account needed.
4. Host controls pacing question-by-question; the big screen shows the question, shape/colour-coded answers, and a countdown; players see only shapes/colours on their phone and tap.
5. Points are speed-weighted (faster + correct = more points); after each question the host screen shows an answer distribution and a live leaderboard.
6. Session ends with a podium (top 3) celebration and a full results/report export for the host.
7. Optional: assign the same quiz as **self-paced homework/challenge** (players go through it solo, at their own pace, over a longer window).

**Notable features**:
- Question types: multiple choice, true/false, multi-select, puzzle/reorder, type-answer (open text), slider/numeric-range guess, poll (no right answer), and content-only "slide" info screens.
- Speed-based scoring with streak bonuses; podium ceremony with confetti/music.
- Team mode (players cluster into teams sharing one device/score).
- Ghost mode (compete against a previous session's scores).
- Media-rich questions: images, video, audio per question.
- Question bank / question templates and a "generate with AI" quiz builder.
- Reports: per-player and per-question breakdowns, exportable (spreadsheet), used for grading/assessment.
- Kahoot library import/marketplace of public quizzes; discovery/search of others' public content.
- Works without an account for players; account required for hosts to save/host.
- Branded/sponsored kahoots, certificates, integrations (Teams/Zoom/Google Classroom) — enterprise-tier, less relevant here.

---

## Reference: Mentimeter — value proposition, journey, features

**Value proposition**: turn a room into a live *conversation*, not a competition. There's no winner — the point is instant, anonymous, aggregate feedback that becomes the visual centerpiece of a presentation (a poll result, a word cloud, a Q&A queue) rather than a game screen. Built for meetings, workshops, all-hands, and lecture-style audience engagement where honesty/anonymity matters more than speed.

**Core user journey**:
1. Presenter builds a "presentation" that interleaves normal content slides with interactive slides.
2. Presenter starts the session; a join code/QR is shown persistently in a corner of every slide (not a separate lobby step) — audience joins once and stays joined across the whole deck.
3. Presenter drives the deck like normal slides (arrow keys / clicker); each interactive slide accepts live input from the audience's phones with no per-question "start/stop" ceremony.
4. Responses render live and anonymously (bar chart growing in real time, word cloud reshaping as words are typed, a scatter/pin appearing on an image, a queue of submitted questions the presenter can upvote/mark answered).
5. No individual scoring, no leaderboard, no podium — the artifact of value is the aggregated result itself, which the presenter can screenshot/export/reuse.
6. Async use: a presentation can be shared as a standalone link for people to respond to on their own time (survey mode), not just live.

**Notable features**:
- Slide/question types: word cloud, open-ended text feed, multiple choice / bar or pie chart, ranking, scales (1–5 / NPS-style), Q&A with upvoting and "mark answered", 2x2 prioritization matrix, image/heatmap click-to-pin, quiz mode (Kahoot-like, exists but is the *secondary* mode), pin-on-image.
- Anonymity by default — no nicknames required, responses aren't tied to a visible identity in the room.
- "One join, many slides" — audience never re-scans a code per question.
- Templates for meeting formats (retro, icebreaker, all-hands Q&A, training).
- Live moderation of open-text/Q&A submissions (hide/approve before it hits the shared screen) to avoid inappropriate content going live.
- Export results (PDF/CSV/PPTX) after the session for a written record.
- Works embedded inside PowerPoint/Google Slides, not just standalone.
- Async/self-paced completion of a whole deck via link, no live host needed.

---

## What FrogQuiz already has (mapped against the above)

FrogQuiz inherits ClassQuiz's game-night core, which already covers most of Kahoot's spine:

| Capability | Status |
|---|---|
| PIN + QR join, no player account needed | ✅ (`frogquiz/routers/live.py`, live lobby) |
| Live host screen: question, timer, podium, confetti | ✅ (recently rebuilt, see CHANGELOG) |
| Per-question results: answer distribution + standings | ✅ (recently rebuilt as one card) |
| Question types | ✅ broad: `ABCD` (multi-choice), `CHECK` (multi-select), `RANGE` (numeric-slider guess), `VOTING` (poll, no right answer — Mentimeter-style), `TEXT` (open-text answer), `ORDER` (reorder/ranking), `SLIDE` (content-only, no answer) — see `frogquiz/db/models.py:138` |
| Self-paced / homework mode | ✅ `practice` route + `results.py` — solo play outside a live session |
| Import from Kahoot's own format | ✅ `frogquiz/kahoot_importer/` |
| Public gallery / discovery of others' quizzes | ✅ `explore` + `search` routes (kept per Feature triage in CLAUDE.md) |
| Anonymous quiz creation & hosting | ✅ shipped recently (no-account quiz authoring, claim-later flow) |
| Results export | ✅ host-side export controls on the podium screen |
| Physical/remote buzzer hardware | ✅ but slated to hide per Feature triage (`box_controller`, `remote`) — internal-tool, low priority |
| Editor for authoring questions with media | ✅ `editor.py` / `frontend/src/routes/edit` |
| Quiztivity (video-driven interactive quiz) | ✅ `frogquiz/quiztivity` — closer to a "watch + answer" hybrid, no direct Kahoot/Menti analogue |

What's **missing or thin** relative to both references:

- **No genuinely anonymous *live* response mode.** `VOTING` exists as a question *type* but the whole session is still framed as a scored, nicknamed game (PIN → lobby → podium). There's no "no names, no scoring, just show me the aggregate" *session mode* — Mentimeter's actual core mechanic.
- **No word cloud.** No question type aggregates free-text into a live-reshaping cloud; `TEXT` answers are scored right/wrong, not visualized as a corpus.
- **No live Q&A / upvoting queue.** No way for an audience to submit questions to a presenter and have the room upvote which get answered.
- **No "one join, many slides" flow.** Every FrogQuiz session is lobby → sequential questions with a fresh per-question state machine; there's no lightweight "join once, presenter free-flows through mixed content+interactive slides" pattern.
- **No rating/scale question type** (1–5, NPS-style) — distinct from `RANGE` (which is a numeric *guess-the-answer* game mechanic, not a subjective scale).
- **No 2x2 / prioritization-matrix or image-heatmap/pin-on-image question type.**
- **No live moderation queue** for open-text/Q&A before it hits the shared screen — relevant once free-text or Q&A ships, to avoid something inappropriate landing on the projector mid-meeting.
- **No speed-based/streak scoring nuance** — worth checking whether current scoring already rewards speed; if not, it's a small, high-visible-impact gap for the "game night" use case specifically.
- **No team mode** (shared-device team play) or **ghost mode** (replay against a past session).
- **No PPTX/Slides embedding** — not relevant for an internal tool.

---

## MVP2 Backlog

Scoped for FrogQuiz as an **internal team tool** — prioritizing the gaps that unlock genuine meeting/workshop use (Menti-style) alongside the game-night use case already covered, over enterprise features (branding, integrations, certificates) that don't apply here.

### High value, low-to-medium effort
- [ ] **Word cloud question type.** New `QuizQuestionType.WORDCLOUD` (or extend `TEXT`) whose live host/results view renders submitted words as a reshaping cloud instead of a scored answer list. This is Menti's single most requested and most legible feature, and FrogQuiz already has the text-submission plumbing (`TextQuizAnswer`) to build on.
- [ ] **Rating/scale question type.** A 1–5 or 1–10 subjective scale (distinct from `RANGE`'s "guess the right number" game mechanic) with a simple average/distribution result view — useful for team retros and feedback sessions, not just quizzes.
- [ ] **"Anonymous session" mode toggle.** A per-session flag that suppresses nicknames on the host screen and skips scoring/podium entirely, reusing the existing `VOTING`/poll machinery but changing the *session framing* — turns FrogQuiz into a genuine Menti-style feedback tool for meetings, not just a quiz with an ungraded question type.

### Medium value, medium effort
- [ ] **Live Q&A / upvote queue.** A session mode where attendees submit questions instead of answers, others upvote, and the host sees a ranked list to work through live — the single biggest missing all-hands/workshop use case Menti covers and Kahoot doesn't.
- [ ] **Lightweight moderation for open-text submissions.** Once word cloud / Q&A / open `TEXT` responses can appear live on a shared screen, add a host-side approve/hide step before a submission renders — small effort, closes an obvious "something inappropriate hits the projector" risk for an internal tool used across a whole team.
- [ ] **"One join, many slides" session shape.** Explore whether live sessions can support a mixed deck (content slides + interactive slides) under a single join/PIN, rather than the current lobby-then-sequential-questions state machine — this is what makes Menti feel like "presenting," not "gaming." Larger architectural item; worth a design spike before committing.

### Lower priority / nice-to-have
- [ ] **Team mode** (shared-device team scoring) for the game-night use case.
- [ ] **Ghost mode** (asynchronously compete against a previous session's recorded pace/scores).
- [ ] **Image pin/heatmap question type** ("click where on this image...") — Menti feature, no current equivalent.
- [ ] **2x2 prioritization matrix question type** — niche but common in team retros/planning.
- [ ] Audit current scoring for speed-bonus/streak behavior and document/tune it if missing — cheap to verify, meaningful to the game-night feel if absent.

### Explicitly out of scope for MVP2 (enterprise/public-product features, not needed for an internal tool)
- AI-generated quiz authoring, question marketplaces/branded content, PPTX/Google Slides embedding, Teams/Zoom/Classroom integrations, certificates, sponsored content.
