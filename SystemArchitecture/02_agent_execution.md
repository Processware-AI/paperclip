# 에이전트 실행 메커니즘

> 이 문서는 Paperclip의 핵심 동작 원리를 설명한다.

---

## 1. 핵심 개념: 에이전트는 어떻게 일하는가

에이전트는 **연속적으로 실행되지 않는다.**
주기적으로 깨어나 → 이슈 확인 → 처리 → 잠드는 사이클을 반복한다.

```
잠 (대기)
    ↓
깨어남 (Wakeup)
    ↓
이슈 확인 및 처리
    ↓
결과 기록 후 종료
    ↓
잠 (대기)
```

이 한 번의 실행 사이클을 **헤드비트(Heartbeat)**라고 부른다.

---

## 2. 에이전트 역할 정의 구조

에이전트가 실행될 때 LLM에게 전달되는 역할 정의는 두 계층으로 구성된다.

### CEO 에이전트 (4개 파일)
```
~/.paperclip/instances/default/workspaces/{agentId}/
├── AGENTS.md      ← 위임 규칙, API 호출 방법
├── SOUL.md        ← 전략적 사고방식, 말투, 원칙
├── HEARTBEAT.md   ← 매 실행 시 따를 체크리스트
└── TOOLS.md       ← 사용 가능한 도구 목록
```

### 일반 에이전트 (1개 파일)
```
~/.paperclip/instances/default/workspaces/{agentId}/
└── AGENTS.md      ← "작업을 완료하라, 막히면 담당자에게 넘겨라"
```

또는 에이전트 생성 시 `promptTemplate`에 직접 역할을 정의할 수 있다.

---

## 3. Claude CLI 실행 메커니즘

에이전트가 깨어나면 Paperclip 서버가 Claude CLI를 자식 프로세스로 실행한다.

### 실행 명령어 (실제)
```bash
claude \
  --print - \
  --output-format stream-json \
  --verbose \
  --model claude-opus-4-6 \
  --max-turns 10 \
  --append-system-prompt-file {agentId}/AGENTS.md \
  --add-dir ~/.claude/skills/paperclip \
  --dangerously-skip-permissions
```

### 환경 변수로 컨텍스트 주입
```bash
PAPERCLIP_API_KEY=<단기 JWT>         # API 인증
PAPERCLIP_API_URL=http://127.0.0.1:3100
PAPERCLIP_AGENT_ID=<에이전트 UUID>
PAPERCLIP_TASK_ID=<처리할 이슈 ID>  # 깨어난 이유
PAPERCLIP_WAKE_REASON=issue_assigned
```

### stdin으로 지시 주입
```
## Paperclip Wake Payload

- reason: issue_assigned
- issue: #42 Redmine 동기화 구현
- issue status: todo

New comments in order:
1. comment at 2026-04-07 by board user-1
Redmine에서 미해결 이슈를 가져와서 Paperclip 태스크로 만들어줘.
```

**LLM이 이 자연어를 해석해서 스스로 어떤 API를 호출할지 결정한다.**

---

## 4. 이슈 처리 흐름 (CEO → CTO → Engineer)

```
사람이 이슈 생성
"새 기능 개발: Redmine 연동"
    ↓
CEO 깨어남 (wakeup: issue_assigned)
    ↓
CEO가 판단: "기술 작업 → CTO에게 위임"
    ↓
POST /api/issues  { parentId, assigneeAgentId: CTO_ID }
    ↓
서버가 CTO를 즉시 wakeup
    ↓
CTO 깨어남
    ↓
POST /api/issues/{id}/checkout  ← 이슈 잠금
    ↓
CTO가 판단: "구현 작업 → Engineer에게 위임"
    ↓
Engineer 깨어남 → 실제 작업 수행
    ↓
PATCH /api/issues/{id}  { status: "done" }
    ↓
서버가 CTO → CEO 순으로 순차 wakeup
```

---

## 5. Wakeup 메커니즘 상세

wakeup은 에이전트 프로세스에 직접 신호를 보내는 것이 아니다.
**DB 큐에 레코드를 쓰고, 서버가 주기적으로 감지해서 프로세스를 시작**한다.

```
wakeup() 호출
    ↓
DB: agent_wakeup_requests INSERT (status: "queued")
    ↓
서버 스케줄러 (매 30초 실행)
    ↓
queued 레코드 발견 → status: "claimed" 으로 업데이트
    ↓
Claude CLI spawn
    ↓
완료 → status: "completed" / "failed"
```

### Wakeup 종류

| 종류 | 발생 시점 | 대기 시간 |
|------|----------|----------|
| **timer** | `intervalSec` 주기마다 | 최대 intervalSec |
| **assignment** | 이슈 담당자 변경 즉시 | 최대 30초 |
| **comment** | 에이전트가 @멘션될 때 | 최대 30초 |

위임 시에는 assignment wakeup이 발생하므로 heartbeat 주기를 기다리지 않아도 된다.

---

## 6. 에이전트 생명주기

```
생성 (pending_approval)
    ↓
사람 승인
    ↓
idle (대기)
    ↓ wakeup
running (실행 중)
    ↓ 완료
idle (대기)

[예산 초과 시]
    ↓
paused (자동 중지) → 사람이 예산 조정 후 resume

[종료 시]
    ↓
terminated (영구 종료)
```

---

## 7. 처리 속도에 영향을 주는 요인

| 요인 | 영향 | 개선 방법 |
|------|------|----------|
| heartbeat 주기 | 타이머 wakeup 대기 시간 | `intervalSec` 줄이기 (예: 60초) |
| 위임 단계 수 | 단계마다 wakeup 지연 누적 | 불필요한 중간 단계 제거 |
| LLM 응답 시간 | 수십 초~수 분 | 강력한 모델일수록 느림 |
| 스케줄러 tick | 최대 30초 추가 대기 | `HEARTBEAT_SCHEDULER_INTERVAL_MS` 조정 |
| system prompt 크기 | 매 실행 토큰 소비 | promptTemplate 간결하게 유지 |
