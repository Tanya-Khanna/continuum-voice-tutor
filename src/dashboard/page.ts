export const DASHBOARD_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nomad Mission Control</title>
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
    .metric strong { display: block; margin-top: 8px; font-size: 17px; color: var(--lime); overflow-wrap: anywhere; }
    .detail-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(270px, .75fr); border-top: 1px solid var(--line); }
    .transcript { min-height: 510px; border-right: 1px solid var(--line); padding: 22px; }
    .section-label { color: var(--muted); text-transform: uppercase; letter-spacing: .13em; font-size: 11px; margin-bottom: 18px; }
    .turn { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 12px; margin-bottom: 22px; }
    .turn-no { color: var(--muted); padding-top: 3px; }
    .bubble { border-left: 2px solid var(--blue); padding-left: 14px; }
    .bubble.nomad { border-color: var(--lime); margin-top: 12px; }
    .speaker { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; }
    .analysis { padding: 22px; }
    .card { background: var(--panel-2); border: 1px solid var(--line); border-radius: 13px; padding: 15px; margin-bottom: 13px; }
    .card-label { color: var(--orange); font-size: 11px; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 8px; }
    .card p { margin: 0; overflow-wrap: anywhere; }
    .route { color: var(--blue); }
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
      .hero { grid-template-columns: 1fr; }
      .hero-copy { grid-column: auto; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div>
        <div class="eyebrow">Nomad AI / Mission Control</div>
        <h1>The learning continues.</h1>
      </div>
      <div class="status"><span class="pulse"></span><span id="sync">Waiting for sessions</span></div>
    </header>
    <section class="grid">
      <aside class="panel">
        <div class="panel-head"><strong>Recent sessions</strong><span class="count" id="count">0</span></div>
        <div id="sessions"><div class="empty">No calls recorded yet.</div></div>
      </aside>
      <section class="panel workspace" id="workspace">
        <div class="empty">Start the local text demo or complete a call to see the teaching trace.</div>
      </section>
    </section>
  </main>
  <script>
    const state = { sessions: [], selected: null };
    const text = (tag, value, className) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      node.textContent = value ?? '';
      return node;
    };
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
        top.append(text('span', session.status, 'badge'));
        const meta = text('div', '', 'meta-row');
        meta.append(text('span', session.concept_title));
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
      copy.append(text('h2', session.concept_title));
      copy.append(text('p', 'Anonymized teaching trace · ' + session.status));
      hero.append(copy);
      for (const [label, value] of [['Turns', session.turn_count], ['Mastery', session.mastery_status], ['Language', latest?.language_mode ?? 'pending']]) {
        const metric = text('div', '', 'metric'); metric.append(text('span', label)); metric.append(text('strong', String(value))); hero.append(metric);
      }
      const details = text('div', '', 'detail-grid');
      const transcript = text('div', '', 'transcript'); transcript.append(text('div', 'Conversation', 'section-label'));
      if (!session.turns.length) transcript.append(text('div', 'The lesson has started; no teaching answer has been recorded yet.', 'empty'));
      for (const turn of session.turns) {
        const row = text('div', '', 'turn'); row.append(text('div', String(turn.sequence).padStart(2, '0'), 'turn-no'));
        const content = text('div', '');
        const learner = text('div', '', 'bubble'); learner.append(text('div', 'Learner', 'speaker')); learner.append(text('div', turn.learner_answer));
        const nomad = text('div', '', 'bubble nomad'); nomad.append(text('div', 'Nomad', 'speaker')); nomad.append(text('div', turn.spoken_response));
        content.append(learner, nomad); row.append(content); transcript.append(row);
      }
      const analysis = text('aside', '', 'analysis'); analysis.append(text('div', 'Teaching intelligence', 'section-label'));
      addCard(analysis, 'Latest diagnosis', latest?.diagnosis ?? session.last_diagnosis);
      addCard(analysis, 'Mastery evidence', latest?.mastery_evidence ?? session.mastery_evidence);
      addCard(analysis, 'Next strategy', latest?.next_strategy ?? 'awaiting first answer');
      addCard(analysis, 'Model route', latest?.model_route ?? 'pending', 'route');
      details.append(transcript, analysis); root.append(hero, details);
    }
    async function refresh() {
      try {
        const response = await fetch('/api/dashboard/sessions', { cache: 'no-store' });
        if (!response.ok) throw new Error('Dashboard request failed');
        const payload = await response.json();
        state.sessions = payload.sessions;
        if (!state.sessions.some((item) => item.session_id === state.selected)) state.selected = state.sessions[0]?.session_id ?? null;
        document.querySelector('#sync').textContent = 'Synced ' + relativeTime(payload.generated_at);
        renderList(); renderWorkspace();
      } catch (error) { document.querySelector('#sync').textContent = 'Waiting for server'; }
    }
    refresh(); setInterval(refresh, 3000);
  </script>
</body>
</html>`;
