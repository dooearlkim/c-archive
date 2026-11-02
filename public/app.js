'use strict';
/* ===================== 공통 ===================== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const linkify = s => esc(s).replace(/https:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const WD = ['일', '월', '화', '수', '목', '금', '토'];
function fmtDate(d, t) { if (!d) return ''; const x = new Date(d + 'T00:00:00'); if (isNaN(x)) return d; return `${x.getFullYear()}.${x.getMonth() + 1}.${x.getDate()}(${WD[x.getDay()]})${t ? ' ' + t : ''}`; }
const fmtDT = iso => { if (!iso) return '-'; const d = new Date(iso); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB';
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2200); }
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('복사했습니다'); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('복사했습니다'); } catch { toast('복사하지 못했습니다'); } ta.remove(); }
}
async function api(method, url, body, raw) {
  try { return await window.Backend.api(method, url, body, raw); }
  catch (e) {
    if (e.status === 401 && DATA && !/login|me\/pin/.test(url)) { DATA = null; showAuth('login', '다시 로그인해 주세요.'); }
    throw e;
  }
}

const ROLE_LABEL = { member: '일반', exec: '집행부', admin: '운영자' };
const RANK = { member: 1, exec: 2, admin: 3 };
const VIS_OPTS = [['member', '일반 — C반 전체 공개'], ['exec', '집행부 이상'], ['admin', '운영자만']];
const visChip = v => v === 'admin' ? '<span class="chip admin">🔒 운영자</span>' : v === 'exec' ? '<span class="chip exec">🔒 집행부</span>' : '<span class="chip member">C반 공개</span>';
const KIND = { event: ['행사', '🎉'], task: ['업무', '✅'], meeting: ['회의', '🗂'] };
const TAG_IC = { '고연전': '⚾', '응원·합응': '📣', '간식·공부행사': '🍙', '개강·교류': '🍻', '단체사진': '📸', '굿즈·공동구매': '🧥', '선거·회의': '🗳', '기타': '📌' };
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  months: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  notices: '<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
  docs: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h7M9 17h7"/>',
  handover: '<path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2.5z"/><path d="M8 7h7"/>',
  admin: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
};

let DATA = null;
const isAdmin = () => DATA?.me.role === 'admin';
const isExecUp = () => RANK[DATA?.me.role] >= 2;
const curMonth = () => new Date().getMonth() + 1;
const noticeById = id => DATA.notices.find(n => n.id === id);

/* ===================== 로그인 · 가입 ===================== */
function pinField(id, label, hint = '') {
  return `<div class="field"><span>${esc(label)}</span><div class="pin" data-pin="${id}">
    <input id="${id}" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="${esc(label)} (숫자 4자리)">
    <div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
}
function bindPins(root) {
  root.querySelectorAll('.pin').forEach(box => {
    const inp = box.querySelector('input'), dots = [...box.querySelectorAll('.dot')];
    const paint = () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 4); dots.forEach((d, i) => { d.classList.toggle('on', i < inp.value.length); d.classList.toggle('cur', i === Math.min(inp.value.length, 3)); }); };
    inp.addEventListener('input', paint);
    inp.addEventListener('focus', () => box.classList.add('focus'));
    inp.addEventListener('blur', () => box.classList.remove('focus'));
    paint();
  });
}
let PUBLIC = null;
async function showAuth(mode = 'login', message = '', ok = false) {
  if (!PUBLIC) { try { PUBLIC = await api('GET', '/api/public'); } catch (e) { PUBLIC = { name: 'C ARCHIVE', org: '', hasAdmin: true, error: e.message }; } }
  $('#app').classList.add('hidden'); closeSheet();
  const a = $('#auth'); a.classList.remove('hidden');
  if (mode === 'pending') {
    a.innerHTML = `<div class="mark">C</div><h1>가입 신청 완료</h1><p class="org">운영자(회장·부회장)가 승인하면 같은 학번과 간편비밀번호로 로그인할 수 있습니다. 승인 전에는 로그인되지 않습니다.</p>
      <div style="margin-top:24px"><button class="btn" style="width:100%" data-act="auth" data-mode="login">로그인 화면으로</button></div>`;
    return;
  }
  const signup = mode === 'signup';
  a.innerHTML = `<div class="mark">C</div><h1>${esc(PUBLIC.name || 'C ARCHIVE')}</h1><p class="org">${esc(PUBLIC.org || '')}</p>
    <div class="seg" style="margin-top:22px"><button data-act="auth" data-mode="login" class="${signup ? '' : 'on'}">로그인</button><button data-act="auth" data-mode="signup" class="${signup ? 'on' : ''}">가입 신청</button></div>
    ${PUBLIC.error ? `<p class="note" style="margin-top:14px;color:var(--danger)">${esc(PUBLIC.error)}</p>` : ''}${!PUBLIC.hasAdmin ? `<p class="note" style="margin-top:14px">아직 운영자가 없습니다. <b>처음 가입하는 사람이 운영자</b>가 됩니다. 회장 본인이 먼저 가입하세요.</p>` : ''}
    <form id="auth-form" novalidate>
      ${signup ? `<label class="field"><span>이름</span><input id="f-name" class="input" maxlength="20" autocomplete="name" required></label>` : ''}
      <label class="field"><span>학번</span><input id="f-sid" class="input" inputmode="numeric" pattern="[0-9]*" maxlength="10" autocomplete="username" placeholder="예: 2026123456" required></label>
      ${pinField('f-pin', '간편비밀번호 (숫자 4자리)', signup ? '0000·1234처럼 쉬운 번호는 쓸 수 없습니다.' : '')}
      ${signup ? pinField('f-pin2', '간편비밀번호 확인') : ''}
      <div id="auth-msg" class="msg ${ok ? 'ok' : 'err'}" role="alert">${esc(message)}</div>
      <button class="btn" type="submit">${signup ? '가입 신청' : '로그인'}</button>
    </form>
    ${signup ? `<p class="org" style="margin-top:16px;font-size:13px">${esc(PUBLIC.welcome || '가입 후 운영자가 승인하면 이용할 수 있습니다.')}</p>` : `<p class="org" style="margin-top:16px;font-size:13px">간편비밀번호를 잊었다면 운영자에게 초기화를 요청하세요.</p>`}`;
  bindPins(a);
  $('#auth-form').onsubmit = async e => {
    e.preventDefault();
    const msg = $('#auth-msg'); msg.className = 'msg err'; msg.textContent = '';
    const sid = $('#f-sid').value.trim(), pin = $('#f-pin').value;
    if (!/^\d{8,10}$/.test(sid)) return (msg.textContent = '학번은 숫자 8~10자리입니다.');
    if (!/^\d{4}$/.test(pin)) return (msg.textContent = '간편비밀번호 4자리를 입력해 주세요.');
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      if (signup) {
        const name = $('#f-name').value.trim();
        if (!name) throw new Error('이름을 입력해 주세요.');
        if (pin !== $('#f-pin2').value) throw new Error('간편비밀번호 확인이 일치하지 않습니다.');
        const r = await api('POST', '/api/signup', { name, studentId: sid, pin });
        if (r.firstAdmin) { PUBLIC = null; toast('최초 운영자로 가입되었습니다'); return load(); }
        return showAuth('pending');
      }
      await api('POST', '/api/login', { studentId: sid, pin });
      await load();
    } catch (err) { msg.textContent = err.message; $('#f-pin').value = ''; bindPins(a); }
    finally { btn.disabled = false; }
  };
}

/* ===================== 데이터 · 라우팅 ===================== */
async function load(keepView = false) {
  try {
    DATA = await api('GET', '/api/bootstrap');
  } catch (e) { if (!DATA) showAuth('login'); return; }
  $('#auth').classList.add('hidden'); $('#app').classList.remove('hidden');
  const r = $('#role'); r.textContent = DATA.me.roleLabel; r.className = 'role ' + DATA.me.role;
  render(keepView);
}
function parseHash() { const [page = 'home', ...rest] = location.hash.replace(/^#\/?/, '').split('/'); return { page, arg: decodeURIComponent(rest.join('/')) }; }
function go(page, arg) { const h = '#/' + page + (arg ? '/' + encodeURIComponent(arg) : ''); if (location.hash === h) render(); else location.hash = h; }
const ui = { nq: '', ntag: 'all', hq: '', mmode: 'month', atab: 'users', ufilter: 'all', kakaoFiles: [], kakaoPlan: null, auditRows: null, users: null };

function render(keepScroll) {
  if (!DATA) return;
  const { page, arg } = parseHash();
  const tabs = [['home', '홈'], ['months', '월별'], ['notices', '공지'], ['docs', '문서'], ['handover', '인수인계']];
  if (isAdmin()) tabs.push(['admin', '관리']);
  const tab = page === 'notice' ? 'notices' : page === 'me' ? '' : (tabs.some(t => t[0] === page) ? page : 'home');
  $('#nav').innerHTML = tabs.map(([k, label]) => `<button data-act="go" data-page="${k}" class="${k === tab ? 'on' : ''}" ${k === tab ? 'aria-current="page"' : ''}>${svg(ICONS[k])}${label}${k === 'handover' && !DATA.handover ? '<span class="lk">🔒</span>' : ''}${k === 'admin' && DATA.pendingCount ? `<span class="badge">${DATA.pendingCount}</span>` : ''}</button>`).join('');
  $('#back').classList.toggle('hidden', !(page === 'notice' || page === 'me'));
  const V = {
    notice: ['공지', () => viewNotice(arg)], me: ['내 정보', viewMe], months: ['월별 업무', () => viewMonths(arg)], notices: ['공지 아카이브', viewNotices],
    docs: ['회칙 · 예결산 · 문서', viewDocs], handover: ['인수인계 노트', viewHandover], admin: ['관리자', viewAdmin], home: [DATA.site.name || 'C ARCHIVE', viewHome],
  }[page === 'notice' || page === 'me' ? page : tab];
  $('#title').textContent = V[0];
  document.title = V[0] === (DATA.site.name || 'C ARCHIVE') ? V[0] : `${V[0]} · ${DATA.site.name || 'C ARCHIVE'}`;
  const y = window.scrollY;
  $('#view').innerHTML = V[1]() + `<div class="footer">${esc(DATA.site.org)}<br>${esc(DATA.site.council)}${DATA.site.updated ? ' · 최종 갱신 ' + esc(DATA.site.updated) : ''}</div>`;
  bindPins($('#view'));
  $('#view').querySelectorAll('input[data-step]').forEach(el => { el.checked = store.get(el.dataset.step) === '1'; });
  if (keepScroll) window.scrollTo(0, y);
  if (page === 'months') setTimeout(() => document.querySelector('.month-pill.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }), 0);
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

/* ===================== 화면: 홈 ===================== */
function noticeRow(n, q) {
  const hl = s => { const e = esc(s); if (!q) return e; return e.replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`); };
  return `<button class="row" data-act="notice" data-id="${esc(n.id)}"><span class="ic">${TAG_IC[n.tag] || '📌'}</span><span class="bd"><span class="tt">${hl(n.title)}</span><span class="sub">${fmtDate(n.date)} · ${esc(n.tag)}${n.followups?.length ? ` · 후속 ${n.followups.length}` : ''}${n.vis !== 'member' ? ' · ' + (n.vis === 'exec' ? '🔒집행부' : '🔒운영자') : ''}</span></span><span class="chev">›</span></button>`;
}
const linkRow = (act, attrs, ic, title, sub, chev = '›') => `<button class="row" data-act="${act}" ${attrs}><span class="ic">${ic}</span><span class="bd"><span class="tt">${esc(title)}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</span><span class="chev">${chev}</span></button>`;
function viewHome() {
  const m = curMonth(), meta = DATA.months.meta?.[m] || {};
  const items = DATA.tasks.filter(t => t.month === m);
  const q = ui.hq.trim();
  let body;
  if (q) {
    const ql = q.toLowerCase(), hit = s => String(s || '').toLowerCase().includes(ql);
    const ts = DATA.tasks.filter(t => hit(t.title) || hit(t.summary) || t.steps.some(hit) || t.tips.some(hit));
    const ns = DATA.notices.filter(n => hit(n.title) || hit(n.body) || hit(n.tag));
    const ds = DATA.documents.filter(d => hit(d.title) || hit(d.summary) || d.list.some(hit) || d.list2.some(hit) || d.files.some(f => hit(f.name)));
    const hs = DATA.handover ? DATA.handover.sections.filter(s => hit(s.title) || hit(s.body)) : [];
    body = `<div class="sec stack">${ts.map(t => linkRow('go', `data-page="months" data-arg="${t.month}"`, '🗓', t.title, `${t.month}월 · ${(KIND[t.kind] || KIND.task)[0]}`)).join('')}
      ${ns.map(n => noticeRow(n, q)).join('')}
      ${ds.map(d => linkRow('go', 'data-page="docs"', '📄', d.title, esc(d.group))).join('')}
      ${hs.map(s => linkRow('go', 'data-page="handover"', '📘', '인수인계 노트 · ' + s.title, '')).join('')}
      ${ts.length + ns.length + ds.length + hs.length ? '' : '<div class="empty">검색 결과가 없습니다.</div>'}</div>`;
  } else {
    const recent = DATA.notices.slice(0, 4);
    body = `${isAdmin() && DATA.empty ? `<div class="sec">${linkRow('admin-tab', 'data-tab="audit"', '📦', '아직 자료가 없습니다 — 초기 자료 가져오기', '관리 → 백업·가져오기에서 초기 자료 파일(.json)을 넣어 주세요')}</div>` : ''}${isAdmin() && DATA.pendingCount ? `<div class="sec">${linkRow('admin-tab', 'data-tab="users"', '🙋', `가입 승인 대기 ${DATA.pendingCount}명`, '권한을 정해 승인해 주세요')}</div>` : ''}
    <section class="sec"><div class="sec-h"><h2>이번 달 · ${m}월 ${esc(meta.theme || '')}</h2><button class="link" data-act="go" data-page="months" data-arg="${m}">전체 ›</button></div>
      <div class="stack">${items.length ? items.map(t => linkRow('go', `data-page="months" data-arg="${m}"`, (KIND[t.kind] || KIND.task)[1], t.title,
        `${esc(t.summary.length > 70 ? t.summary.slice(0, 68) + '…' : t.summary)}${t.vis !== 'member' ? ` ${t.vis === 'exec' ? '· 🔒집행부' : '· 🔒운영자'}` : ''}`)).join('') : '<div class="empty">이번 달에 등록된 업무가 없습니다.</div>'}</div></section>
    <section class="sec"><div class="sec-h"><h2>최근 공지</h2><button class="link" data-act="go" data-page="notices">전체 ${DATA.notices.length}건 ›</button></div><div class="stack">${recent.map(n => noticeRow(n)).join('') || '<div class="empty">공지가 없습니다.</div>'}</div></section>
    <section class="sec"><div class="sec-h"><h2>바로가기</h2></div><div class="stack">
      ${linkRow('go', 'data-page="months" data-arg="recurring"', '🗂', '정기 회의 한눈에', '반운위 · 학운위 · 총회 · 자전대회 · 전학대회')}
      ${linkRow('go', 'data-page="docs"', '📄', '회칙 · 예결산 · 양식', '회칙, 예결산 원문, 공지 템플릿')}
      ${linkRow('go', 'data-page="handover"', '📘', '전임 회장단 인수인계 노트', DATA.handover ? '행사·회의·예결산·인간관계·조언' : '집행부 전용입니다', DATA.handover ? '›' : '🔒')}
    </div></section>`;
  }
  return `<section class="hero"><small>C ARCHIVE · HANDOVER</small><h2>기록을 잇고,<br>다음 학생회를 준비합니다.</h2><p>${esc(DATA.site.org)}</p>
    <div class="meta"><span>${esc(DATA.site.council || '')}</span><span>${esc(DATA.me.name)} · ${esc(DATA.me.roleLabel)}</span></div></section>
    <div class="sec search">${svg(ICONS.search)}<input id="hq" type="search" placeholder="공지·업무·문서 통합 검색" value="${esc(ui.hq)}" aria-label="통합 검색"></div>${body}`;
}

