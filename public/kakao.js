// 카카오톡 "대화 내보내기" 텍스트 → 공지 목록 (브라우저에서 실행)
(function () {
'use strict';
// 카카오톡 "대화 내보내기" 텍스트 → 공지 목록
// PC 형식([이름] [오후 8:35] 내용)과 모바일 형식(2026. 8. 20. 오후 8:35, 이름 : 내용)을 모두 읽습니다.

const FOLLOWUP_MAX = 100; // 이 글자 수 이하의 메시지는 직전 공지의 '후속 안내'로 붙임

function mask(text) {
  return String(text)
    .replace(/(?<![\d-])01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}(?![\d-])/g, '010-****-****')
    .replace(/(?<![\w/=.-])\d[\d-]{9,}\d(?![\w/])/g, m => (/^01[016789]-\*/.test(m) ? m : '[계좌번호 비공개]'));
}

const pad = n => String(n).padStart(2, '0');
const to24 = (ampm, h, m) => { let x = Number(h) % 12; if (ampm === '오후') x += 12; return `${pad(x)}:${m}`; };
const SYS = /(님이 (.+ )?(초대했습니다|나갔습니다|들어왔습니다)\.|메시지가 삭제되었습니다\.|님을 내보냈습니다\.|채팅방 관리자가 메시지를 가렸습니다\.)$/;

function parseRoom(text, fileName = '') {
  const lines = String(text).replace(/^﻿/, '').split(/\r?\n/);
  const roomName = (lines[0] || '').replace(/\s*님과 카카오톡 대화\s*$/, '').trim() || fileName;
  const cohort = (roomName.match(/(\d{2})학번/) || fileName.match(/(\d{2})학번/) || [])[1] || '';
  const msgs = [];
  let date = null, cur = null;
  lines.forEach((line, i) => {
    const d = line.match(/^-+ (\d{4})년 (\d{1,2})월 (\d{1,2})일 .+ -+$/) || line.match(/^(\d{4})년 (\d{1,2})월 (\d{1,2})일 [월화수목금토일]요일$/);
    if (d) { date = `${d[1]}-${pad(d[2])}-${pad(d[3])}`; cur = null; return; }
    const pc = line.match(/^\[([^\]]+)\] \[(오전|오후) (\d{1,2}):(\d{2})\] ?(.*)$/);
    if (pc && date) {
      cur = { room: roomName, cohort, date, time: to24(pc[2], pc[3], pc[4]), sender: pc[1], line: i + 1, text: pc[5] };
      msgs.push(cur); return;
    }
    const mo = line.match(/^(\d{4})(?:\.\s*|년\s*)(\d{1,2})(?:\.\s*|월\s*)(\d{1,2})(?:\.|일)?\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*(.+?) : (.*)$/);
    if (mo) {
      cur = { room: roomName, cohort, date: `${mo[1]}-${pad(mo[2])}-${pad(mo[3])}`, time: to24(mo[4], mo[5], mo[6]), sender: mo[7], line: i + 1, text: mo[8] };
      msgs.push(cur); return;
    }
    if (SYS.test(line.trim())) { cur = null; return; }
    if (cur) cur.text += '\n' + line;
  });
  msgs.forEach(x => (x.text = x.text.replace(/\s+$/, '')));
  return msgs;
}

