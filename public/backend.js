// Supabase 연결 계층 — 화면(app.js)은 이 파일의 Backend.api()만 호출합니다.
// 권한 검사는 Supabase 데이터베이스의 접근 규칙(RLS, supabase/schema.sql)에서 이뤄집니다.
(function () {
  'use strict';
  const CFG = window.CA_CONFIG || {};
  const configured = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && !/여기에/.test(CFG.supabaseUrl + CFG.supabaseAnonKey));
  const sb = configured ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ca-auth' } }) : null;
  const DOMAIN = CFG.loginDomain || 'c-archive.kr';
  const emailOf = sid => `s${sid}@${DOMAIN}`;
  const pwOf = (sid, pin) => `ca1-${sid}-${pin}`;
  const ROLE_LABEL = { member: '일반', exec: '집행부', admin: '운영자' };
  const ALLOWED = ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'txt', 'csv', 'zip'];
  const MAX_UPLOAD = 25 * 1024 * 1024;

  class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  const fail = (s, m) => { throw new ApiError(s, m); };
  function kr(err) {
    const m = String(err?.message || err || '');
    if (/Invalid login credentials/i.test(m)) return '학번 또는 간편비밀번호가 맞지 않습니다.';
    if (/already registered|already been registered/i.test(m)) return '이미 가입했거나 가입 신청한 학번입니다. 로그인해 보세요.';
    if (/rate limit|too many/i.test(m)) return '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    if (/Database error saving new user/i.test(m)) return '가입 정보를 저장하지 못했습니다. 이름과 학번을 확인해 주세요.';
    if (/JWT|not authenticated|session/i.test(m)) return '다시 로그인해 주세요.';
    if (/Failed to fetch|NetworkError/i.test(m)) return '서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.';
    return m || '오류가 발생했습니다.';
  }
  const ok = ({ data, error }) => { if (error) fail(error.status === 401 ? 401 : 400, kr(error)); return data; };
  function weakPin(p) {
    if (/^(\d)\1{3}$/.test(p)) return true;
    const d = [...p].map(Number);
    return d.every((x, i) => i === 0 || x - d[i - 1] === 1) || d.every((x, i) => i === 0 || d[i - 1] - x === 1);
  }
  const extOf = n => (String(n).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
  const rid = p => p + Array.from(crypto.getRandomValues(new Uint8Array(5)), b => b.toString(16).padStart(2, '0')).join('');

  /* ---------- 입력 정리 ---------- */
  const S = (v, max = 500) => String(v ?? '').replace(/\r\n/g, '\n').slice(0, max);
  const A = (v, max = 60, len = 1000) => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map(x => S(x, len).trim()).filter(Boolean).slice(0, max);
  const httpsUrl = v => { try { const u = new URL(String(v)); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
  const SCHEMA = {
    notice: d => ({
      date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : new Date().toISOString().slice(0, 10),
      time: /^\d{2}:\d{2}$/.test(d.time) ? d.time : '00:00',
      title: S(d.title, 150), tag: S(d.tag, 30) || '기타', body: S(d.body, 20000), note: S(d.note, 1000), attachments: A(d.attachments, 30, 200),
      followups: (Array.isArray(d.followups) ? d.followups : []).slice(0, 50).map(f => ({ date: S(f.date, 10), time: S(f.time, 5), text: S(f.text, 1000) })),
      sources: (Array.isArray(d.sources) ? d.sources : []).slice(0, 10).map(s => ({ room: S(s.room, 100), cohort: S(s.cohort, 4), date: S(s.date, 10), time: S(s.time, 5), sender: S(s.sender, 40) })),
    }),
    task: d => ({
      month: Math.min(12, Math.max(1, parseInt(d.month) || 1)), kind: ['event', 'task', 'meeting'].includes(d.kind) ? d.kind : 'task',
      title: S(d.title, 150), summary: S(d.summary, 3000), steps: A(d.steps), tips: A(d.tips, 20), refs: A(d.refs, 20, 60), src: S(d.src, 100),
    }),
    recurring: d => ({ title: S(d.title, 100), cycle: S(d.cycle, 100), who: S(d.who, 300), detail: S(d.detail, 3000) }),
    document: d => ({
      group: S(d.group, 40) || '기타', title: S(d.title, 150), summary: S(d.summary, 3000), listTitle: S(d.listTitle, 100), list: A(d.list),
      list2Title: S(d.list2Title, 100), list2: A(d.list2), tables: S(d.tables, 30000), template: S(d.template, 10000), note: S(d.note, 2000),
      url: httpsUrl(d.url), needsFile: !!d.needsFile,
    }),
    handover: d => ({ title: S(d.title, 100), body: S(d.body, 60000), pinned: !!d.pinned }),
  };
  const SETTINGS = {
    site: d => ({ name: S(d.name, 40) || 'C ARCHIVE', org: S(d.org, 100), council: S(d.council, 100), updated: S(d.updated, 20), welcome: S(d.welcome, 300) }),
    months: d => ({
      order: (Array.isArray(d.order) && d.order.length === 12 && new Set(d.order).size === 12) ? d.order.map(Number) : [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      meta: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, { theme: S(d.meta?.[i + 1]?.theme, 60), summary: S(d.meta?.[i + 1]?.summary, 500) }])),
    }),
    handover: d => ({ title: S(d.title, 100), author: S(d.author, 100), written: S(d.written, 40), preface: S(d.preface, 1000) }),
  };
  const VIS = ['member', 'exec', 'admin'];
  const log = (act, detail = '') => sb.rpc('log_action', { act, detail: S(detail, 500) });

  /* ---------- 공통 조회 ---------- */
  async function whoami() { return ok(await sb.rpc('whoami')); }
  async function requireActive() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) fail(401, '로그인이 필요합니다.');
    const me = await whoami();
    if (!me || me.status !== 'active' || !me.role) { await sb.auth.signOut(); fail(401, '로그인이 필요합니다.'); }
    return me;
  }
  const flat = r => ({ id: r.id, vis: r.vis, sort: r.sort, ...r.data, updatedAt: r.updated_at, updatedBy: r.updated_by });
  const bySort = (a, b) => a.sort - b.sort || String(a.id).localeCompare(String(b.id));

  /* ---------- 라우트 ---------- */
  const routes = {
    'GET /api/public': async () => {
      const r = ok(await sb.rpc('public_info')) || {};
      return { name: r.name || 'C ARCHIVE', org: r.org || '', welcome: r.welcome || '', hasAdmin: !!r.has_admin };
    },
    'POST /api/signup': async ({ body }) => {
      const name = S(body.name, 20).trim(), sid = S(body.studentId, 12).trim(), pin = S(body.pin, 4);
      if (!name) fail(400, '이름을 입력해 주세요.');
      if (!/^\d{8,10}$/.test(sid)) fail(400, '학번은 숫자 8~10자리로 입력해 주세요.');
      if (!/^\d{4}$/.test(pin)) fail(400, '간편비밀번호는 숫자 4자리입니다.');
      if (weakPin(pin)) fail(400, '0000, 1234처럼 쉬운 번호는 쓸 수 없습니다.');
      const res = ok(await sb.auth.signUp({ email: emailOf(sid), password: pwOf(sid, pin), options: { data: { name } } }));
      if (!res.session) {
        // 이메일 확인이 켜져 있거나 이미 있는 계정인 경우
        const r2 = await sb.auth.signInWithPassword({ email: emailOf(sid), password: pwOf(sid, pin) });
        if (r2.error) fail(400, /Email not confirmed/i.test(r2.error.message) ? 'Supabase 설정에서 "Confirm email"을 꺼야 합니다. 운영자에게 알려 주세요.' : '이미 가입했거나 가입 신청한 학번입니다.');
      }
      const me = await whoami();
      if (me?.status === 'active') return { ok: true, firstAdmin: me.role === 'admin' };
      await sb.auth.signOut();
      if (me?.status === 'pending') return { ok: true, pending: true };
      fail(400, '가입 처리 중 문제가 생겼습니다. 운영자에게 문의해 주세요.');
    },
    'POST /api/login': async ({ body }) => {
      const sid = S(body.studentId, 12).trim(), pin = S(body.pin, 4);
      ok(await sb.auth.signInWithPassword({ email: emailOf(sid), password: pwOf(sid, pin) }));
      const me = await whoami();
      if (me?.status === 'active' && me.role) return { ok: true };
      await sb.auth.signOut();
      if (me?.status === 'pending') fail(403, '가입 승인 대기 중입니다. 운영자(회장·부회장)가 승인하면 이용할 수 있습니다.');
      if (me?.status === 'rejected') fail(403, '가입이 거절되었습니다. 운영자에게 문의해 주세요.');
      fail(403, '이용이 중지된 계정입니다. 운영자에게 문의해 주세요.');
    },
    'POST /api/logout': async () => { await sb.auth.signOut(); return { ok: true }; },
    'GET /api/bootstrap': async () => {
      const me = await requireActive();
      const [items, settings, files, hidden] = await Promise.all([
        sb.from('items').select('*').then(ok), sb.from('settings').select('*').then(ok),
        sb.from('files').select('*').order('uploaded_at').then(ok), sb.rpc('hidden_counts').then(ok),
      ]);
      const set = Object.fromEntries(settings.map(s => [s.key, s.value]));
      const of = k => items.filter(r => r.kind === k).map(flat).sort(bySort);
      const hos = of('handover');
      return {
        me: { id: me.id, name: me.name, studentId: me.studentId, role: me.role, roleLabel: ROLE_LABEL[me.role] },
        site: set.site || { name: 'C ARCHIVE', org: '' },
        months: set.months || SETTINGS.months({}),
        notices: of('notice').sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
        tasks: of('task'), recurring: of('recurring'),
        documents: of('document').map(d => ({ ...d, files: files.filter(f => f.doc_id === d.id).map(f => ({ id: f.id, name: f.name, size: f.size, path: f.path, uploaded_at: f.uploaded_at })) })),
        hiddenTasks: hidden?.tasks || {}, hiddenDocs: hidden?.docs || 0,
        handover: hos.length ? { meta: set.handover || {}, sections: hos } : null,
        pendingCount: hidden?.pending || 0,
        empty: !items.length,
      };
    },
    'POST /api/me/pin': async ({ body }) => {
      const me = await requireActive();
      const cur = S(body.current, 4), next = S(body.next, 4);
      const r = await sb.auth.signInWithPassword({ email: emailOf(me.studentId), password: pwOf(me.studentId, cur) });
      if (r.error) fail(400, '현재 간편비밀번호가 맞지 않습니다.');
      if (!/^\d{4}$/.test(next) || weakPin(next)) fail(400, '새 간편비밀번호는 쉬운 번호가 아닌 숫자 4자리여야 합니다.');
      ok(await sb.auth.updateUser({ password: pwOf(me.studentId, next) }));
      return { ok: true };
    },
    'GET /api/admin/users': async () => ok(await sb.from('profiles').select('*').order('created_at', { ascending: false }))
      .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1)),
    'POST /api/admin/users/:id': async ({ p, body }) => {
      const map = { approve: 'approve', reject: 'reject', role: 'role', disable: 'disable', enable: 'enable', resetPin: 'reset_pin', delete: 'delete' };
      const act = map[body.action]; if (!act) fail(400, '알 수 없는 작업입니다.');
      let new_password = null;
      if (act === 'reset_pin') {
        if (!/^\d{4}$/.test(String(body.pin))) fail(400, '숫자 4자리를 입력해 주세요.');
        const t = ok(await sb.from('profiles').select('student_id').eq('id', p.id).single());
        new_password = pwOf(t.student_id, body.pin);
      }
      ok(await sb.rpc('admin_user_action', { target: p.id, act, new_role: body.role || null, new_password }));
      return { ok: true };
    },
    'POST /api/admin/items/:kind': async ({ p, body }) => {
      if (!SCHEMA[p.kind]) fail(404, '없는 종류입니다.');
      const data = SCHEMA[p.kind](body.data || {});
      if (!data.title) fail(400, '제목을 입력해 주세요.');
      if (!VIS.includes(body.vis)) fail(400, '공개 범위를 선택해 주세요.');
      let sort = Number.isFinite(+body.sort) && body.sort !== undefined ? +body.sort : null;
      if (sort === null) { const last = ok(await sb.from('items').select('sort').eq('kind', p.kind).order('sort', { ascending: false }).limit(1)); sort = (last[0]?.sort || 0) + 1; }
      const id = p.kind === 'notice' ? rid('n-') : rid(p.kind[0] + '-');
      ok(await sb.from('items').insert({ kind: p.kind, id, vis: body.vis, sort, data }));
      await log('추가', `${p.kind}: ${data.title}`);
      return { ok: true, id };
    },
    'PUT /api/admin/items/:kind/:id': async ({ p, body }) => {
      if (!SCHEMA[p.kind]) fail(404, '없는 종류입니다.');
      const row = ok(await sb.from('items').select('*').eq('kind', p.kind).eq('id', p.id).maybeSingle()); if (!row) fail(404, '항목을 찾을 수 없습니다.');
      const data = SCHEMA[p.kind]({ ...row.data, ...(body.data || {}) });
      if (!data.title) fail(400, '제목을 입력해 주세요.');
      const vis = VIS.includes(body.vis) ? body.vis : row.vis;
      const sort = Number.isFinite(+body.sort) && body.sort !== undefined ? +body.sort : row.sort;
      ok(await sb.from('items').update({ vis, sort, data }).eq('kind', p.kind).eq('id', p.id));
      await log('수정', `${p.kind}: ${data.title}`);
      return { ok: true };
    },
    'DELETE /api/admin/items/:kind/:id': async ({ p }) => {
      const row = ok(await sb.from('items').select('data').eq('kind', p.kind).eq('id', p.id).maybeSingle()); if (!row) fail(404, '항목을 찾을 수 없습니다.');
      if (p.kind === 'document') {
        const fs = ok(await sb.from('files').select('id,path').eq('doc_id', p.id));
        if (fs.length) { ok(await sb.storage.from('docs').remove(fs.map(f => f.path))); ok(await sb.from('files').delete().eq('doc_id', p.id)); }
      }
      ok(await sb.from('items').delete().eq('kind', p.kind).eq('id', p.id));
      await log('삭제', `${p.kind}: ${row.data?.title || p.id}`);
      return { ok: true };
    },
    'PUT /api/admin/settings/:key': async ({ p, body }) => {
      if (!SETTINGS[p.key]) fail(404, '없는 설정입니다.');
      ok(await sb.from('settings').upsert({ key: p.key, value: SETTINGS[p.key](body) }));
      await log('설정 변경', p.key);
      return { ok: true };
    },
    'POST /api/admin/kakao': async ({ body }) => {
      const files = (Array.isArray(body.files) ? body.files : []).slice(0, 10);
      if (!files.length) fail(400, '카카오톡 대화 파일을 선택해 주세요.');
      const parsed = window.Kakao.parseKakao(files);
      if (!parsed.length) fail(400, '공지를 찾지 못했습니다. 카카오톡 "대화 내보내기"로 저장한 .txt 파일인지 확인해 주세요.');
      const existing = ok(await sb.from('items').select('*').eq('kind', 'notice')).map(flat);
      const plan = window.Kakao.planMerge(existing, parsed);
      if (body.commit) {
        const rows = plan.added.map(n => { const { id, vis, ...data } = n; return { kind: 'notice', id, vis: 'member', sort: 0, data: SCHEMA.notice(data) }; });
        for (const up of plan.updated) {
          const ex = existing.find(n => n.id === up.id);
          const raw = ok(await sb.from('items').select('*').eq('kind', 'notice').eq('id', up.id).single());
          const d = raw.data;
          d.sources = [...(d.sources || []), ...up.sources]; d.followups = [...(d.followups || []), ...up.followups]; d.attachments = [...(d.attachments || []), ...up.attachments];
          rows.push({ kind: 'notice', id: up.id, vis: ex.vis, sort: ex.sort, data: SCHEMA.notice(d) });
        }
        for (let i = 0; i < rows.length; i += 100) ok(await sb.from('items').upsert(rows.slice(i, i + 100)));
        await log('카톡 공지 가져오기', `새 공지 ${plan.added.length}건, 보완 ${plan.updated.length}건 (${files.map(f => f.name).join(', ')})`);
      }
      return { committed: !!body.commit, added: plan.added.map(n => ({ id: n.id, date: n.date, time: n.time, title: n.title, tag: n.tag, rooms: n.sources.map(s => s.cohort || s.room) })), updated: plan.updated, unchanged: plan.unchanged.length };
    },
    'POST /api/admin/documents/:id/files': async ({ p, raw }) => {
      const file = raw.body, name = S(file.name, 200).replace(/[\\/\0]/g, '_').trim(), ext = extOf(name);
      if (!ALLOWED.includes(ext)) fail(400, `올릴 수 없는 형식입니다. 가능: ${ALLOWED.join(', ')}`);
      if (file.size > MAX_UPLOAD) fail(413, '파일이 25MB를 넘습니다.');
      if (!file.size) fail(400, '빈 파일입니다.');
      const path = `${p.id}/${crypto.randomUUID()}.${ext}`;
      ok(await sb.storage.from('docs').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false }));
      const me = await whoami();
      const ins = await sb.from('files').insert({ doc_id: p.id, name, path, size: file.size, uploaded_by: me?.name || '' });
      if (ins.error) { await sb.storage.from('docs').remove([path]); ok(ins); }
      await log('파일 업로드', name);
      return { ok: true };
    },
    'DELETE /api/admin/files/:id': async ({ p }) => {
      const f = ok(await sb.from('files').select('*').eq('id', p.id).maybeSingle()); if (!f) fail(404, '파일을 찾을 수 없습니다.');
      ok(await sb.storage.from('docs').remove([f.path]));
      ok(await sb.from('files').delete().eq('id', p.id));
      await log('파일 삭제', f.name);
      return { ok: true };
    },
    'GET /api/admin/audit': async () => ok(await sb.from('audit').select('*').order('id', { ascending: false }).limit(200)),
    'GET /api/admin/export': async () => {
      const [items, settings, files, users] = await Promise.all([
        sb.from('items').select('kind,id,vis,sort,data').then(ok), sb.from('settings').select('*').then(ok),
        sb.from('files').select('*').then(ok), sb.from('profiles').select('name,student_id,role,status,created_at').then(ok)]);
      await log('백업 내려받기');
      return { format: 'c-archive', version: 1, exportedAt: new Date().toISOString(), settings: Object.fromEntries(settings.map(s => [s.key, s.value])), items, files, users };
    },
    'POST /api/admin/import': async ({ body }) => {
      const j = body.json;
      if (!j || j.format !== 'c-archive' || !Array.isArray(j.items)) fail(400, 'C ARCHIVE 백업(또는 초기 자료) 파일이 아닙니다.');
      const rows = j.items.filter(r => SCHEMA[r.kind] && VIS.includes(r.vis) && r.id).map(r => ({ kind: r.kind, id: S(r.id, 80), vis: r.vis, sort: +r.sort || 0, data: SCHEMA[r.kind](r.data || {}) }));
      for (const [k, fn] of Object.entries(SETTINGS)) if (j.settings?.[k]) ok(await sb.from('settings').upsert({ key: k, value: fn(j.settings[k]) }));
      for (let i = 0; i < rows.length; i += 100) ok(await sb.from('items').upsert(rows.slice(i, i + 100)));
      await log('자료 가져오기', `${rows.length}개 항목`);
      return { ok: true, count: rows.length };
    },
    'GET /api/files/:id/url': async ({ p }) => {
      const f = ok(await sb.from('files').select('*').eq('id', p.id).maybeSingle()); if (!f) fail(404, '파일을 찾을 수 없습니다.');
      const inline = ['pdf', 'png', 'jpg', 'jpeg'].includes(extOf(f.name));
      const r = ok(await sb.storage.from('docs').createSignedUrl(f.path, 120, inline ? undefined : { download: f.name }));
      return { url: r.signedUrl };
    },
  };
  const compiled = Object.entries(routes).map(([k, fn]) => {
    const [method, pat] = k.split(' ');
    return { method, re: new RegExp('^' + pat.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn };
  });
  async function api(method, url, body, raw) {
    if (!sb) fail(503, '아직 Supabase 연결 정보가 설정되지 않았습니다. config.js를 확인해 주세요.');
    for (const r of compiled) {
      if (r.method !== method) continue;
      const m = url.match(r.re); if (!m) continue;
      const p = Object.fromEntries(Object.entries(m.groups || {}).map(([k, v]) => [k, decodeURIComponent(v)]));
      try { return await r.fn({ p, body: body || {}, raw }); }
      catch (e) { if (e instanceof ApiError) throw e; throw new ApiError(e?.status || 400, kr(e)); }
    }
    fail(404, '없는 기능입니다.');
  }
  window.Backend = { api, configured };
})();