/* ===================== 화면: 월별 ===================== */
function taskCard(t) {
  const [kl, ki] = KIND[t.kind] || KIND.task;
  const steps = t.steps.length ? (t.vis !== 'member'
    ? `<ul class="steps">${t.steps.map((s, i) => `<li><label><input type="checkbox" data-step="ca:chk:${DATA.me.id}:${esc(t.id)}:${i}"><span>${esc(s)}</span></label></li>`).join('')}</ul>`
    : `<ol class="olist">${t.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`) : '';
  const refs = t.refs.map(noticeById).filter(Boolean);
  return `<article class="task ${t.vis}"><div class="task-top"><div class="chips"><span class="chip wine">${ki} ${kl}</span>${visChip(t.vis)}</div>${isAdmin() ? `<button class="ghost sm" data-act="edit" data-kind="task" data-id="${esc(t.id)}">수정</button>` : ''}</div>
    <h3>${esc(t.title)}</h3>${t.summary ? `<p>${esc(t.summary)}</p>` : ''}${steps}${t.tips.map(x => `<div class="tip"><b>TIP</b> ${esc(x)}</div>`).join('')}
    ${refs.length ? `<div class="refs">${refs.map(n => `<button class="ref" data-act="notice" data-id="${esc(n.id)}">📎 ${fmtDate(n.date)} ${esc(n.title)}</button>`).join('')}</div>` : ''}
    ${t.src ? `<div class="src">근거: ${esc(t.src)}</div>` : ''}</article>`;
}
function viewMonths(arg) {
  if (arg === 'recurring') ui.mmode = 'recurring'; else if (arg) ui.mmode = 'month';
  const now = curMonth(), sel = Number(arg) || now, order = DATA.months.order;
  const seg = `<div class="seg"><button data-act="go" data-page="months" data-arg="${sel}" class="${ui.mmode === 'month' ? 'on' : ''}">월별 할 일</button><button data-act="go" data-page="months" data-arg="recurring" class="${ui.mmode === 'recurring' ? 'on' : ''}">정기 회의</button></div>`;
  if (ui.mmode === 'recurring') {
    return seg + `<div class="month-head"><h2>정기 회의</h2><p>임기 내내 반복되는 회의입니다.</p></div>
      ${isAdmin() ? `<div class="actions" style="margin:0 0 12px"><button class="btn sm" data-act="new" data-kind="recurring">+ 정기 회의 추가</button></div>` : ''}<div class="stack">` +
      DATA.recurring.map(r => `<article class="task ${r.vis}"><div class="task-top"><div class="chips"><span class="chip wine">🗂 ${esc(r.cycle)}</span>${r.vis !== 'member' ? visChip(r.vis) : ''}</div>${isAdmin() ? `<button class="ghost sm" data-act="edit" data-kind="recurring" data-id="${esc(r.id)}">수정</button>` : ''}</div>
        <h3>${esc(r.title)}</h3>${r.who ? `<p><b>구성</b> · ${esc(r.who)}</p>` : ''}<p>${esc(r.detail)}</p></article>`).join('') + '</div>';
  }
  const meta = DATA.months.meta?.[sel] || {};
  const items = DATA.tasks.filter(t => t.month === sel);
  const hidden = DATA.hiddenTasks?.[sel] || 0;
  return seg + `<div class="sec scroller" style="margin-top:14px" role="tablist" aria-label="월 선택">${order.map((m, i) =>
      `<button class="pill month-pill ${m === sel ? 'on' : ''}" data-act="go" data-page="months" data-arg="${m}" role="tab" aria-selected="${m === sel}"><b>${m}월</b><small>${m === now ? '이번 달' : i === 0 ? '임기 시작' : ' '}</small></button>`).join('')}</div>
    <div class="month-head"><h2>${sel}월${meta.theme ? ' · ' + esc(meta.theme) : ''}</h2>${meta.summary ? `<p>${esc(meta.summary)}</p>` : ''}</div>
    ${isAdmin() ? `<div class="actions" style="margin:0 0 12px"><button class="btn sm" data-act="new" data-kind="task" data-month="${sel}">+ ${sel}월 업무 추가</button><button class="ghost sm" data-act="month-meta" data-month="${sel}">${sel}월 제목·설명 수정</button></div>` : ''}
    <div class="stack">${items.map(taskCard).join('') || '<div class="empty">등록된 업무가 없습니다.</div>'}
    ${hidden ? `<div class="locked">🔒 이 달에는 집행부 전용 업무 노하우 ${hidden}건이 더 있습니다.</div>` : ''}</div>`;
}

