export const DASHBOARD_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Continuum Mission Control</title>
  <style>
    :root {
      color-scheme: dark;
      --ink: #f4f1e8;
      --muted: #9b9a92;
      --panel: #171916;
      --panel-2: #20231e;
      --line: #34382f;
      --lime: #d4ff68;
      --orange: #ff9b62;
      --blue: #86cfff;
      --paper: #0d0f0c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at 75% -20%, #314022 0, transparent 34rem),
        var(--paper);
      color: var(--ink);
      font: 15px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      min-height: 100vh;
    }
    button { font: inherit; }
    .shell { max-width: 1500px; margin: auto; padding: 28px; }
    header {
      display: flex; align-items: flex-end; justify-content: space-between;
      border-bottom: 1px solid var(--line); padding-bottom: 22px; gap: 20px;
    }
    .eyebrow { color: var(--lime); letter-spacing: .18em; text-transform: uppercase; font-size: 11px; }
    h1 { margin: 7px 0 0; font: 700 clamp(28px, 4vw, 52px)/.95 system-ui, sans-serif; letter-spacing: -.04em; }
    .status { display: flex; align-items: center; gap: 9px; color: var(--muted); }
    .header-tools { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
    .tabs { display: flex; gap: 7px; }
    .tab { color: var(--muted); background: transparent; border: 1px solid var(--line); border-radius: 999px; padding: 7px 11px; cursor: pointer; }
    .tab[aria-selected="true"] { color: var(--paper); border-color: var(--lime); background: var(--lime); }
    .pulse { width: 9px; height: 9px; border-radius: 50%; background: var(--lime); box-shadow: 0 0 16px var(--lime); }
    .grid { display: grid; grid-template-columns: 330px minmax(0, 1fr); gap: 18px; margin-top: 18px; }
    .panel { background: color-mix(in srgb, var(--panel) 94%, transparent); border: 1px solid var(--line); border-radius: 18px; overflow: hidden; }
    .panel-head { padding: 17px 18px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; gap: 12px; }
    .panel-head strong { font-family: system-ui, sans-serif; }
    .count { color: var(--muted); }
    #sessions { max-height: calc(100vh - 170px); overflow: auto; }
    .session {
      width: 100%; text-align: left; color: inherit; background: transparent; border: 0;
      border-bottom: 1px solid var(--line); padding: 17px 18px; cursor: pointer;
    }
    .session:hover, .session[aria-current="true"] { background: var(--panel-2); }
    .session[aria-current="true"] { box-shadow: inset 3px 0 var(--lime); }
    .session-top, .meta-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .session-title { font-weight: 700; }
    .meta-row { color: var(--muted); font-size: 12px; margin-top: 8px; }
    .badge { border: 1px solid var(--line); border-radius: 999px; padding: 3px 8px; font-size: 11px; color: var(--lime); }
    .empty { color: var(--muted); padding: 36px 20px; text-align: center; }
    .workspace { min-width: 0; }
    .hero { padding: 22px; display: grid; grid-template-columns: 1.4fr repeat(3, minmax(110px, .45fr)); gap: 14px; }
    .hero-copy h2 { margin: 4px 0 6px; font: 650 25px/1.1 system-ui, sans-serif; }
    .hero-copy p { margin: 0; color: var(--muted); }
    .metric { background: var(--panel-2); border: 1px solid var(--line); border-radius: 13px; padding: 13px; }
    .metric span { display: block; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .metric strong { display: block; margin-top: 8px; font-size: 17px; color: var(--lime); overflow-wrap: break-word; }
    .detail-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(270px, .75fr); border-top: 1px solid var(--line); }
    .transcript { min-height: 510px; border-right: 1px solid var(--line); padding: 22px; }
    .section-label { color: var(--muted); text-transform: uppercase; letter-spacing: .13em; font-size: 11px; margin-bottom: 18px; }
    .turn { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 12px; margin-bottom: 22px; }
    .turn-no { color: var(--muted); padding-top: 3px; }
    .bubble { border-left: 2px solid var(--blue); padding-left: 14px; }
    .bubble.continuum { border-color: var(--lime); margin-top: 12px; }
    .speaker { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; }
    .analysis { padding: 22px; }
    .card { background: var(--panel-2); border: 1px solid var(--line); border-radius: 13px; padding: 15px; margin-bottom: 13px; }
    .card-label { color: var(--orange); font-size: 11px; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 8px; }
    .card p { margin: 0; overflow-wrap: anywhere; }
    .route { color: var(--blue); }
    .eval-view { margin-top: 18px; }
    .eval-hero { padding: 24px; display: grid; grid-template-columns: 1fr repeat(3, minmax(135px, .35fr)); gap: 14px; }
    .eval-list { border-top: 1px solid var(--line); }
    .eval-section { padding: 22px 20px 12px; border-top: 1px solid var(--line); }
    .eval-row { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(150px, .55fr) 80px minmax(220px, 1.35fr); gap: 14px; padding: 14px 20px; border-bottom: 1px solid var(--line); align-items: center; }
    .eval-row > * { min-width: 0; overflow-wrap: anywhere; }
    .eval-note summary { color: var(--blue); cursor: pointer; }
    .eval-note p { margin: 10px 0 0; color: var(--muted); }
    .pass { color: var(--lime); }
    .fail { color: var(--orange); }
    .sample-view { margin-top: 18px; }
    .sample-hero { padding: 24px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, .65fr); gap: 22px; align-items: center; }
    audio { width: 100%; accent-color: var(--lime); }
    .fixture { color: var(--muted); font-size: 12px; margin-top: 10px; }
    .sample-transcript { border-top: 1px solid var(--line); padding: 20px; }
    .sample-line { width: 100%; display: grid; grid-template-columns: 90px 100px minmax(0, 1fr); gap: 14px; text-align: left; color: inherit; background: transparent; border: 1px solid transparent; border-radius: 12px; padding: 13px; cursor: pointer; }
    .sample-line:hover { background: var(--panel-2); }
    .sample-line.active { border-color: var(--lime); background: var(--panel-2); box-shadow: inset 3px 0 var(--lime); }
    .sample-speaker { color: var(--blue); text-transform: uppercase; font-size: 11px; letter-spacing: .08em; }
    .sample-line[data-speaker="nomad"] .sample-speaker { color: var(--lime); }
    .release-view { margin-top: 18px; }
    .metrics-view { margin-top: 18px; }
    .metrics-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; padding: 22px; border-top: 1px solid var(--line); }
    .metrics-group h3 { margin: 0 0 14px; font-family: system-ui, sans-serif; }
    .release-hero { padding: 24px; display: grid; grid-template-columns: minmax(0, 1fr) repeat(3, minmax(135px, .35fr)); gap: 14px; }
    .release-note { color: var(--muted); margin: 12px 0 0; }
    .release-list { border-top: 1px solid var(--line); }
    .release-check { display: grid; grid-template-columns: 80px minmax(220px, .75fr) minmax(260px, 1.25fr); gap: 16px; padding: 16px 20px; border-bottom: 1px solid var(--line); align-items: start; }
    .release-check > * { min-width: 0; overflow-wrap: anywhere; }
    .guide-link { color: var(--blue); }
    [hidden] { display: none !important; }
    @media (max-width: 900px) {
      .shell { padding: 18px; }
      .grid { grid-template-columns: 1fr; }
      #sessions { max-height: 270px; }
      .hero { grid-template-columns: 1fr 1fr; }
      .hero-copy { grid-column: 1 / -1; }
      .detail-grid { grid-template-columns: 1fr; }
      .transcript { border-right: 0; border-bottom: 1px solid var(--line); }
    }
    @media (max-width: 520px) {
      header { align-items: flex-start; flex-direction: column; }
      .header-tools { align-items: flex-start; }
      .hero { grid-template-columns: 1fr; }
      .hero-copy { grid-column: auto; }
      .eval-hero { grid-template-columns: 1fr; }
      .eval-row { grid-template-columns: 1fr; }
      .sample-hero, .sample-line { grid-template-columns: 1fr; }
      .release-hero, .release-check { grid-template-columns: 1fr; }
      .metrics-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div>
        <div class="eyebrow">Continuum / Mission Control</div>
        <h1>The learning continues.</h1>
      </div>
      <div class="header-tools">
        <div class="status"><span class="pulse"></span><span id="sync">Waiting for sessions</span></div>
        <nav class="tabs" aria-label="Dashboard views">
          <button class="tab" id="sessions-tab" type="button" aria-selected="true">Sessions</button>
          <button class="tab" id="evals-tab" type="button" aria-selected="false">Eval gate</button>
          <button class="tab" id="sample-tab" type="button" aria-selected="false">Sample</button>
          <button class="tab" id="metrics-tab" type="button" aria-selected="false">Outcomes</button>
          <button class="tab" id="release-tab" type="button" aria-selected="false">Release</button>
        </nav>
      </div>
    </header>
    <section class="grid" id="sessions-view">
      <aside class="panel">
        <div class="panel-head"><strong>Recent sessions</strong><span class="count" id="count">0</span></div>
        <div id="sessions"><div class="empty">No calls recorded yet.</div></div>
      </aside>
      <section class="panel workspace" id="workspace">
        <div class="empty">Start the local text demo or complete a call to see the teaching trace.</div>
      </section>
    </section>
    <section class="panel eval-view" id="evals-view" hidden>
      <div class="empty">Running the zero-credit teaching gate…</div>
    </section>
    <section class="panel sample-view" id="sample-view" hidden>
      <div class="empty">Loading the sample exhibit…</div>
    </section>
    <section class="panel metrics-view" id="metrics-view" hidden>
      <div class="empty">Loading access, reliability, and learning evidence…</div>
    </section>
    <section class="panel release-view" id="release-view" hidden>
      <div class="empty">Loading the secret-safe release checklist…</div>
    </section>
  </main>
  <script>
    const dashboardToken = (() => {
      const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get('token');
      if (fragmentToken) {
        try { window.sessionStorage.setItem('nomad-dashboard-token', fragmentToken); } catch {}
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        return fragmentToken;
      }
      try { return window.sessionStorage.getItem('nomad-dashboard-token') ?? ''; } catch { return ''; }
    })();
    const state = { sessions: [], selected: null, evals: null, sample: null, metrics: null, metricsLocked: false, readiness: null, readinessLocked: false, view: 'sessions' };
    const text = (tag, value, className) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      node.textContent = value ?? '';
      return node;
    };
    const humanize = (value) => String(value)
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
    const relativeTime = (iso) => {
      const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
      const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
      if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second');
      const minutes = Math.round(seconds / 60);
      if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
      return formatter.format(Math.round(minutes / 60), 'hour');
    };
    function renderList() {
      const root = document.querySelector('#sessions');
      root.replaceChildren();
      document.querySelector('#count').textContent = String(state.sessions.length);
      if (!state.sessions.length) {
        root.append(text('div', 'No calls recorded yet.', 'empty'));
        return;
      }
      for (const session of state.sessions) {
        const button = text('button', '', 'session');
        button.type = 'button';
        button.setAttribute('aria-current', String(session.session_id === state.selected));
        const top = text('div', '', 'session-top');
        top.append(text('span', session.learner_ref, 'session-title'));
        top.append(text('span', humanize(session.status), 'badge'));
        const meta = text('div', '', 'meta-row');
        meta.append(text('span', session.subject + ' · ' + session.concept_title));
        meta.append(text('span', relativeTime(session.updated_at)));
        button.append(top, meta);
        button.addEventListener('click', () => { state.selected = session.session_id; renderList(); renderWorkspace(); });
        root.append(button);
      }
    }
    function addCard(root, label, value, className = '') {
      const card = text('div', '', 'card');
      card.append(text('div', label, 'card-label'));
      card.append(text('p', value, className));
      root.append(card);
    }
    function renderWorkspace() {
      const root = document.querySelector('#workspace');
      const session = state.sessions.find((item) => item.session_id === state.selected);
      root.replaceChildren();
      if (!session) { root.append(text('div', 'Choose a session to inspect.', 'empty')); return; }
      const latest = session.turns.at(-1);
      const hero = text('div', '', 'hero');
      const copy = text('div', '', 'hero-copy');
      copy.append(text('div', session.learner_ref, 'eyebrow'));
      copy.append(text('h2', session.subject + ' · ' + session.concept_title));
      copy.append(text('p', 'Anonymized teaching trace · ' + humanize(session.status)));
      hero.append(copy);
      for (const [label, value] of [['Interactions', session.turns.length], ['Mastery', humanize(session.mastery_status)], ['Language', latest?.language_mode ?? 'pending']]) {
        const metric = text('div', '', 'metric'); metric.append(text('span', label)); metric.append(text('strong', String(value))); hero.append(metric);
      }
      const details = text('div', '', 'detail-grid');
      const transcript = text('div', '', 'transcript'); transcript.append(text('div', 'Conversation', 'section-label'));
      if (!session.turns.length) transcript.append(text('div', 'The lesson has started; no teaching answer has been recorded yet.', 'empty'));
      for (const turn of session.turns) {
        const row = text('div', '', 'turn'); row.append(text('div', String(turn.sequence).padStart(2, '0'), 'turn-no'));
        const content = text('div', '');
        const modeLabel = turn.mode === 'open_topic' ? 'Open learning' : turn.mode === 'guided' ? 'Legacy guided' : 'Legacy curiosity';
        const learner = text('div', '', 'bubble'); learner.append(text('div', 'Learner · ' + modeLabel, 'speaker')); learner.append(text('div', turn.learner_answer));
        const continuum = text('div', '', 'bubble continuum'); continuum.append(text('div', 'Continuum', 'speaker')); continuum.append(text('div', turn.spoken_response));
        content.append(learner, continuum); row.append(content); transcript.append(row);
      }
      const analysis = text('aside', '', 'analysis'); analysis.append(text('div', 'Teaching intelligence', 'section-label'));
      addCard(analysis, 'Latest diagnosis', latest?.diagnosis ?? session.last_diagnosis);
      addCard(analysis, 'Latest activity', latest?.activity_kind ? humanize(latest.activity_kind) : 'Awaiting first activity');
      const reasoning = latest?.reasoning_trace?.length
        ? latest.reasoning_trace.map((entry) => entry.source.replace('_', ' ') + ' · ' + entry.status + ': ' + entry.claim).join(' | ')
        : 'No redacted reasoning trace for this interaction.';
      addCard(analysis, 'Reasoning trace', reasoning);
      addCard(analysis, 'Teaching system', latest?.mode === 'open_topic' ? 'Open topic · no curriculum menu' : latest?.mode === 'curious_sandbox' ? 'Legacy curiosity' : 'Legacy guided curriculum');
      addCard(analysis, 'Method switch', latest?.strategy_changed === null || latest?.strategy_changed === undefined ? 'Awaiting evidence' : latest.strategy_changed ? 'Changed after learner evidence' : 'Continued with justification');
      addCard(analysis, 'Evidence', latest?.evidence_kind ? humanize(latest.evidence_kind) + ' · ' + humanize(latest.evidence_result) : 'Awaiting learner evidence');
      addCard(analysis, 'Knowledge boundary', latest?.knowledge_state ? humanize(latest.knowledge_state) + ' · human support: ' + humanize(latest.human_support) : 'Legacy session');
      addCard(analysis, 'Mastery evidence', latest?.mastery_evidence ?? session.mastery_evidence);
      addCard(analysis, 'Next strategy', latest?.next_strategy ? humanize(latest.next_strategy) : 'Awaiting first answer');
      addCard(analysis, 'Model route', latest?.model_route ?? 'pending', 'route');
      const usage = session.usage;
      const cost = usage.estimated_cost_usd === null
        ? 'Unavailable · missing exact rate for ' + usage.unpriced_models.join(', ')
        : '$' + usage.estimated_cost_usd.toFixed(6) + (usage.pricing_as_of ? ' · rates ' + usage.pricing_as_of : '');
      addCard(analysis, 'Recorded model usage', usage.request_count + ' responses · ' + usage.total_tokens + ' tokens');
      addCard(analysis, 'Estimated API cost', cost);
      const latency = usage.average_latency_ms === null
        ? 'No measured teaching request yet'
        : Math.round(usage.average_latency_ms) + ' ms average · ' + Math.round(usage.maximum_latency_ms) + ' ms max';
      addCard(analysis, 'GPT-5.6 request latency', latency);
      details.append(transcript, analysis); root.append(hero, details);
    }
    function renderEvals() {
      const root = document.querySelector('#evals-view');
      const report = state.evals;
      root.replaceChildren();
      if (!report) { root.append(text('div', 'Running the zero-credit teaching gate…', 'empty')); return; }
      const hero = text('div', '', 'eval-hero');
      const copy = text('div', '', 'hero-copy');
      copy.append(text('div', 'Deterministic / zero API spend', 'eyebrow'));
      copy.append(text('h2', report.passed === report.total ? 'Teaching gate is green.' : 'Teaching gate needs attention.'));
      copy.append(text('p', 'Open-topic anti-wrapper gates for product contract, pedagogy, evidence, privacy, safety, continuity, and voice.'));
      hero.append(copy);
      for (const [label, value] of [['Cases', report.passed + '/' + report.total], ['Pass rate', Math.round(report.passRate * 100) + '%'], ['Voice friendly', Math.round(report.voiceFriendlyRate * 100) + '%']]) {
        const metric = text('div', '', 'metric'); metric.append(text('span', label)); metric.append(text('strong', value)); hero.append(metric);
      }
      const list = text('div', '', 'eval-list');
      for (const result of report.results) {
        const row = text('div', '', 'eval-row');
        row.append(text('strong', result.id));
        row.append(text('span', result.category));
        row.append(text('span', result.passed ? 'PASS' : 'FAIL', result.passed ? 'pass' : 'fail'));
        row.append(text('span', result.failures.join(' · ') || 'All assertions passed.', 'count'));
        list.append(row);
      }
      root.append(hero, list);
      const agent = report.agent_report;
      const agentHead = text('div', '', 'eval-section');
      agentHead.append(text('div', 'Historical curriculum agent report · not the v7 release gate', 'eyebrow'));
      if (!agent) {
        agentHead.append(text('h2', 'Agent evaluation has not been run.'));
        agentHead.append(text('p', 'Opt-in only: npm run eval:agents -- --confirm-spend --case <id>', 'count'));
        root.append(agentHead);
        return;
      }
      const fullAgentRun = agent.total === 24;
      const agentGreen = agent.passed === agent.total;
      agentHead.append(text('h2', fullAgentRun && agentGreen
        ? 'Full 24-case agent suite is green.'
        : agentGreen
          ? 'Targeted agent run passed; full suite not yet run.'
          : 'Agent evaluation needs attention.'));
      agentHead.append(text('p', agent.passed + '/' + agent.total + ' passed · ' + (agent.input_tokens + agent.output_tokens) + ' recorded text tokens · ' + new Date(agent.generated_at).toLocaleString(), 'count'));
      const agentList = text('div', '', 'eval-list');
      for (const result of agent.results) {
        const row = text('div', '', 'eval-row');
        row.append(text('strong', result.id));
        row.append(text('span', result.category));
        row.append(text('span', result.passed ? 'PASS' : 'FAIL', result.passed ? 'pass' : 'fail'));
        const failures = result.kind === 'execution_error'
          ? [...result.structural_failures, result.error]
          : [...result.structural_failures, ...result.evaluation.failures];
        const rationale = result.kind === 'execution_error'
          ? 'The case failed closed during ' + result.stage + '.'
          : result.evaluation.rationale;
        if (failures.length > 0) {
          row.append(text('span', failures.join(' · '), 'fail'));
        } else {
          const note = document.createElement('details');
          note.className = 'eval-note';
          note.append(text('summary', 'View evaluator note'));
          note.append(text('p', rationale));
          row.append(note);
        }
        agentList.append(row);
      }
      root.append(agentHead, agentList);
    }
    function renderSample() {
      const root = document.querySelector('#sample-view');
      const sample = state.sample;
      root.replaceChildren();
      if (!sample) { root.append(text('div', 'Loading the sample exhibit…', 'empty')); return; }
      const hero = text('div', '', 'sample-hero');
      const copy = text('div', '', 'hero-copy');
      copy.append(text('div', sample.languageModes.join(' · ') + ' / code-switching', 'eyebrow'));
      copy.append(text('h2', sample.title));
      copy.append(text('p', sample.description));
      copy.append(text('div', sample.fixtureNotice + ' Audio: ' + sample.audioModel + '.', 'fixture'));
      const playerWrap = text('div', '');
      const player = document.createElement('audio');
      player.controls = true;
      player.preload = 'metadata';
      player.src = sample.audioUrl;
      player.setAttribute('aria-label', sample.title);
      playerWrap.append(player);
      hero.append(copy, playerWrap);
      const transcript = text('div', '', 'sample-transcript');
      transcript.append(text('div', 'Synced transcript', 'section-label'));
      const lines = [];
      for (const segment of sample.segments) {
        const line = text('button', '', 'sample-line');
        line.type = 'button';
        line.dataset.speaker = segment.speaker;
        line.append(text('span', segment.speaker, 'sample-speaker'));
        line.append(text('span', segment.languageMode, 'route'));
        line.append(text('span', segment.text));
        line.addEventListener('click', () => { player.currentTime = segment.startMs / 1000; void player.play(); });
        lines.push({ line, segment });
        transcript.append(line);
      }
      player.addEventListener('timeupdate', () => {
        const now = player.currentTime * 1000;
        for (const item of lines) item.line.classList.toggle('active', now >= item.segment.startMs && now < item.segment.endMs);
      });
      root.append(hero, transcript);
    }
    function renderReadiness() {
      const root = document.querySelector('#release-view');
      const report = state.readiness;
      root.replaceChildren();
      if (state.readinessLocked) {
        root.append(text('div', 'Release checklist locked · add #token=…', 'empty'));
        return;
      }
      if (!report) {
        root.append(text('div', 'Loading the secret-safe release checklist…', 'empty'));
        return;
      }
      const hero = text('div', '', 'release-hero');
      const copy = text('div', '', 'hero-copy');
      copy.append(text('div', 'Phone / deployment gate', 'eyebrow'));
      copy.append(text('h2', report.ready
        ? 'Configuration is 11/11.'
        : report.smokeTestReady
          ? 'One controlled smoke call is allowed.'
          : 'External setup is still open.'));
      copy.append(text('p', report.ready
        ? 'Continue with measured carrier behavior before publishing the number.'
        : report.smokeTestReady
          ? 'Signed delivery is the sole open check. Keep the number private.'
          : 'Complete only the open actions below; no credential values are displayed.'));
      const guide = text('a', 'Open the setup guide', 'guide-link');
      guide.href = 'https://github.com/Tanya-Khanna/nomad-ai/blob/main/' + report.guidePath;
      guide.target = '_blank';
      guide.rel = 'noreferrer';
      copy.append(text('p', '', 'release-note'));
      copy.lastChild.append(guide);
      hero.append(copy);
      for (const [label, value] of [
        ['Configuration', report.readyCount + '/' + report.totalCount],
        ['First smoke', report.smokeTestReady ? 'Allowed' : 'Blocked'],
        ['Public number', 'Still gated'],
      ]) {
        const metric = text('div', '', 'metric');
        metric.append(text('span', label));
        metric.append(text('strong', value));
        hero.append(metric);
      }
      const list = text('div', '', 'release-list');
      for (const check of report.checks) {
        const row = text('div', '', 'release-check');
        row.append(text('strong', check.ready ? 'PASS' : 'OPEN', check.ready ? 'pass' : 'fail'));
        row.append(text('span', check.label));
        row.append(text('span', check.ready ? 'Verified without displaying its value.' : check.nextAction, 'count'));
        list.append(row);
      }
      root.append(hero, list);
    }
    function renderMetrics() {
      const root = document.querySelector('#metrics-view');
      root.replaceChildren();
      if (state.metricsLocked) {
        root.append(text('div', 'Outcome evidence locked · add #token=…', 'empty'));
        return;
      }
      if (!state.metrics) {
        root.append(text('div', 'Loading access, reliability, and learning evidence…', 'empty'));
        return;
      }
      const hero = text('div', '', 'release-hero');
      const copy = text('div', '', 'hero-copy');
      copy.append(text('div', 'Judge proof / ' + state.metrics.evidenceScope, 'eyebrow'));
      copy.append(text('h2', 'Access. Reliability. Learning.'));
      copy.append(text('p', 'Success means the learner reached, completed, and retained a lesson—not merely that a model answered. Empty and synthetic evidence are labeled honestly.'));
      hero.append(copy);
      const grid = text('div', '', 'metrics-grid');
      for (const groupName of ['access', 'reliability', 'learning']) {
        const group = text('section', '', 'metrics-group');
        group.append(text('h3', humanize(groupName)));
        for (const [name, value] of Object.entries(state.metrics[groupName])) {
          const shown = value === null ? 'Not measured' : typeof value === 'number' && value > 0 && value < 1 ? Math.round(value * 100) + '%' : String(value);
          addCard(group, humanize(name), shown);
        }
        grid.append(group);
      }
      root.append(hero, grid);
    }
    function selectView(view) {
      state.view = view;
      document.querySelector('#sessions-view').hidden = view !== 'sessions';
      document.querySelector('#evals-view').hidden = view !== 'evals';
      document.querySelector('#sample-view').hidden = view !== 'sample';
      document.querySelector('#metrics-view').hidden = view !== 'metrics';
      document.querySelector('#release-view').hidden = view !== 'release';
      document.querySelector('#sessions-tab').setAttribute('aria-selected', String(view === 'sessions'));
      document.querySelector('#evals-tab').setAttribute('aria-selected', String(view === 'evals'));
      document.querySelector('#sample-tab').setAttribute('aria-selected', String(view === 'sample'));
      document.querySelector('#metrics-tab').setAttribute('aria-selected', String(view === 'metrics'));
      document.querySelector('#release-tab').setAttribute('aria-selected', String(view === 'release'));
      if (view === 'evals') renderEvals();
      if (view === 'sample') renderSample();
      if (view === 'metrics') renderMetrics();
      if (view === 'release') renderReadiness();
    }
    document.querySelector('#sessions-tab').addEventListener('click', () => selectView('sessions'));
    document.querySelector('#evals-tab').addEventListener('click', () => selectView('evals'));
    document.querySelector('#sample-tab').addEventListener('click', () => selectView('sample'));
    document.querySelector('#metrics-tab').addEventListener('click', () => selectView('metrics'));
    document.querySelector('#release-tab').addEventListener('click', () => selectView('release'));
    async function refresh() {
      try {
        const response = await fetch('/api/dashboard/sessions', {
          cache: 'no-store',
          headers: dashboardToken ? { Authorization: 'Bearer ' + dashboardToken } : {},
        });
        if (response.status === 401) {
          state.sessions = [];
          state.selected = null;
          document.querySelector('#sync').textContent = 'Sessions locked · add #token=…';
          renderList(); renderWorkspace();
          return;
        }
        if (!response.ok) throw new Error('Dashboard request failed');
        const payload = await response.json();
        state.sessions = payload.sessions;
        if (!state.sessions.some((item) => item.session_id === state.selected)) state.selected = state.sessions[0]?.session_id ?? null;
        document.querySelector('#sync').textContent = 'Synced ' + relativeTime(payload.generated_at);
        renderList(); renderWorkspace();
      } catch (error) { document.querySelector('#sync').textContent = 'Waiting for server'; }
    }
    async function refreshEvals() {
      try {
        const response = await fetch('/api/dashboard/evals', { cache: 'no-store' });
        if (!response.ok) throw new Error('Eval request failed');
        state.evals = await response.json();
        if (state.view === 'evals') renderEvals();
      } catch (error) {
        state.evals = null;
      }
    }
    async function refreshSample() {
      try {
        const response = await fetch('/api/dashboard/sample', { cache: 'no-store' });
        if (!response.ok) throw new Error('Sample request failed');
        state.sample = await response.json();
        if (state.view === 'sample') renderSample();
      } catch (error) {
        state.sample = null;
      }
    }
    async function refreshReadiness() {
      try {
        const response = await fetch('/api/dashboard/readiness', {
          cache: 'no-store',
          headers: dashboardToken ? { Authorization: 'Bearer ' + dashboardToken } : {},
        });
        state.readinessLocked = response.status === 401;
        state.readiness = response.ok ? await response.json() : null;
        if (!response.ok && response.status !== 401) throw new Error('Readiness request failed');
        if (state.view === 'release') renderReadiness();
      } catch (error) {
        state.readiness = null;
      }
    }
    async function refreshMetrics() {
      try {
        const response = await fetch('/api/dashboard/product-metrics', {
          cache: 'no-store',
          headers: dashboardToken ? { Authorization: 'Bearer ' + dashboardToken } : {},
        });
        state.metricsLocked = response.status === 401;
        state.metrics = response.ok ? await response.json() : null;
        if (!response.ok && response.status !== 401) throw new Error('Metrics request failed');
        if (state.view === 'metrics') renderMetrics();
      } catch (error) {
        state.metrics = null;
      }
    }
    refresh(); refreshEvals(); refreshSample(); refreshMetrics(); refreshReadiness(); setInterval(refresh, 3000);
  </script>
</body>
</html>`;
