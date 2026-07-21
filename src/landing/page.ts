function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderLandingPage(options: {
  phoneNumber?: string;
  phoneReady: boolean;
  missedCallEnabled: boolean;
}): string {
  const callable = Boolean(options.phoneReady && options.phoneNumber);
  const phone = options.phoneNumber ? escapeHtml(options.phoneNumber) : "";
  const cta = callable
    ? `<a class="cta" href="tel:${phone}">${options.missedCallEnabled ? "Give a missed call" : "Call Continuum"}<span>${phone}</span></a>`
    : `<div class="cta disabled" aria-disabled="true">Judge phone access is being verified<span>Use the zero-credit local demo today</span></div>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Continuum — The call is the classroom</title>
<meta name="description" content="A persistent multilingual tutor delivered through ordinary phone calls, keypad input, and SMS.">
<style>
:root{color-scheme:dark;--ink:#f8f5ed;--muted:#a9b2b3;--line:#283235;--signal:#d9ff65;--sky:#83d8ff;--bg:#081012}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% 5%,#16363e 0,transparent 35%),var(--bg);color:var(--ink);font:16px/1.5 ui-sans-serif,system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:28px}.nav{display:flex;justify-content:space-between;align-items:center}.brand{font-weight:800;letter-spacing:.08em}.nav a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--line)}.hero{min-height:76vh;display:grid;grid-template-columns:1.3fr .7fr;gap:48px;align-items:center}.eyebrow{color:var(--signal);text-transform:uppercase;letter-spacing:.14em;font-size:.78rem}h1{font-size:clamp(3rem,8vw,7.2rem);line-height:.9;letter-spacing:-.065em;margin:.2em 0}.lead{font-size:clamp(1.15rem,2vw,1.55rem);max-width:670px;color:#d8dedd}.cta{display:inline-flex;flex-direction:column;margin-top:30px;padding:16px 22px;border-radius:999px;background:var(--signal);color:#071012;text-decoration:none;font-weight:800}.cta span{font-size:.78rem;font-weight:600}.cta.disabled{background:#273033;color:#d7dcdc}.phone{width:min(310px,75vw);aspect-ratio:.58;border:2px solid #526165;border-radius:40px;margin:auto;padding:26px;background:#111a1d;box-shadow:0 30px 80px #0008;position:relative}.screen{height:37%;border-radius:16px;background:#c9e3b1;color:#142016;padding:20px;font:600 1rem/1.35 ui-monospace,monospace}.bars{display:flex;gap:5px;align-items:end;height:28px;margin-bottom:28px}.bars i{display:block;width:7px;background:#172617}.bars i:nth-child(1){height:7px}.bars i:nth-child(2){height:12px}.bars i:nth-child(3){height:18px}.bars i:nth-child(4){height:26px;animation:drop 3.2s infinite}.keys{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;margin-top:24px}.keys i{height:34px;border-radius:999px;border:1px solid #566367;background:#1b272a}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:70px 0}.card{border:1px solid var(--line);border-radius:24px;padding:26px;background:#0e181a}.card b{display:block;color:var(--sky);margin-bottom:8px}.proof{border-top:1px solid var(--line);padding:60px 0}.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.step{padding:18px;border-left:2px solid var(--signal)}.memory{font-size:clamp(1.8rem,4vw,3.4rem);max-width:900px;line-height:1.1;padding:80px 0}.fine{color:var(--muted);font-size:.88rem}.links{display:flex;gap:20px;flex-wrap:wrap}.links a{color:var(--sky)}@keyframes drop{0%,45%{height:26px}55%,75%{height:3px}90%,100%{height:26px}}@media(max-width:760px){.hero{grid-template-columns:1fr;padding-top:70px}.phone{order:-1;width:230px}.grid,.steps{grid-template-columns:1fr}.nav{align-items:flex-start;gap:15px}.nav .links{justify-content:flex-end}main{padding:20px}}@media(prefers-reduced-motion:reduce){*{animation:none!important;scroll-behavior:auto!important}}
.screen{height:40%;padding:18px}.bars{margin-bottom:18px}@media(max-width:760px){.screen{padding:16px;font-size:.9rem}.bars{margin-bottom:12px}}
</style></head><body><main>
<nav class="nav"><div class="brand">CONTINUUM</div><div class="links"><a href="/dashboard">Mission Control</a><a href="https://github.com/Tanya-Khanna/nomad-ai">Code</a></div></nav>
<section class="hero"><div><p class="eyebrow">The call is the classroom</p><h1>Learning,<br>without bars.</h1><p class="lead">A patient teacher you can call on any phone. Ask to learn anything; Continuum listens, finds where you are stuck, teaches in your language, and remembers where to continue next time.</p>${cta}<p class="fine">No smartphone. No app. No camera. No internet or mobile data. No reading required. Calls are sponsored only where the local deployment says so.</p></div>
<div class="phone" aria-label="Illustration of a basic keypad phone"><div class="screen"><div class="bars"><i></i><i></i><i></i><i></i></div>Lesson paused.<br>Call back anytime.</div><div class="keys">${"<i></i>".repeat(12)}</div></div></section>
<section class="grid"><article class="card"><b>It teaches, not answers</b>Diagnoses the misconception, changes method when an explanation fails, asks for teach-back, and checks whether understanding transfers.</article><article class="card"><b>It reaches anyone</b>Speech, keypad, and tiny SMS messages keep the lesson moving on a basic phone, even when audio or connectivity fails.</article><article class="card"><b>It speaks your language</b>Language comes first. Continuum adapts its vocabulary, pace, examples, and natural code-switching to the learner.</article><article class="card"><b>It remembers and resumes</b>Learning progress, useful teaching methods, and the exact unfinished activity—not raw recordings or unnecessary personal stories.</article><article class="card"><b>It stays a teacher</b>Child-safety boundaries keep it patient and useful without pretending to be a friend, parent, therapist, or human relationship.</article></section>
<section class="proof"><p class="eyebrow">The connection may drop. The learning continues.</p><div class="steps"><div class="step">1. Call or give a missed call</div><div class="step">2. Learn by voice or keypad</div><div class="step">3. Drop without losing progress</div><div class="step">4. Resume from any phone</div></div></section>
<p class="memory">Continuum remembers what helps you learn and forgets what it does not need.</p>
<section class="proof"><p class="eyebrow">Bring the question</p><p class="memory">Fractions. Photosynthesis. A poem. The moon. Whatever you want to understand.</p><p class="fine">There is no subject menu or syllabus to navigate. Continuum begins with one question: “What would you like to learn?” It teaches with questions, examples, practice, explanation, and honest uncertainty where appropriate.</p></section>
<footer class="proof"><p>Continuum extends teachers and schools. It does not replace them.</p><div class="links"><a href="/dashboard">Open judge proof</a><a href="https://github.com/Tanya-Khanna/nomad-ai#readme">Run locally</a></div></footer>
</main></body></html>`;
}