/* ===================== 화면: 공지 ===================== */
function viewNotices() {
  const tags = ['all', ...new Set(DATA.notices.map(n => n.tag))];
  const q = ui.nq.trim().toLowerCase();
  const list = DATA.notices.filter(n => (ui.ntag === 'all' || n.tag === ui.ntag) && (!q || [n.title, n.body, n.tag, ...n.followups.map(f => f.text)].join(' ').toLowerCase().includes(q)));
  const groups = {};
  list.forEach(n => (groups[n.date.slice(0, 7)] ||= []).push(n));
  return `${isAdmin() ? `<div class="actions" style="margin:0 0 12px"><button class="btn sm" data-act="admin-tab" data-tab="kakao">카톡 대화 올리기</button><button class="ghost sm" data-act="new" data-kind="notice">+ 직접 작성</button></div>` : ''}
    <div class="search">${svg(ICONS.search)}<input id="nq" type="search" placeholder="제목·본문 검색" value="${esc(ui.nq)}" aria-label="공지 검색"></div>
    <div class="scroller" style="margin-top:12px">${tags.map(t => `<button class="pill ${t === ui.ntag ? 'on' : ''}" data-act="ntag" data-tag="${esc(t)}">${t === 'all' ? '전체' : (TAG_IC[t] || '') + ' ' + esc(t)}</button>`).join('')}</div>
    <p class="note" style="margin-top:10px">여러 학번 공지방에 같이 올린 공지는 하나로 합쳤습니다. 전화번호·계좌번호는 가렸고, 지난 행사의 신청 링크는 마감되었습니다.</p>
    ${Object.keys(groups).map(k => `<div class="group-label">${Number(k.slice(0, 4))}년 ${Number(k.slice(5))}월 · ${groups[k].length}건</div><div class="stack">${groups[k].map(n => noticeRow(n, ui.nq.trim())).join('')}</div>`).join('') || '<div class="empty">조건에 맞는 공지가 없습니다.</div>'}`;
}
function viewNotice(id) {
  const n = noticeById(id);
  if (!n) return '<div class="empty">공지를 찾을 수 없습니다.</div>';
  const linked = DATA.tasks.filter(t => t.refs.includes(n.id));
  return `<article class="detail">
    <div class="task-top"><div class="chips"><span class="chip wine">${TAG_IC[n.tag] || ''} ${esc(n.tag)}</span>${visChip(n.vis)}</div>${isAdmin() ? `<button class="ghost sm" data-act="edit" data-kind="notice" data-id="${esc(n.id)}">수정</button>` : ''}</div>
    <h2>${esc(n.title)}</h2><div class="when">${fmtDate(n.date, n.time)}</div>
    ${n.note ? `<p class="note" style="margin-top:12px">${esc(n.note)}</p>` : ''}
    <div class="card" style="margin-top:14px"><p class="body" id="nbody">${linkify(n.body)}</p><div class="actions"><button class="ghost" data-act="copy" data-target="nbody">📋 본문 복사</button></div></div>
    ${n.followups.length ? `<section class="sec"><div class="sec-h"><h2>후속 안내</h2></div><div class="card"><ul class="timeline">${n.followups.map(f => `<li><time>${esc(fmtDate(f.date, f.time).slice(5))}</time><span>${esc(f.text)}</span></li>`).join('')}</ul></div></section>` : ''}
    ${n.attachments.length ? `<section class="sec"><div class="sec-h"><h2>원래 첨부</h2></div><div class="card"><div class="chips">${n.attachments.map(a => `<span class="chip">📎 ${esc(a)}</span>`).join('')}</div><p class="src">첨부 원본은 카톡 대화 내보내기에 포함되지 않습니다. 필요하면 「문서」에 올려 두세요.</p></div></section>` : ''}
    ${n.sources.length ? `<section class="sec"><div class="sec-h"><h2>게시 정보</h2></div><div class="card"><dl class="kv">${n.sources.map(s => `<dt>${esc(s.cohort ? s.cohort + '학번방' : s.room || '직접 작성')}</dt><dd>${fmtDate(s.date, s.time)} · ${esc(s.sender)}</dd>`).join('')}</dl></div></section>` : ''}
    ${linked.length ? `<section class="sec"><div class="sec-h"><h2>관련 월별 업무</h2></div><div class="stack">${linked.map(t => linkRow('go', `data-page="months" data-arg="${t.month}"`, '🗓', t.title, `${t.month}월`)).join('')}</div></section>` : ''}
  </article>`;
}

