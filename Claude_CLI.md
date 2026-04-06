# Claude CLI 프로세스 실행 방식

## 개요

Paperclip 서버가 Claude CLI를 자식 프로세스로 `spawn`한다.
Claude CLI 자체가 AI 에이전트 역할을 하고, Paperclip은 그 실행을 관리하는 제어 플레인이다.

---

## 실제 실행 명령어

```bash
claude \
  --print - \
  --output-format stream-json \
  --verbose \
  --model claude-opus-4-6 \
  --max-turns 10 \
  --append-system-prompt-file ~/.paperclip/instances/default/workspaces/{agentId}/AGENTS.md \
  --add-dir ~/.claude/skills/paperclip \
  --dangerously-skip-permissions
```

stdin으로 wake prompt가 주입된다.

---

## 실행 시 주입되는 환경 변수

```bash
PAPERCLIP_API_KEY=<실행용 단기 JWT>
PAPERCLIP_API_URL=http://127.0.0.1:3100
PAPERCLIP_AGENT_ID=<에이전트 UUID>
PAPERCLIP_COMPANY_ID=<회사 ID>
PAPERCLIP_RUN_ID=<이번 실행 ID>
PAPERCLIP_TASK_ID=<처리할 이슈 ID>
PAPERCLIP_WAKE_REASON=issue_assigned
PAPERCLIP_WAKE_COMMENT_ID=<코멘트 ID>
```

에이전트가 API를 호출할 때 이 환경 변수들을 그대로 사용한다.

---

## Claude CLI에 전달되는 내용

### system prompt (`--append-system-prompt-file`)
```
You are the CEO.
Default to action. Ship over deliberate...
[SOUL.md + AGENTS.md + HEARTBEAT.md 전체 내용]
```

### stdin (wake prompt)
```
## Paperclip Wake Payload

Treat this wake payload as the highest-priority change for the current heartbeat.
This heartbeat is scoped to the issue below...

- reason: issue_assigned
- issue: #42 Redmine 동기화 구현
- issue status: todo
- pending comments: 1/1

New comments in order:
1. comment abc-123 at 2026-04-07T... by board user-1
Redmine에서 미해결 이슈를 가져와서 Paperclip 태스크로 만들어줘.
```

---

## LLM의 실행 흐름

```
자연어 지시 수신
    ↓
HEARTBEAT.md 절차에 따라 스스로 판단
    ↓
curl / node 명령으로 API 호출 결정
    ↓
bash 명령 실행 (Claude CLI의 tool use)
    ↓
결과 확인 후 다음 행동 결정
    ↓
작업 완료 시 PATCH /api/issues/{id} { status: "done" }
```

이슈에 등록된 자연어 지시를 LLM이 해석해서, 어떤 API를 어떤 순서로 호출할지 스스로 결정하고 실행한다.
코딩된 로직이 아니라 **LLM의 추론이 실행 흐름을 결정**한다.

---

## stdout 처리

```
Claude CLI stdout (stream-json)
    ↓
parseClaudeStreamJson() 파싱
    ↓
실행 로그 DB 저장
    ↓
프로세스 종료 → wakeup status: "completed" / "failed"
```
