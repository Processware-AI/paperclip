# wakeup의 실제 동작

## 개요

wakeup은 에이전트 프로세스에 직접 신호를 보내는 것이 아니다.
**DB에 레코드를 쓰고, 서버가 주기적으로 그걸 감지해서 프로세스를 실행**하는 방식이다.

---

## 전체 흐름: DB 큐 기반 폴링

```
wakeup() 호출
    ↓
1. DB에 agent_wakeup_requests 레코드 INSERT
   { agentId, source: "assignment", status: "queued", payload: {...} }
    ↓
2. 서버의 setInterval (매 30초) → tickTimers() + resumeQueuedRuns()
    ↓
3. status: "queued" 레코드 발견
    ↓
4. status: "claimed" 으로 업데이트  ← 중복 실행 방지 락
    ↓
5. Claude CLI 프로세스 실행 (child_process.spawn)
   claude --append-system-prompt-file AGENTS.md ...
    ↓
6. 실행 완료 → status: "completed" / "failed"
```

---

## 핵심 구성 요소

| 구성 요소 | 역할 |
|---------|------|
| `agent_wakeup_requests` 테이블 | wakeup 큐 (DB) |
| `tickTimers()` | 매 30초 실행 — timer 방식 heartbeat 체크 |
| `resumeQueuedRuns()` | queued 상태 레코드를 꺼내 실행 |
| `status: queued → claimed` | 중복 실행 방지 락 |

---

## timer wakeup vs assignment wakeup 차이

| 구분 | timer | assignment |
|------|-------|-----------|
| 발생 시점 | `intervalSec` 주기마다 | 이슈 assignee 변경 즉시 |
| 누가 큐에 넣나 | 서버 스케줄러 | 이슈 업데이트 API |
| 대기 시간 | 최대 intervalSec | 최대 30초 (스케줄러 tick) |

위임 시 wakeup은 즉시 큐에 들어가고, 최대 30초 안에 에이전트 프로세스가 시작된다.
heartbeat 주기(기본 5분)를 기다리지 않아도 된다.

---

## wakeup status 생명주기

```
queued → claimed → completed
                 → failed
```

- `queued` — 실행 대기 중
- `claimed` — 서버가 가져가서 실행 중
- `completed` — 정상 완료
- `failed` — 오류 발생
