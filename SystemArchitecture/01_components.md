# 주요 컴포넌트 및 기술 스택

---

## 1. 전체 패키지 구조

Paperclip은 **모노레포** 구조로 구성된다 (pnpm workspace).

```
paperclip/
├── server/          ← REST API 서버, 에이전트 스케줄러
├── ui/              ← 브라우저 보드 (React)
├── cli/             ← 명령줄 도구
├── packages/
│   ├── db/          ← 데이터베이스 스키마 및 마이그레이션
│   ├── shared/      ← 공유 타입, 상수, 검증
│   ├── adapters/    ← AI 모델별 어댑터 구현
│   ├── adapter-utils/ ← 어댑터 공통 유틸리티
│   └── plugins/     ← 플러그인 SDK 및 예제
├── skills/          ← 에이전트 스킬 정의
└── docker/          ← 컨테이너 배포 설정
```

---

## 2. 컴포넌트별 역할

### 서버 (server/)
- Express 기반 REST API
- 에이전트 헤드비트 스케줄러 (30초 주기 폴링)
- 이슈 체크아웃 / 승인 / 비용 추적
- 플러그인 로더 및 실행 환경
- embedded PostgreSQL 내장 (외부 DB 연결도 지원)

### 보드 UI (ui/)
- React + TypeScript + Vite
- 회사 대시보드, 에이전트 조직도
- 이슈 목록 및 상세, 실행 로그 뷰어
- 승인 요청 처리 화면
- 비용 / 예산 현황판

### CLI (cli/)
- `paperclipai` 명령어
- 에이전트 로컬 실행, 온보딩, 진단 (doctor)
- 인증 토큰 관리

### 데이터베이스 (packages/db/)
- Drizzle ORM (PostgreSQL)
- 50+ 테이블: 회사, 에이전트, 이슈, 실행 이력, 비용, 승인 등
- embedded-postgres (서버 내장) 또는 외부 PostgreSQL 선택 가능

---

## 3. AI 어댑터 목록

에이전트마다 어떤 AI 모델/도구를 쓸지 어댑터로 결정한다.

| 어댑터 | 설명 | 실행 방식 |
|--------|------|----------|
| `claude_local` | Anthropic Claude Code CLI | 로컬 프로세스 |
| `codex_local` | OpenAI Codex CLI | 로컬 프로세스 |
| `cursor_local` | Cursor IDE | 로컬 프로세스 |
| `gemini_local` | Google Gemini CLI | 로컬 프로세스 |
| `opencode_local` | OpenCode | 로컬 프로세스 |
| `pi_local` | Pi 모델 | 로컬 프로세스 |
| `openclaw_gateway` | OpenClaw 외부 게이트웨이 | WebSocket |

현재 가장 성숙한 어댑터는 `claude_local`이며, `openclaw_gateway`는 원격 에이전트 연결을 위한 특수 어댑터다.

---

## 4. 스킬 시스템

스킬은 에이전트가 사용할 수 있는 **도구 설명서**다.
에이전트 생성 시 장착하면 `~/.claude/skills/`에 설치된다.

| 스킬 | 역할 |
|------|------|
| `paperclip` | Paperclip API 호출 (이슈 조회, 위임, 댓글 등) |
| `paperclip-create-agent` | 새 에이전트 고용 워크플로우 |
| `paperclip-create-plugin` | 플러그인 생성 |
| `para-memory-files` | CEO 전용 3계층 메모리 시스템 |

---

## 5. 플러그인 시스템

Paperclip의 기능을 외부 패키지로 확장할 수 있다.

```
플러그인 패키지 (npm)
    ↓
Board에서 설치 및 활성화
    ↓
worker.js → 서버 사이드 로직 실행
ui/       → 보드 UI에 위젯/패널 삽입
```

플러그인이 할 수 있는 것:
- 대시보드 위젯 추가
- 이슈 상세 패널 확장
- 백그라운드 작업 스케줄링
- Webhook 수신 처리

---

## 6. 기술 스택 요약

| 영역 | 기술 |
|------|------|
| 런타임 | Node.js 20+ |
| 패키지 관리 | pnpm 9 (모노레포) |
| 언어 | TypeScript |
| API 서버 | Express |
| DB ORM | Drizzle ORM |
| DB | embedded-postgres / PostgreSQL |
| 프론트엔드 | React + Vite |
| 인증 | better-auth (authenticated 모드) |
| 컨테이너 | Docker / Podman |
| AI CLI | Claude Code, Codex, Gemini 등 |
