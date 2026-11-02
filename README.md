# C ARCHIVE — 불멸C반 학생회 인수인계 아카이브

스마트폰에서 주로 쓰도록 만든 C반 학생회 인수인계 웹서비스입니다. **무료로 운영**할 수 있습니다.

- 화면: **GitHub Pages** (무료)
- 회원·자료·파일 저장: **Supabase 무료 요금제** (카드 등록 불필요)
- 일시정지 방지: **GitHub Actions**가 하루 한 번 자동 접속 (무료)

코드를 고칠 필요 없이 **운영자 화면**에서 회원 승인, 카톡 공지 업로드, 월별 업무·문서·인수인계 노트 편집, 회칙·예결산 파일 업로드를 모두 할 수 있습니다.

> 이 저장소에는 **코드만** 있습니다. 공지·인수인계 노트 같은 내용은 Supabase 데이터베이스에만 저장되고, 권한이 있는 사람에게만 보입니다. 그래서 저장소를 공개(Public)해도 내용은 노출되지 않습니다.

## 권한

| 권한 | 대상 | 할 수 있는 것 |
|---|---|---|
| **운영자** | 회장·부회장 | 전체 열람 + 회원 승인·권한 변경, 카톡 업로드, 모든 내용 편집, 파일 업로드, 백업 |
| **집행부** | 집행위원 | "집행부 이상" 자료까지 열람 (업무 노하우, 결산 예시, 인수인계 노트) |
| **일반** | C반 학우 | "일반" 자료 열람 (월별 일정, 공지, 회칙·공개 예결산) |

- 가입: **이름 + 학번 + 간편비밀번호(숫자 4자리)**. 가입하면 "승인 대기"가 되고, 운영자가 **권한을 반드시 골라야** 승인됩니다.
- **맨 처음 가입한 사람이 자동으로 운영자**가 됩니다.
- 권한 검사는 Supabase 데이터베이스 규칙(RLS)이 합니다. 승인 전·이용 중지 회원은 아무 자료도 받을 수 없고, 일반 회원은 집행부 자료·파일에 접근할 수 없습니다.

---

## 처음 한 번만 하는 설정 (약 20분)

### 1. Supabase 프로젝트 만들기
1. https://supabase.com → **Start your project** → GitHub 계정으로 가입
2. **New project** → 이름 `c-archive`, Region **Northeast Asia (Seoul)**, 데이터베이스 비밀번호는 따로 보관 → Create
3. 왼쪽 메뉴 **SQL Editor** → **New query** → 이 저장소의 [`supabase/schema.sql`](supabase/schema.sql) 내용을 전부 붙여넣고 **Run**
   - "Success. No rows returned"가 나오면 성공입니다.
4. 왼쪽 메뉴 **Authentication → Sign In / Providers → Email** → **Confirm email 끄기** → Save
   - 학번을 아이디로 쓰기 때문에 이메일 확인을 꺼야 가입할 수 있습니다.
5. **Project Settings → API** (또는 **Data API / API Keys**)에서 두 값을 복사합니다.
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public** 키 (`eyJ...`로 시작하는 긴 문자열)
   - ⚠ **service_role / secret 키는 절대 쓰지 마세요.**

### 2. 연결 정보 넣기
GitHub에서 [`public/config.js`](public/config.js) → 연필(✏️) 버튼 → `supabaseUrl`, `supabaseAnonKey` 자리에 위 두 값을 붙여넣고 **Commit changes**.

### 3. GitHub Pages 켜기
1. 저장소 **Settings → General → 맨 아래 Danger Zone → Change visibility → Public**
   (무료 계정은 공개 저장소에서만 Pages를 쓸 수 있습니다. 코드만 있어서 공개해도 괜찮습니다.)
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**
3. **Actions** 탭 → "사이트 배포 (GitHub Pages)" → **Run workflow** (1~2분 뒤 완료)
4. 사이트 주소: `https://<깃허브아이디>.github.io/c-archive/`

### 4. 첫 운영자 가입과 초기 자료 넣기
1. 사이트에 접속해 **회장이 가장 먼저 가입**합니다 → 자동으로 운영자
2. **관리 → 백업·가져오기 → 자료 가져오기**에 `c-archive-초기자료.json` 파일을 넣습니다 (2026년 공지 20건, 월별 업무, 문서, 인수인계 노트).
   - 이 파일에는 인수인계 노트 원문이 들어 있으니 **GitHub에 올리지 말고** 따로 보관하세요.
3. 부회장이 가입하면 **관리 → 회원 승인**에서 "운영자"로 승인합니다.

### 5. (자동) 일시정지 방지
Supabase 무료 요금제는 7일 동안 접속이 없으면 멈춥니다. `.github/workflows/keepalive.yml`이 매일 한 번 자동으로 접속하므로 따로 할 일은 없습니다. 혹시 멈췄다면 Supabase 대시보드에서 **Restore project**를 누르면 됩니다.

---

## 운영자가 하는 일 (모두 사이트 화면에서)

- **카톡 공지**: 카톡 공지방 → 메뉴 → 설정 → 대화 내보내기(텍스트) → **관리 → 카톡 공지**에서 .txt 선택 → 미리보기 → 가져오기
  - 학번별 공지방 파일을 한 번에 같이 올리면 같은 공지는 하나로 합쳐집니다. 이미 있는 공지는 중복되지 않습니다.
  - 전화번호·계좌번호는 자동으로 가려집니다.
- **월별 업무**: 「월별」 화면의 `+ 업무 추가` / 각 카드의 `수정`
- **문서**: 「문서」 화면에서 추가·수정, `📎 파일 올리기`로 회칙·예결산 원본 업로드 (PDF·한글·워드·엑셀·이미지 등, 25MB까지)
- **인수인계 노트**: 「인수인계」 화면에서 장 추가·수정
- **백업**: **관리 → 백업·가져오기 → 백업 파일 내려받기** (학기마다 한 번 권장)

## 후배에게 넘길 때
1. **사이트**: 새 회장·부회장을 운영자로 승인 → **관리 → 사이트 설정**에서 학생회장단 이름 변경 → 이전 운영자 권한 조정
2. **GitHub**: 저장소 Settings → Collaborators에 새 회장 초대 (또는 Settings → Transfer로 소유권 이전)
3. **Supabase**: 대시보드 → Organization → Team → 새 회장 초대 → Owner 지정

## 참고
- 간편비밀번호 4자리는 경우의 수가 적어서, 쉬운 번호(0000, 1234 등)는 막아 두었습니다. 반복된 로그인 시도는 Supabase가 자동으로 제한합니다. 잊어버렸으면 운영자가 **관리 → 회원 승인 → 회원 목록**에서 초기화합니다.
- `config.js`의 `loginDomain`은 운영 중에 바꾸지 마세요. 기존 회원이 로그인할 수 없게 됩니다.
- 첨부 파일 원본은 Supabase 대시보드 **Storage → docs**에 있습니다.

## 폴더
```
public/             사이트 화면 (GitHub Pages로 배포)
  config.js         Supabase 연결 정보
  app.js            화면
  backend.js        Supabase 연결 계층
  kakao.js          카톡 대화 → 공지 변환
supabase/schema.sql 데이터베이스·권한 규칙 설정 (SQL Editor에서 실행)
.github/workflows/  Pages 배포, 일시정지 방지
```
