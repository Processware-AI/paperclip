# 배포 및 운영 환경

---

## 1. 배포 모드

Paperclip은 사용 목적에 따라 두 가지 배포 모드를 지원한다.

| 모드 | 인증 | 적합한 상황 |
|------|------|------------|
| `local_trusted` | 불필요 | 개인 PC에서 혼자 사용 |
| `authenticated + private` | 로그인 필요 | 팀이 사내망/VPN으로 공유 |
| `authenticated + public` | 로그인 필요 | 인터넷에 공개 배포 |

### local_trusted (현재 기본값)
- localhost에서만 접근 가능
- 로그인 없이 모든 접속을 관리자로 처리
- 개발 및 개인 운영에 최적화

### authenticated
- better-auth 기반 이메일/패스워드, OAuth 로그인
- 사용자별 회사 접근 권한 관리
- Tailscale/VPN 환경: `pnpm dev --tailscale-auth`

---

## 2. 실행 방법

### 로컬 개발 실행
```bash
pnpm install
pnpm dev          # watch 모드 (파일 변경 시 자동 재시작)
pnpm dev:once     # 1회 실행
```

접속: `http://localhost:3100`

### 시작/종료 스크립트 (Windows)
```
run.bat   ← pnpm dev 실행
end.bat   ← 서버 및 관련 프로세스 전체 종료
```

---

## 3. Docker 배포

### 단일 컨테이너 (embedded PostgreSQL 포함)
```bash
docker compose -f docker/docker-compose.quickstart.yml up --build
```

### 풀스택 (외부 PostgreSQL 분리)
```bash
docker compose -f docker/docker-compose.yml up --build
```

### 주요 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `DATABASE_URL` | 외부 PostgreSQL 연결 문자열 | 없음 (embedded 사용) |
| `PAPERCLIP_HOME` | 데이터 저장 디렉토리 | `~/.paperclip` |
| `PAPERCLIP_DEPLOYMENT_MODE` | `local_trusted` or `authenticated` | `local_trusted` |
| `PAPERCLIP_DEPLOYMENT_EXPOSURE` | `private` or `public` | `private` |
| `HEARTBEAT_SCHEDULER_INTERVAL_MS` | 스케줄러 폴링 주기 | `30000` (30초) |

---

## 4. 데이터 저장 위치

```
~/.paperclip/instances/default/
├── config.json          ← 서버 설정
├── db/                  ← embedded PostgreSQL 데이터
├── workspaces/
│   └── {agentId}/       ← 에이전트별 홈 디렉토리
│       ├── AGENTS.md    ← 역할 정의
│       ├── SOUL.md      ← CEO 전용
│       ├── HEARTBEAT.md ← CEO 전용
│       └── memory/      ← 에이전트 메모리
├── data/
│   └── backups/         ← DB 자동 백업 (60분 주기, 30일 보관)
├── logs/                ← 서버 로그
└── secrets/             ← 암호화 키
```

---

## 5. DB 백업 및 복구

- 자동 백업: 60분마다, 30일 보관
- 백업 위치: `~/.paperclip/instances/default/data/backups/`
- DB 초기화 (문제 발생 시):
  ```bash
  rm -rf ~/.paperclip/instances/default/db
  pnpm dev
  ```
  > 주의: 모든 데이터 삭제됨

---

## 6. V1 구현 상태 및 로드맵

### V1 완료 기준
- [x] 다중 회사 전환
- [x] 에이전트 헤드비트 실행
- [x] 원자적 작업 체크아웃 (충돌 방지)
- [x] 에이전트 API 키 인증
- [x] 승인 요청/처리 UI
- [x] 예산 하드 리미트 자동 중지
- [x] 전체 감사 로그
- [x] embedded PostgreSQL / 외부 PostgreSQL 지원

### V2+ 예정
- ClipHub: 에이전트 템플릿 마켓플레이스
- 고급 워크플로우 자동화
- 플러그인 공개 마켓플레이스
- 더 많은 AI 어댑터 지원

---

## 7. 운영 체크리스트

| 항목 | 확인 |
|------|------|
| Node.js 20+ 설치 | `node --version` |
| pnpm 9+ 설치 | `pnpm --version` |
| 서버 정상 실행 | `curl http://localhost:3100/api/health` |
| DB 연결 | pgAdmin 또는 psql로 포트 54329 접속 |
| 에이전트 API 키 설정 | Board UI → 에이전트 설정 |
| 예산 설정 | Board UI → 에이전트 → 예산 |
| 백업 디렉토리 확인 | `~/.paperclip/instances/default/data/backups/` |