function titleOf(text) {
  const first = text.split('\n').find(l => l.trim()) || '';
  let t = first.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}‼]/gu, '').trim();
  const br = t.match(/^\[(.+?)\]/);
  if (br) t = br[1];
  return t.length > 60 ? t.slice(0, 58) + '…' : t;
}
const TAGS = [
  ['고연전', /고연전|연고전|기차놀이/], ['응원·합응', /응원 ?OT|합동응원|응원전/], ['간식·공부행사', /간식|공부행사/],
  ['개강·교류', /개강|푸파|교류반|파티/], ['단체사진', /단체사진/], ['굿즈·공동구매', /흑잠|과잠|굿즈|공동구매/],
  ['선거·회의', /선거|총회|운영위|회의/],
];
const tagOf = text => (TAGS.find(([, re]) => re.test(text)) || ['기타'])[0];
const norm = s => String(s).replace(/\s+/g, '');
const isAttachment = t => /^(사진( \d+장)?|동영상|파일: .+|이모티콘|<사진 읽지 않음>|사진 \d+장)$/.test(t.trim());
const boardTopic = s => norm(s).replace(/[일자시"]/g, '').slice(0, 12);

/** files: [{name, text}] → 공지 배열 (id, date, time, title, tag, vis, body, attachments, followups, sources) */
function parseKakao(files) {
  const all = files.flatMap(f => parseRoom(f.text, f.name))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.line - b.line);
  const notices = [], byKey = new Map(), boards = new Map();
  let last = null;
  for (const m of all) {
    const src = { room: m.room, cohort: m.cohort, date: m.date, time: m.time, sender: m.sender };
    const body = m.text.trim();
    if (!body || body === '.') continue;
    if (isAttachment(body)) {
      const target = [...notices].reverse().find(n => n.sources.some(s => s.room === m.room && s.sender === m.sender));
      if (target) { const label = body.startsWith('파일: ') ? body.slice(4) : body; if (!target.attachments.includes(label)) target.attachments.push(label); }
      continue;
    }
    const board = body.match(/^톡게시판 '([^']+)':\s*(.+)$/s);
    if (board) {
      const ex = boards.get(boardTopic(board[2]));
      if (ex) {
        if (!ex.sources.some(s => s.room === src.room)) { ex.sources.push(src); continue; }
        const note = `톡게시판 ${board[1]}`;
        if (!ex.followups.some(f => f.text === note)) ex.followups.push({ date: m.date, time: m.time, text: note });
        continue;
      }
    }
    const key = m.date + '|' + norm(mask(body));
    if (byKey.has(key)) { const n = byKey.get(key); if (!n.sources.some(s => s.room === src.room)) n.sources.push(src); continue; }
    if (!board && body.length <= FOLLOWUP_MAX && last) {
      const masked = mask(body);
      if (!last.followups.some(f => norm(f.text) === norm(masked))) last.followups.push({ date: m.date, time: m.time, text: masked });
      continue;
    }
    const n = {
      id: `n-${m.date.replace(/-/g, '')}-${m.time.replace(':', '')}`,
      date: m.date, time: m.time,
      title: board ? `${board[2].replace(/\(.+$/, '').trim()} 일정 투표 (톡게시판)` : titleOf(body),
      tag: tagOf(body), vis: 'member', body: mask(body), note: '',
      attachments: [], followups: [], sources: [src],
    };
    notices.push(n); byKey.set(key, n);
    if (board) boards.set(boardTopic(board[2]), n);
    last = n;
  }
  return notices;
}

/** 기존 공지와 합치기. 같은 날짜·같은 본문(또는 같은 id)이면 출처·후속 안내만 보탭니다. */
function planMerge(existing, parsed) {
  const keyOf = n => n.date + '|' + norm(n.body);
  const byKey = new Map(existing.map(n => [keyOf(n), n]));
  const byId = new Map(existing.map(n => [n.id, n]));
  const added = [], updated = [], unchanged = [];
  const usedIds = new Set(existing.map(n => n.id));
  for (const p of parsed) {
    const ex = byKey.get(keyOf(p)) || (byId.get(p.id)?.date === p.date && norm(byId.get(p.id).body).slice(0, 40) === norm(p.body).slice(0, 40) ? byId.get(p.id) : null);
    if (ex) {
      const srcAdd = p.sources.filter(s => !(ex.sources || []).some(e => e.room === s.room));
      const fuAdd = p.followups.filter(f => !(ex.followups || []).some(e => norm(e.text) === norm(f.text)));
      const atAdd = p.attachments.filter(a => !(ex.attachments || []).includes(a));
      if (srcAdd.length || fuAdd.length || atAdd.length) updated.push({ id: ex.id, title: ex.title, sources: srcAdd, followups: fuAdd, attachments: atAdd });
      else unchanged.push({ id: ex.id, title: ex.title });
      continue;
    }
    let id = p.id, k = 2;
    while (usedIds.has(id)) id = `${p.id}-${k++}`;
    usedIds.add(id);
    added.push({ ...p, id });
  }
  return { added, updated, unchanged };
}

window.Kakao = { parseKakao, planMerge, mask };
})();
