# 외부 시스템 연동

---

## 1. 연동 방식 개요

Paperclip은 두 가지 방식으로 외부 시스템과 연동한다.

| 방식 | 설명 | 적합한 경우 |
|------|------|------------|
| **스킬(Skill)** | 에이전트가 외부 API를 직접 호출 | Redmine, Jira, GitHub 등 데이터 읽기/쓰기 |
| **어댑터(Adapter)** | 외부 AI 에이전트를 Paperclip에 연결 | OpenClaw, 원격 AI 서비스 |

---

## 2. 스킬 기반 연동 (외부 데이터 시스템)

### 개념
에이전트가 이슈를 처리하는 과정에서 **스킬에 정의된 방법대로** 외부 API를 호출한다.
LLM이 스킬 문서를 읽고 스스로 적절한 API를 호출하는 방식이다.

### Redmine 연동 예시

**스킬 파일 구조** (`skills/redmine/SKILL.md`):
```markdown
## Authentication
- REDMINE_URL: Redmine 서버 주소
- REDMINE_API_KEY: API 키

## 이슈 조회
curl -sS "$REDMINE_URL/issues.json?status_id=open" \
  -H "X-Redmine-API-Key: $REDMINE_API_KEY"

## 상태 매핑
- Redmine "In Progress" → Paperclip "in_progress"
- Redmine "Resolved"   → Paperclip "done"
```

**동작 흐름**:
```
사람: "Redmine 미해결 이슈를 Paperclip 태스크로 만들어줘"
    ↓
에이전트 wakeup
    ↓
스킬 문서 참조 (자동 로드됨)
    ↓
LLM 판단: "curl로 Redmine API 호출 → 결과를 Paperclip 이슈로 생성"
    ↓
bash 실행: curl $REDMINE_URL/issues.json ...
    ↓
bash 실행: node skills/paperclip/pc-api.js POST /api/issues '{"title":...}'
    ↓
완료 보고
```

### 환경 변수 주입
외부 시스템의 API 키는 에이전트 `adapterConfig`에 설정한다:
```json
{
  "adapterConfig": {
    "env": {
      "REDMINE_URL": "https://redmine.example.com",
      "REDMINE_API_KEY": "your-api-key"
    }
  }
}
```

### 연동 가능한 외부 시스템 예시

| 시스템 | 연동 방법 | 주요 용도 |
|--------|----------|----------|
| Redmine | REST API (curl/Node.js) | 이슈 동기화 |
| Jira | REST API | 티켓 동기화 |
| GitHub | REST API / GraphQL | PR 관리, 코드 리뷰 |
| Slack | Webhook / API | 알림 발송 |
| Google Sheets | Sheets API | 데이터 읽기/쓰기 |
| 사내 ERP | REST API | 업무 데이터 연동 |

---

## 3. OpenClaw Gateway 어댑터 (원격 AI 에이전트)

### 개념
OpenClaw는 원격 환경(다른 서버, Docker 컨테이너)에서 실행되는 AI 에이전트를
Paperclip에 연결하는 **WebSocket 기반 게이트웨이**다.

로컬 CLI를 직접 실행할 수 없는 환경 (클라우드 서버, 격리된 컨테이너 등)에서 유용하다.

### 연결 구조
```
Paperclip 서버 (포트 3100)
    ↕ WebSocket (포트 13100)
OpenClaw Gateway 프로세스
    ↕
AI 에이전트 실행 환경 (Docker 컨테이너 등)
```

### 동작 흐름
```
에이전트 wakeup
    ↓
Paperclip 서버 → OpenClaw Gateway로 작업 전송 (WebSocket)
    ↓
OpenClaw가 원격 환경에서 AI 모델 실행
    ↓
실행 결과를 WebSocket으로 Paperclip에 스트리밍
    ↓
완료 처리
```

---

## 4. Webhook / HTTP 어댑터

외부 시스템이 Paperclip에 이벤트를 푸시하거나,
Paperclip이 외부 시스템에 작업을 전달할 수 있다.

### 외부 → Paperclip (이벤트 수신)
```
외부 시스템 (Redmine, GitHub 등)
    ↓ Webhook POST
Paperclip API
    ↓
이슈 자동 생성 또는 에이전트 wakeup
```

### Paperclip → 외부 (작업 전달)
```
에이전트가 이슈 처리 중
    ↓
HTTP 어댑터로 외부 엔드포인트에 POST
    ↓
비동기 콜백으로 결과 수신
    ↓
이슈 상태 업데이트
```

---

## 5. 플러그인을 통한 연동 확장

플러그인으로 새로운 연동 방식을 추가할 수 있다.

```
플러그인 패키지 (npm)
├── worker.js  ← 서버에서 실행, 외부 API 폴링 / Webhook 수신
└── ui/        ← 보드 UI에 연동 현황 위젯 표시
```

예: Redmine 동기화 플러그인
- worker가 주기적으로 Redmine 폴링
- 새 이슈 발견 시 Paperclip 이슈 자동 생성
- 상태 변경 시 양방향 동기화

---

## 6. 한글(비ASCII) 텍스트 처리 주의사항

Windows 환경에서 외부 API 호출 시 curl이 한글을 손상시키는 문제가 있다.

**해결책**: curl 대신 Node.js 헬퍼 사용

```bash
# 한글 포함 요청 시 반드시 이 방식 사용
node skills/paperclip/pc-api.js POST /api/issues/... '{"title":"한글 제목"}'

# ASCII만 있는 GET 요청은 curl 사용 가능
curl -sS "$PAPERCLIP_API_URL/api/agents/me" -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

외부 시스템 스킬 작성 시에도 동일한 원칙을 적용해야 한다.