/* ===================== 화면: 문서 ===================== */
function parseTables(text) {
  return String(text || '').split(/\n\s*\n/).map(b => b.split('\n').filter(l => l.trim())).filter(b => b.length).map(lines => {
    let caption = '';
    if (lines[0].startsWith('#')) caption = lines.shift().replace(/^#+\s*/, '');
    const rows = lines.map(l => l.split('|').map(c => c.trim()));
    return { caption, head: rows.shift() || [], rows };
  });
}
const isNum = c => /^[-₩\d,.%\s×*]+$/.test(c) && /\d|^-$/.test(c);
function tableHtml(t) {
  return `<div class="tbl-wrap"><table>${t.caption ? `<caption>${esc(t.caption)}</caption>` : ''}<thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
    ${t.rows.map(r => `<tr class="${/^합계/.test(r[0]) ? 'total' : ''}">${r.map(c => `<td class="${isNum(c) ? 'n' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function docCard(d) {
  const missing = d.needsFile && !d.files.length && !d.url;
  return `<article class="task ${d.vis}">
    <div class="task-top"><div class="chips">${visChip(d.vis)}${missing ? '<span class="chip warn">원문 미등록</span>' : ''}${d.files.length ? `<span class="chip">📎 ${d.files.length}</span>` : ''}</div>
      ${isAdmin() ? `<button class="ghost sm" data-act="edit" data-kind="document" data-id="${esc(d.id)}">수정</button>` : ''}</div>
    <h3>${esc(d.title)}</h3>${d.summary ? `<p>${esc(d.summary)}</p>` : ''}
    ${d.files.length ? `<div class="files">${d.files.map(f => `<button class="file" data-act="open-file" data-id="${esc(f.id)}">📄<span class="fn">${esc(f.name)}</span><small>${fmtSize(f.size)} · ${esc(fmtDT(f.uploaded_at).slice(0, 10))}</small></button>`).join('')}</div>` : ''}
    ${d.url ? `<div class="actions"><a class="ghost" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">원문 링크 열기 ↗</a></div>` : ''}
    ${isAdmin() ? `<div class="actions"><label class="ghost sm" style="cursor:pointer">📎 파일 올리기<input type="file" multiple hidden data-upload="${esc(d.id)}"></label><span class="src" style="margin:0" id="up-${esc(d.id)}"></span></div>` : ''}
    ${d.list.length ? `${d.listTitle ? `<p style="margin-top:12px"><b>${esc(d.listTitle)}</b></p>` : ''}<ul class="olist">${d.list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${d.list2.length ? `${d.list2Title ? `<p style="margin-top:12px"><b>${esc(d.list2Title)}</b></p>` : ''}<ol class="olist">${d.list2.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    ${parseTables(d.tables).map(tableHtml).join('')}
    ${d.template ? `<pre class="tpl" id="tpl-${esc(d.id)}">${esc(d.template)}</pre><div class="actions"><button class="ghost" data-act="copy" data-target="tpl-${esc(d.id)}">📋 템플릿 복사</button></div>` : ''}
    ${d.note ? `<div class="tip">${esc(d.note)}</div>` : ''}
  </article>`;
}
function viewDocs() {
  const groups = [...new Set(DATA.documents.map(d => d.group))];
  return `${isAdmin() ? `<div class="actions" style="margin:0 0 12px"><button class="btn sm" data-act="new" data-kind="document">+ 문서 추가</button></div>` : ''}
    <p class="note">회칙·예결산 원문은 운영자가 파일(PDF·한글·워드·엑셀 등)로 올리거나 링크로 등록합니다. <span class="chip warn">원문 미등록</span>은 아직 원본이 없는 자료입니다.</p>` +
    groups.map(g => `<div class="group-label">${esc(g)}</div><div class="stack">${DATA.documents.filter(d => d.group === g).map(docCard).join('')}</div>`).join('') +
    (DATA.hiddenDocs ? `<div class="locked" style="margin-top:14px">🔒 집행부 전용 문서 ${DATA.hiddenDocs}건이 더 있습니다.</div>` : '');
}

/* ===================== 화면: 인수인계 ===================== */
function mini(body) {
  return String(body || '').split(/\n\s*\n/).map(b => {
    const lines = b.split('\n').filter(l => l.trim());
    if (!lines.length) return '';
    if (lines.every(l => /^\d+[.)]\s/.test(l))) return `<ol>${lines.map(l => `<li>${esc(l.replace(/^\d+[.)]\s/, ''))}</li>`).join('')}</ol>`;
    if (lines.every(l => /^[-•]\s/.test(l))) return `<ul>${lines.map(l => `<li>${esc(l.replace(/^[-•]\s/, ''))}</li>`).join('')}</ul>`;
    return `<p>${lines.map(esc).join('<br>')}</p>`;
  }).join('');
}
function viewHandover() {
  if (!DATA.handover) {
    return `<div class="locked" style="padding:36px 18px"><div style="font-size:34px">🔒</div><p style="font-weight:700;color:var(--ink);margin:8px 0 4px">집행부 전용</p><p style="margin:0">전임 회장단의 인수인계 노트는 집행부 이상 권한으로만 볼 수 있습니다. 권한이 필요하면 운영자에게 요청하세요.</p></div>`;
  }
  const { meta, sections } = DATA.handover;
  const pinned = sections.find(s => s.pinned);
  const advice = pinned ? String(pinned.body).split('\n').filter(l => /^\d+[.)]\s/.test(l)).map(l => l.replace(/^\d+[.)]\s/, '')) : [];
  return `${meta.preface ? `<div class="warnbox"><b>공유 금지</b> · ${esc(meta.preface)}</div>` : ''}
    <div class="month-head"><h2>${esc(meta.title || '인수인계 노트')}</h2><p>${esc([meta.author, meta.written].filter(Boolean).join(' · '))}</p></div>
    ${isAdmin() ? `<div class="actions" style="margin:0 0 12px"><button class="btn sm" data-act="new" data-kind="handover">+ 장 추가</button><button class="ghost sm" data-act="admin-tab" data-tab="settings">제목·작성자 수정</button></div>` : ''}
    ${advice.length ? `<section class="sec" style="margin-top:8px"><div class="sec-h"><h2>꼭 지킬 것 ${advice.length}가지</h2></div><ol class="advice">${advice.map(x => `<li>${esc(x)}</li>`).join('')}</ol></section>` : ''}
    <section class="sec"><div class="sec-h"><h2>원문</h2><span class="src" style="margin:0">눌러서 펼치기</span></div>
    ${sections.map((s, i) => `<details class="acc" ${i === 0 ? 'open' : ''}><summary><span>${i + 1}. ${esc(s.title)} ${s.vis === 'admin' ? '<span class="chip admin">🔒 운영자</span>' : ''}</span></summary><div class="in prose">${mini(s.body)}
      ${isAdmin() ? `<div class="actions" style="margin:0 0 12px"><button class="ghost sm" data-act="edit" data-kind="handover" data-id="${esc(s.id)}">이 장 수정</button></div>` : ''}</div></details>`).join('')}</section>`;
}

/* ===================== 화면: 내 정보 ===================== */
function viewMe() {
  const m = DATA.me;
  return `<div class="card"><dl class="kv" style="font-size:15px"><dt>이름</dt><dd>${esc(m.name)}</dd><dt>학번</dt><dd>${esc(m.studentId)}</dd><dt>권한</dt><dd><span class="chip ${m.role}">${esc(m.roleLabel)}</span></dd></dl></div>
    <section class="sec"><div class="sec-h"><h2>간편비밀번호 변경</h2></div><form class="card" id="pin-form" style="display:grid;gap:14px">
      ${pinField('p-cur', '현재 간편비밀번호')}${pinField('p-new', '새 간편비밀번호')}${pinField('p-new2', '새 간편비밀번호 확인')}
      <div id="pin-msg" class="msg err" role="alert"></div><button class="btn" type="submit">변경</button></form></section>
    <section class="sec"><button class="ghost danger" style="width:100%" data-act="logout">로그아웃</button></section>
    <p class="src" style="text-align:center">권한 변경은 운영자(회장·부회장)에게 요청하세요.</p>`;
}

/* ===================== 화면: 관리자 ===================== */
function viewAdmin() {
  if (!isAdmin()) return '<div class="empty">운영자만 볼 수 있습니다.</div>';
  const tabs = [['users', '회원 승인', DATA.pendingCount], ['kakao', '카톡 공지'], ['content', '월별·문서'], ['settings', '사이트 설정'], ['audit', '백업·가져오기']];
  const t = ui.atab;
  const body = t === 'users' ? adminUsers() : t === 'kakao' ? adminKakao() : t === 'content' ? adminContent() : t === 'settings' ? adminSettings() : adminAudit();
  return `<div class="scroller">${tabs.map(([k, l, c]) => `<button class="pill ${k === t ? 'on' : ''}" data-act="admin-tab" data-tab="${k}">${l}${c ? ` <span class="cnt">${c}</span>` : ''}</button>`).join('')}</div><div class="sec" style="margin-top:14px">${body}</div>`;
}
const roleSelect = (id, cur, placeholder) => `<select class="input" id="${id}" aria-label="권한">${placeholder ? `<option value="">${placeholder}</option>` : ''}${['member', 'exec', 'admin'].map(r => `<option value="${r}" ${r === cur ? 'selected' : ''}>${ROLE_LABEL[r]}${r === 'member' ? ' (C반 공용)' : r === 'admin' ? ' (회장·부회장)' : ''}</option>`).join('')}</select>`;
function adminUsers() {
  if (!ui.users) { loadUsers(); return '<div class="empty">불러오는 중…</div>'; }
  const pend = ui.users.filter(u => u.status === 'pending');
  const F = { all: '전체', admin: '운영자', exec: '집행부', member: '일반', off: '중지·거절' };
  const rest = ui.users.filter(u => u.status !== 'pending').filter(u => ui.ufilter === 'all' || (ui.ufilter === 'off' ? u.status !== 'active' : u.status === 'active' && u.role === ui.ufilter));
  const st = u => u.status === 'active' ? '' : `<span class="chip warn">${u.status === 'rejected' ? '거절됨' : '이용 중지'}</span>`;
  return `<div class="sec-h"><h2>승인 대기 ${pend.length}명</h2></div>
    <div class="stack">${pend.map(u => `<div class="card user"><div class="user-h"><div><b>${esc(u.name)}</b><small>${esc(u.student_id)} · 신청 ${esc(fmtDT(u.created_at))}</small></div></div>
      <div class="grid2">${roleSelect('role-' + u.id, '', '권한 선택 (필수)')}<button class="btn sm" data-act="approve" data-id="${u.id}">승인</button></div>
      <div class="actions" style="margin:0"><button class="ghost sm danger" data-act="uact" data-do="reject" data-id="${u.id}">거절</button></div></div>`).join('') || '<div class="empty" style="padding:18px">대기 중인 가입 신청이 없습니다.</div>'}</div>
    <div class="sec-h" style="margin-top:26px"><h2>회원 ${ui.users.length - pend.length}명</h2></div>
    <div class="scroller">${Object.entries(F).map(([k, l]) => `<button class="pill ${k === ui.ufilter ? 'on' : ''}" data-act="ufilter" data-f="${k}">${l}</button>`).join('')}</div>
    <div class="stack" style="margin-top:8px">${rest.map(u => `<details class="acc"><summary><span><b>${esc(u.name)}</b> <span class="chip ${u.role || ''}">${esc(ROLE_LABEL[u.role] || '-')}</span> ${st(u)}<br><small style="color:var(--muted);font-weight:500;font-size:12.5px">${esc(u.student_id)} · 최근 접속 ${esc(fmtDT(u.last_login))}</small></span></summary>
      <div class="in" style="display:grid;gap:10px;padding-bottom:16px">
        ${u.role ? `<div class="grid2">${roleSelect('role-' + u.id, u.role)}<button class="btn sm" data-act="uact" data-do="role" data-id="${u.id}">권한 변경</button></div>` : ''}
        <div class="actions" style="margin:0"><button class="ghost sm" data-act="resetpin" data-id="${u.id}">간편비밀번호 초기화</button>
          ${u.status === 'active' ? `<button class="ghost sm" data-act="uact" data-do="disable" data-id="${u.id}">이용 중지</button>` : u.role ? `<button class="ghost sm" data-act="uact" data-do="enable" data-id="${u.id}">이용 재개</button>` : `<button class="ghost sm" data-act="pending-approve" data-id="${u.id}">다시 승인</button>`}
          <button class="ghost sm danger" data-act="uact" data-do="delete" data-id="${u.id}">삭제</button></div>
        <p class="src" style="margin:0">가입 ${esc(fmtDT(u.created_at))}${u.approved_by ? ` · 승인 ${esc(u.approved_by)}` : ''}</p></div></details>`).join('') || '<div class="empty">해당 회원이 없습니다.</div>'}</div>`;
}
async function loadUsers() { try { ui.users = await api('GET', '/api/admin/users'); DATA.pendingCount = ui.users.filter(u => u.status === 'pending').length; render(true); } catch (e) { toast(e.message); } }
function adminKakao() {
  const p = ui.kakaoPlan;
  return `<div class="card"><h3 style="margin:0 0 6px;font-size:16px">카카오톡 공지방 대화 올리기</h3>
    <ol class="olist" style="margin-top:4px;font-size:13.5px"><li>카카오톡 공지방 → 메뉴(≡) → 설정 → <b>대화 내보내기</b> → 텍스트로 저장</li><li>학번별 공지방 파일을 <b>한 번에 같이</b> 선택하면 같은 공지는 하나로 합쳐집니다</li><li>미리보기 확인 후 <b>가져오기</b></li></ol>
    <label class="drop" style="margin-top:12px"><b>📂 .txt 파일 선택</b>여러 개 선택 가능 · 전화번호·계좌번호는 자동으로 가려집니다<input type="file" id="kakao-input" accept=".txt,text/plain" multiple></label>
    ${ui.kakaoFiles.length ? `<div class="chips" style="margin-top:10px">${ui.kakaoFiles.map(f => `<span class="chip">📄 ${esc(f.name)}</span>`).join('')}</div>
      <div class="actions"><button class="btn sm" data-act="kakao" data-commit="0">미리보기</button><button class="ghost sm" data-act="kakao-clear">선택 취소</button></div>` : ''}</div>
    ${p ? `<section class="sec"><div class="sec-h"><h2>${p.committed ? '가져오기 완료' : '미리보기'}</h2></div>
      <div class="card"><p style="margin:0 0 8px">새 공지 <b>${p.added.length}건</b> · 기존 공지 보완 <b>${p.updated.length}건</b> · 이미 있음 ${p.unchanged}건</p>
      ${p.added.length ? `<div class="stack" style="margin-top:8px">${p.added.map(n => `<div class="row" style="padding:10px 12px"><span class="bd"><span class="tt" style="font-size:14px">${esc(n.title)}</span><span class="sub">${fmtDate(n.date, n.time)} · ${esc(n.tag)} · ${n.rooms.map(r => esc(r) + (/^\d+$/.test(r) ? '학번방' : '')).join(', ')}</span></span></div>`).join('')}</div>` : ''}
      ${!p.committed && (p.added.length || p.updated.length) ? `<p class="src">새 공지는 'C반 공개'로 등록됩니다. 제목·분류·공개 범위는 가져온 뒤 공지에서 수정할 수 있습니다.</p><div class="actions"><button class="btn" style="flex:1" data-act="kakao" data-commit="1">${p.added.length + p.updated.length}건 가져오기</button></div>` : ''}
      ${p.committed ? `<div class="actions"><button class="ghost" data-act="go" data-page="notices">공지 아카이브 보기 ›</button></div>` : ''}</div></section>` : ''}`;
}
function adminContent() {
  const order = DATA.months.order;
  return `<div class="sec-h"><h2>월별 업무</h2><button class="link" data-act="new" data-kind="task">+ 추가</button></div>
    <div class="stack list-admin">${order.map(m => { const n = DATA.tasks.filter(t => t.month === m).length; return linkRow('go', `data-page="months" data-arg="${m}"`, `<b style="font-size:14px">${m}월</b>`, DATA.months.meta?.[m]?.theme || '(제목 없음)', `업무 ${n}건`); }).join('')}
      ${linkRow('go', 'data-page="months" data-arg="recurring"', '🗂', '정기 회의', `${DATA.recurring.length}건`)}</div>
    <div class="sec-h" style="margin-top:26px"><h2>문서 (회칙·예결산·양식)</h2><button class="link" data-act="new" data-kind="document">+ 추가</button></div>
    <div class="stack">${DATA.documents.map(d => linkRow('edit', `data-kind="document" data-id="${esc(d.id)}"`, '📄', d.title, `${esc(d.group)} · ${d.files.length ? '파일 ' + d.files.length + '개' : d.url ? '링크' : d.needsFile ? '<span style="color:var(--danger)">원문 미등록</span>' : '본문'} · ${esc(ROLE_LABEL[d.vis])}`, '수정')).join('')}</div>
    <div class="sec-h" style="margin-top:26px"><h2>인수인계 노트</h2><button class="link" data-act="new" data-kind="handover">+ 장 추가</button></div>
    <div class="stack">${(DATA.handover?.sections || []).map((s, i) => linkRow('edit', `data-kind="handover" data-id="${esc(s.id)}"`, '📘', `${i + 1}. ${s.title}`, `${esc(ROLE_LABEL[s.vis])}${s.pinned ? ' · 꼭 지킬 것 카드' : ''}`, '수정')).join('')}</div>`;
}
function adminSettings() {
  const s = DATA.site, M = DATA.months, H = DATA.handover?.meta || {};
  const f = (id, label, v, hint = '') => `<label class="field"><span>${label}</span><input class="input" id="${id}" value="${esc(v || '')}">${hint ? `<small>${hint}</small>` : ''}</label>`;
  return `<form class="card" id="site-form" style="display:grid;gap:12px"><h3 style="margin:0;font-size:16px">사이트 정보</h3>
      ${f('s-name', '사이트 이름', s.name)}${f('s-org', '단체 이름', s.org)}${f('s-council', '현재 학생회장단', s.council, '예: 제19대 학생회장단 ○○○')}${f('s-updated', '최종 갱신일 표시', s.updated)}
      ${f('s-welcome', '가입 화면 안내 문구', s.welcome)}<button class="btn sm" type="submit">저장</button></form>
    <form class="card" id="months-form" style="display:grid;gap:12px;margin-top:14px"><h3 style="margin:0;font-size:16px">월별 업무 순서·제목</h3>
      <label class="field"><span>임기 시작 월</span><select class="input" id="m-start">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${M.order[0] === i + 1 ? 'selected' : ''}>${i + 1}월</option>`).join('')}</select><small>월 선택 줄이 이 달부터 시작합니다.</small></label>
      ${M.order.map(m => `<div class="field"><span>${m}월</span><input class="input" data-mtheme="${m}" placeholder="제목 (예: 가장 바쁜 달)" value="${esc(M.meta?.[m]?.theme || '')}"><input class="input" data-msum="${m}" placeholder="한 줄 설명 (선택)" value="${esc(M.meta?.[m]?.summary || '')}"></div>`).join('')}
      <button class="btn sm" type="submit">저장</button></form>
    <form class="card" id="ho-form" style="display:grid;gap:12px;margin-top:14px"><h3 style="margin:0;font-size:16px">인수인계 노트 머리말</h3>
      ${f('h-title', '제목', H.title)}${f('h-author', '작성자', H.author)}${f('h-written', '작성 시기', H.written)}
      <label class="field"><span>공유 주의 문구</span><textarea class="input" id="h-preface">${esc(H.preface || '')}</textarea></label><button class="btn sm" type="submit">저장</button></form>`;
}
function adminAudit() {
  if (!ui.auditRows) { api('GET', '/api/admin/audit').then(r => { ui.auditRows = r; render(true); }).catch(e => toast(e.message)); return '<div class="empty">불러오는 중…</div>'; }
  return `<div class="card"><h3 style="margin:0 0 6px;font-size:16px">백업</h3><p class="src" style="margin:0 0 10px">공지·업무·문서·인수인계 노트와 회원 목록(간편비밀번호 제외)을 JSON 파일로 내려받습니다. 첨부 파일 원본은 Supabase 대시보드 Storage의 docs 폴더에 있습니다.</p>
      <button class="ghost" data-act="export">⬇ 백업 파일 내려받기</button></div>
    <div class="card" style="margin-top:14px"><h3 style="margin:0 0 6px;font-size:16px">자료 가져오기</h3><p class="src" style="margin:0 0 10px">처음 시작할 때 받은 <b>초기 자료 파일</b>이나 백업 파일(.json)을 넣습니다. 같은 항목은 파일 내용으로 덮어씁니다. 회원 정보와 첨부 파일은 가져오지 않습니다.</p>
      <label class="drop"><b>📂 .json 파일 선택</b><input type="file" id="import-input" accept=".json,application/json"></label></div>
    <section class="sec"><div class="sec-h"><h2>최근 활동 기록</h2><button class="link" data-act="audit-refresh">새로고침</button></div>
    <div class="card"><ul class="audit">${ui.auditRows.map(a => `<li><time>${esc(fmtDT(a.at))} · ${esc(a.user || '-')}</time><b>${esc(a.action)}</b> ${esc(a.detail || '')}</li>`).join('') || '<li>기록이 없습니다.</li>'}</ul></div></section>`;
}

/* ===================== 편집 시트 ===================== */
const FORMS = {
  notice: { label: '공지', fields: [['title', '제목', 'text'], ['vis', '공개 범위', 'vis'], ['date', '날짜', 'date'], ['time', '시각', 'time'], ['tag', '분류', 'tag'],
    ['body', '본문', 'tall'], ['note', '안내 메모 (본문 위에 표시, 선택)', 'textarea'], ['followups', '후속 안내 (한 줄에 하나 · 형식: 2026-10-15 17:50 | 내용)', 'followups'], ['attachments', '원래 첨부 이름 (한 줄에 하나)', 'lines']] },
  task: { label: '월별 업무', fields: [['month', '월', 'month'], ['kind', '종류', 'kind'], ['vis', '공개 범위', 'vis'], ['title', '제목', 'text'], ['summary', '설명', 'textarea'],
    ['steps', '할 일·절차 (한 줄에 하나 · 집행부 이상 업무는 체크박스로 표시)', 'lines'], ['tips', 'TIP (한 줄에 하나)', 'lines'], ['refs', '관련 공지', 'refs'], ['src', '근거 (예: 인수인계 문서, 2026 공지)', 'text'], ['sort', '표시 순서 (작을수록 위)', 'number']] },
  recurring: { label: '정기 회의', fields: [['title', '회의 이름', 'text'], ['vis', '공개 범위', 'vis'], ['cycle', '주기', 'text'], ['who', '구성', 'text'], ['detail', '설명', 'textarea'], ['sort', '표시 순서', 'number']] },
  document: { label: '문서', fields: [['title', '제목', 'text'], ['vis', '공개 범위', 'vis'], ['group', '분류 (예: 회칙·규정, 예결산, 회의·양식)', 'group'], ['needsFile', '원문 파일이 있어야 하는 문서 (없으면 "원문 미등록" 표시)', 'check'],
    ['summary', '설명', 'textarea'], ['url', '원문 링크 (구글 드라이브 등 https 주소, 선택)', 'text'], ['listTitle', '목록 1 제목', 'text'], ['list', '목록 1 (한 줄에 하나)', 'lines'],
    ['list2Title', '목록 2 제목', 'text'], ['list2', '목록 2 (한 줄에 하나)', 'lines'], ['tables', '표 (선택) — 첫 줄 "# 표 제목", 다음 줄 머리글, 칸은 | 로 구분, 표 사이는 빈 줄', 'tall'],
    ['template', '복사용 템플릿 (선택)', 'textarea'], ['note', '참고 메모', 'textarea'], ['sort', '표시 순서', 'number']] },
  handover: { label: '인수인계 노트 장', fields: [['title', '장 제목', 'text'], ['vis', '공개 범위', 'vis'], ['pinned', '이 장의 번호 목록을 "꼭 지킬 것" 카드로 맨 위에 보여주기', 'check'],
    ['body', '본문 — 문단 사이는 빈 줄, "1. " 로 시작하면 번호 목록, "- " 로 시작하면 글머리 목록', 'tall'], ['sort', '표시 순서', 'number']] },
};
function fieldHtml([key, label, type], item) {
  const v = item[key];
  const id = 'e-' + key;
  const wrap = inner => `<label class="field"><span>${esc(label)}</span>${inner}</label>`;
  switch (type) {
    case 'vis': return wrap(`<select class="input" id="${id}">${item.id ? '' : '<option value="">선택하세요 (필수)</option>'}${VIS_OPTS.map(([k, l]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`);
    case 'month': return wrap(`<select class="input" id="${id}">${DATA.months.order.map(m => `<option value="${m}" ${Number(v) === m ? 'selected' : ''}>${m}월</option>`).join('')}</select>`);
    case 'kind': return wrap(`<select class="input" id="${id}">${Object.entries(KIND).map(([k, [l, i]]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${i} ${l}</option>`).join('')}</select>`);
    case 'textarea': return wrap(`<textarea class="input" id="${id}">${esc(v || '')}</textarea>`);
    case 'tall': return wrap(`<textarea class="input tall" id="${id}">${esc(v || '')}</textarea>`);
    case 'lines': return wrap(`<textarea class="input" id="${id}">${esc((v || []).join('\n'))}</textarea>`);
    case 'followups': return wrap(`<textarea class="input" id="${id}">${esc((v || []).map(f => `${f.date} ${f.time} | ${f.text}`.trim()).join('\n'))}</textarea>`);
    case 'check': return `<label class="check" style="display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.5"><input type="checkbox" id="${id}" ${v ? 'checked' : ''} style="width:20px;height:20px;flex:none;accent-color:var(--wine)"> ${esc(label)}</label>`;
    case 'number': return wrap(`<input class="input" id="${id}" type="number" step="any" value="${esc(v ?? '')}">`);
    case 'date': return wrap(`<input class="input" id="${id}" type="date" value="${esc(v || new Date().toISOString().slice(0, 10))}">`);
    case 'time': return wrap(`<input class="input" id="${id}" type="time" value="${esc(v || '12:00')}">`);
    case 'tag': return wrap(`<input class="input" id="${id}" list="dl-tag" value="${esc(v || '')}"><datalist id="dl-tag">${[...new Set([...Object.keys(TAG_IC), ...DATA.notices.map(n => n.tag)])].map(t => `<option value="${esc(t)}">`).join('')}</datalist>`);
    case 'group': return wrap(`<input class="input" id="${id}" list="dl-group" value="${esc(v || '')}"><datalist id="dl-group">${[...new Set(DATA.documents.map(d => d.group))].map(t => `<option value="${esc(t)}">`).join('')}</datalist>`);
    case 'refs': return `<div class="field"><span>${esc(label)}</span><div class="checklist" id="${id}">${DATA.notices.map(n => `<label><input type="checkbox" value="${esc(n.id)}" ${(v || []).includes(n.id) ? 'checked' : ''}><span>${fmtDate(n.date)} ${esc(n.title)}</span></label>`).join('')}</div></div>`;
    default: return wrap(`<input class="input" id="${id}" value="${esc(v ?? '')}">`);
  }
}
function collect(kind) {
  const data = {}; let vis = '', sort;
  for (const [key, , type] of FORMS[kind].fields) {
    const el = document.getElementById('e-' + key);
    if (type === 'vis') { vis = el.value; continue; }
    if (key === 'sort') { if (el.value !== '') sort = Number(el.value); continue; }
    if (type === 'lines') data[key] = el.value.split('\n').map(s => s.trim()).filter(Boolean);
    else if (type === 'followups') data[key] = el.value.split('\n').map(s => s.trim()).filter(Boolean).map(l => { const m = l.match(/^(\d{4}-\d{2}-\d{2})?\s*(\d{2}:\d{2})?\s*\|\s*(.+)$/); return m ? { date: m[1] || '', time: m[2] || '', text: m[3] } : { date: '', time: '', text: l }; });
    else if (type === 'check') data[key] = el.checked;
    else if (type === 'refs') data[key] = [...el.querySelectorAll('input:checked')].map(i => i.value);
    else if (type === 'month') data[key] = Number(el.value);
    else data[key] = el.value;
  }
  return { data, vis, sort };
}
function closeSheet() { const s = $('#sheet'); s.classList.add('hidden'); s.innerHTML = ''; document.body.style.overflow = ''; }
function openSheet(title, bodyHtml, footHtml) {
  const s = $('#sheet');
  s.innerHTML = `<div class="sheet-card"><div class="sheet-h"><h2 id="sheet-title">${esc(title)}</h2><button class="icon-btn" data-act="close-sheet" aria-label="닫기">✕</button></div><div class="sheet-b">${bodyHtml}</div>${footHtml ? `<div class="sheet-f">${footHtml}</div>` : ''}</div>`;
  s.classList.remove('hidden'); document.body.style.overflow = 'hidden';
  bindPins(s);
}
function findItem(kind, id) {
  const list = { notice: DATA.notices, task: DATA.tasks, recurring: DATA.recurring, document: DATA.documents, handover: DATA.handover?.sections || [] }[kind];
  return list.find(x => x.id === id);
}
function openEditor(kind, id, defaults = {}) {
  const item = id ? findItem(kind, id) : { ...defaults };
  if (id && !item) return toast('항목을 찾을 수 없습니다.');
  const F = FORMS[kind];
  const files = kind === 'document' && id ? `<div class="field"><span>첨부 파일</span><div class="files">${item.files.map(f => `<div class="file">📄<span class="fn">${esc(f.name)}</span><small>${fmtSize(f.size)}</small><button type="button" class="ghost sm danger" data-act="del-file" data-id="${esc(f.id)}" data-doc="${esc(id)}">삭제</button></div>`).join('') || '<small>아직 올린 파일이 없습니다.</small>'}</div>
    <label class="drop" style="margin-top:6px"><b>📎 파일 올리기</b>PDF·한글·워드·엑셀·이미지 등 (파일당 25MB까지)<input type="file" multiple data-upload="${esc(id)}"></label><small id="up-${esc(id)}"></small></div>` : (kind === 'document' ? '<p class="note">문서를 먼저 저장하면 파일을 올릴 수 있습니다.</p>' : '');
  openSheet(`${F.label} ${id ? '수정' : '추가'}`, `<form id="edit-form" style="display:grid;gap:14px">${F.fields.map(f => fieldHtml(f, item)).join('')}</form>${files}<div id="edit-msg" class="msg err" role="alert"></div>`,
    `${id ? `<button class="ghost danger" data-act="del-item" data-kind="${kind}" data-id="${esc(id)}">삭제</button>` : ''}<button class="btn" data-act="save-item" data-kind="${kind}" data-id="${esc(id || '')}">저장</button>`);
}
async function saveItem(kind, id) {
  const { data, vis, sort } = collect(kind);
  const msg = $('#edit-msg');
  if (!data.title?.trim()) return (msg.textContent = '제목을 입력해 주세요.');
  if (!vis) return (msg.textContent = '공개 범위를 선택해 주세요.');
  try {
    const r = id ? await api('PUT', `/api/admin/items/${kind}/${encodeURIComponent(id)}`, { data, vis, sort }) : await api('POST', `/api/admin/items/${kind}`, { data, vis, sort });
    toast('저장했습니다');
    await load(true);
    if (kind === 'document' && !id) openEditor('document', r.id); else closeSheet();
  } catch (e) { msg.textContent = e.message; }
}
async function uploadFiles(docId, fileList) {
  const out = document.getElementById('up-' + docId);
  const files = [...fileList], errors = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (out) out.textContent = `올리는 중 ${i + 1}/${files.length}: ${f.name}`;
    try { await api('POST', `/api/admin/documents/${encodeURIComponent(docId)}/files`, undefined, { body: f, headers: { 'X-Filename': encodeURIComponent(f.name), 'Content-Type': 'application/octet-stream' } }); }
    catch (e) { errors.push(`${f.name}: ${e.message}`); }
  }
  if (errors.length) alert('올리지 못한 파일\n\n' + errors.join('\n'));
  else toast('파일을 올렸습니다');
  const sheetOpen = !$('#sheet').classList.contains('hidden');
  await load(true);
  if (sheetOpen) openEditor('document', docId);
}

/* ===================== 이벤트 ===================== */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) { if (e.target.id === 'sheet') closeSheet(); return; }
  const a = el.dataset.act, d = el.dataset;
  try {
    switch (a) {
      case 'auth': return showAuth(d.mode);
      case 'go': return go(d.page, d.arg);
      case 'notice': return go('notice', d.id);
      case 'ntag': ui.ntag = d.tag; return render(true);
      case 'copy': return copy(document.getElementById(d.target)?.innerText || '');
      case 'logout': await api('POST', '/api/logout', {}); DATA = null; location.hash = ''; return showAuth('login', '로그아웃했습니다.', true);
      case 'admin-tab': ui.atab = d.tab; if (d.tab === 'audit') ui.auditRows = null; if (d.tab === 'users') ui.users = null; return go('admin');
      case 'ufilter': ui.ufilter = d.f; return render(true);
      case 'approve': {
        const role = document.getElementById('role-' + d.id).value;
        if (!role) return toast('승인할 권한을 먼저 선택해 주세요.');
        await api('POST', `/api/admin/users/${d.id}`, { action: 'approve', role }); toast('승인했습니다'); ui.users = null; return load(true);
      }
      case 'pending-approve': {
        const role = prompt('부여할 권한을 입력하세요: 일반 / 집행부 / 운영자');
        const map = { '일반': 'member', '집행부': 'exec', '운영자': 'admin' };
        if (!map[role?.trim()]) return role != null && toast('일반, 집행부, 운영자 중 하나를 입력해 주세요.');
        await api('POST', `/api/admin/users/${d.id}`, { action: 'approve', role: map[role.trim()] }); ui.users = null; return load(true);
      }
      case 'uact': {
        const label = { reject: '가입을 거절', role: '권한을 변경', disable: '이용을 중지', enable: '이용을 재개', delete: '회원을 삭제' }[d.do];
        const body = { action: d.do };
        if (d.do === 'role') body.role = document.getElementById('role-' + d.id).value;
        if (!confirm(`${label}할까요?`)) return;
        await api('POST', `/api/admin/users/${d.id}`, body); toast('처리했습니다'); ui.users = null; return load(true);
      }
      case 'resetpin': {
        const pin = prompt('새 간편비밀번호 4자리를 입력하세요. 본인에게 알려 주고, 로그인 후 「내 정보」에서 바꾸게 하세요.');
        if (pin == null) return;
        await api('POST', `/api/admin/users/${d.id}`, { action: 'resetPin', pin: pin.trim() }); return toast('초기화했습니다');
      }
      case 'kakao': {
        el.disabled = true;
        try { ui.kakaoPlan = await api('POST', '/api/admin/kakao', { files: ui.kakaoFiles, commit: d.commit === '1' }); }
        finally { el.disabled = false; }
        if (ui.kakaoPlan.committed) { ui.kakaoFiles = []; await load(true); toast('공지를 가져왔습니다'); } else render(true);
        return;
      }
      case 'kakao-clear': ui.kakaoFiles = []; ui.kakaoPlan = null; return render(true);
      case 'audit-refresh': ui.auditRows = null; return render(true);
      case 'new': return openEditor(d.kind, null, d.kind === 'task' ? { month: Number(d.month) || curMonth(), kind: 'task', steps: [], tips: [], refs: [] } : {});
      case 'edit': return openEditor(d.kind, d.id);
      case 'save-item': return saveItem(d.kind, d.id);
      case 'del-item': {
        if (!confirm('삭제할까요? 되돌릴 수 없습니다.' + (d.kind === 'document' ? ' 올린 파일도 함께 삭제됩니다.' : ''))) return;
        await api('DELETE', `/api/admin/items/${d.kind}/${encodeURIComponent(d.id)}`); closeSheet(); toast('삭제했습니다');
        if (d.kind === 'notice' && parseHash().page === 'notice') history.back();
        return load(true);
      }
      case 'del-file': if (!confirm('이 파일을 삭제할까요?')) return; await api('DELETE', `/api/admin/files/${encodeURIComponent(d.id)}`); await load(true); return openEditor('document', d.doc);
      case 'month-meta': {
        const m = Number(d.month), meta = DATA.months.meta?.[m] || {};
        openSheet(`${m}월 제목·설명`, `<label class="field"><span>제목</span><input class="input" id="mm-theme" value="${esc(meta.theme || '')}"></label><label class="field"><span>한 줄 설명</span><input class="input" id="mm-sum" value="${esc(meta.summary || '')}"></label>`,
          `<button class="btn" data-act="save-month-meta" data-month="${m}">저장</button>`);
        return;
      }
      case 'save-month-meta': {
        const M = structuredClone(DATA.months); M.meta[d.month] = { theme: $('#mm-theme').value, summary: $('#mm-sum').value };
        await api('PUT', '/api/admin/settings/months', M); closeSheet(); toast('저장했습니다'); return load(true);
      }
      case 'close-sheet': return closeSheet();
      case 'open-file': {
        const w = window.open('', '_blank');
        try { const { url } = await api('GET', `/api/files/${encodeURIComponent(d.id)}/url`); if (w) w.location.href = url; else location.href = url; }
        catch (err) { if (w) w.close(); throw err; }
        return;
      }
      case 'export': {
        const j = await api('GET', '/api/admin/export');
        const blob = new Blob([JSON.stringify(j, null, 1)], { type: 'application/json' }), u = URL.createObjectURL(blob), lnk = document.createElement('a');
        lnk.href = u; lnk.download = `c-archive-backup-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(lnk); lnk.click(); lnk.remove();
        setTimeout(() => URL.revokeObjectURL(u), 1000); return toast('백업 파일을 내려받았습니다');
      }
    }
  } catch (err) { toast(err.message); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'nq' || e.target.id === 'hq') {
    ui[e.target.id] = e.target.value;
    const pos = e.target.selectionStart; render(true);
    const el = document.getElementById(e.target.id); el.focus(); try { el.setSelectionRange(pos, pos); } catch {}
  }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.matches('input[data-step]')) { t.checked ? store.set(t.dataset.step, '1') : store.del(t.dataset.step); return; }
  if (t.id === 'kakao-input') {
    const files = [...t.files];
    if (files.some(f => f.size > 2.5 * 1024 * 1024)) toast('2.5MB가 넘는 파일은 나눠서 내보내 주세요.');
    ui.kakaoFiles = await Promise.all(files.filter(f => f.size <= 2.5 * 1024 * 1024).map(async f => ({ name: f.name, text: await f.text() })));
    ui.kakaoPlan = null; return render(true);
  }
  if (t.matches('input[data-upload]') && t.files.length) return uploadFiles(t.dataset.upload, t.files);
  if (t.id === 'import-input' && t.files[0]) {
    try {
      const j = JSON.parse(await t.files[0].text());
      const n = Array.isArray(j.items) ? j.items.length : 0;
      if (!confirm(`자료 ${n}개 항목을 가져올까요? 같은 항목은 파일 내용으로 덮어씁니다.`)) { t.value = ''; return; }
      const r = await api('POST', '/api/admin/import', { json: j });
      toast(`${r.count}개 항목을 가져왔습니다`); await load(true);
    } catch (err) { toast(err instanceof SyntaxError ? 'JSON 파일을 읽지 못했습니다.' : err.message); }
    t.value = '';
  }
});
document.addEventListener('submit', async e => {
  const id = e.target.id;
  if (!['pin-form', 'site-form', 'months-form', 'ho-form'].includes(id)) return;
  e.preventDefault();
  const v = s => document.getElementById(s).value;
  try {
    if (id === 'pin-form') {
      const msg = $('#pin-msg'); msg.className = 'msg err';
      if (v('p-new') !== v('p-new2')) return (msg.textContent = '새 간편비밀번호 확인이 일치하지 않습니다.');
      try { await api('POST', '/api/me/pin', { current: v('p-cur'), next: v('p-new') }); msg.className = 'msg ok'; msg.textContent = '변경했습니다.'; e.target.reset(); bindPins(e.target); }
      catch (err) { msg.textContent = err.message; }
      return;
    }
    if (id === 'site-form') await api('PUT', '/api/admin/settings/site', { name: v('s-name'), org: v('s-org'), council: v('s-council'), updated: v('s-updated'), welcome: v('s-welcome') });
    if (id === 'months-form') {
      const start = Number(v('m-start')), order = Array.from({ length: 12 }, (_, i) => ((start - 1 + i) % 12) + 1);
      const meta = {};
      for (let m = 1; m <= 12; m++) meta[m] = { theme: document.querySelector(`[data-mtheme="${m}"]`).value, summary: document.querySelector(`[data-msum="${m}"]`).value };
      await api('PUT', '/api/admin/settings/months', { order, meta });
    }
    if (id === 'ho-form') await api('PUT', '/api/admin/settings/handover', { title: v('h-title'), author: v('h-author'), written: v('h-written'), preface: v('h-preface') });
    toast('저장했습니다'); await load(true);
  } catch (err) { toast(err.message); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').classList.contains('hidden')) closeSheet(); });
$('#back').onclick = () => (history.length > 1 ? history.back() : go('home'));
$('#me').onclick = $('#role').onclick = () => go('me');
$('#theme').onclick = () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next; store.set('ca:theme', next);
};
{ const th = store.get('ca:theme'); if (th) document.documentElement.dataset.theme = th; }
load();
