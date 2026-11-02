// Supabase 연결 정보 — Supabase 대시보드 → Project Settings → API(또는 Data API / API Keys)에서 복사해 넣으세요.
// anon(public) 키는 공개되어도 되는 키입니다. 권한 검사는 데이터베이스 접근 규칙(RLS)이 합니다.
// ⚠ service_role(secret) 키는 절대 넣지 마세요.
window.CA_CONFIG = {
  supabaseUrl: 'https://dwjbybcoasgphnrwvudt.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3amJ5YmNvYXNncGhucnd2dWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MDQxMjgsImV4cCI6MjEwOTE4MDEyOH0.DHbN1YoOH3VgeWErO9pn07iNWDRZmbwdQZnR0PsDE3A',
  // 학생회 공용 Gmail 주소. 학번을 로그인 아이디로 바꿀 때 씁니다 (예: 이주소+s2026123456@gmail.com).
  // 실제로 메일을 보내지는 않습니다. ⚠ 회원이 생긴 뒤에는 바꾸지 마세요(기존 회원이 로그인할 수 없게 됨).
  loginEmail: '',
};
