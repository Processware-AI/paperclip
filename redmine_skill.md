# Redmine 외부 시스템 연동 가이드

## 개요

Redmine 같은 외부 시스템의 정보를 읽어오는 역할을 정의하는 두 가지 방법.

---

## 방법 1 — 스킬로 정의 (권장)

`skills/redmine/SKILL.md`를 만들어 에이전트에게 장착한다.

```markdown
---
name: redmine
description: >
  Redmine 프로젝트 관리 시스템에서 이슈, 프로젝트, 사용자 정보를 읽고
  Paperclip 태스크와 동기화한다.
---

# Redmine Skill

## Authentication

환경 변수:
- `REDMINE_URL` — Redmine 서버 주소 (예: https://redmine.example.com)
- `REDMINE_API_KEY` — Redmine API 키

## 주요 작업

### 이슈 목록 조회
curl -sS "$REDMINE_URL/issues.json?project_id=myproject&status_id=open" \
  -H "X-Redmine-API-Key: $REDMINE_API_KEY"

### 특정 이슈 조회
curl -sS "$REDMINE_URL/issues/{id}.json" \
  -H "X-Redmine-API-Key: $REDMINE_API_KEY"

### Paperclip 태스크로 변환
읽어온 Redmine 이슈를 Paperclip 이슈로 생성하거나 상태를 동기화한다.

node skills/paperclip/pc-api.js POST /api/companies/$PAPERCLIP_COMPANY_ID/issues \
  '{"title":"[Redmine #123] 이슈 제목", "body":"...", "goalId":"..."}'

## 상태 매핑
| Redmine 상태 | Paperclip 상태 |
|-------------|---------------|
| New         | todo          |
| In Progress | in_progress   |
| Resolved    | done          |
| Rejected    | cancelled     |
```

### 에이전트 생성 시 스킬 장착

```json
{
  "name": "Redmine Sync Agent",
  "role": "redmine-sync",
  "adapterType": "claude_local",
  "adapterConfig": {
    "cwd": "/absolute/path/to/repo",
    "model": "claude-sonnet-4-6"
  },
  "desiredSkills": ["redmine"],
  "runtimeConfig": {
    "heartbeat": {
      "enabled": true,
      "intervalSec": 600,
      "wakeOnDemand": true
    }
  }
}
```

---

## 방법 2 — promptTemplate에 직접 정의

전담 동기화 에이전트 1개에 역할을 부여한다.

```
You are the Redmine Sync Agent. Your job is to bridge Redmine and Paperclip.

## Responsibilities
- Read open issues from Redmine assigned to the team
- Create or update corresponding Paperclip tasks
- Report blockers or priority changes to the CEO

## How to read Redmine
Use REDMINE_URL and REDMINE_API_KEY from environment:
curl -sS "$REDMINE_URL/issues.json?assigned_to_id=me" \
  -H "X-Redmine-API-Key: $REDMINE_API_KEY"

## Sync Rules
- Redmine status "In Progress" → Paperclip status "in_progress"
- Redmine status "Resolved"   → Paperclip status "done"
- 새 이슈 발견 시 CEO에게 코멘트로 보고

## API Calls
한글 등 비ASCII 텍스트가 포함된 요청은 반드시 pc-api.js 사용:
node skills/paperclip/pc-api.js POST /api/issues/{id}/comments '{"body":"동기화 완료"}'
```

---

## 두 방법 비교

| 항목 | 스킬 방식 | promptTemplate 직접 |
|------|----------|---------------------|
| 재사용성 | 여러 에이전트에 장착 가능 | 해당 에이전트 전용 |
| 유지보수 | 파일 1개만 수정 | 에이전트마다 수정 |
| 환경 변수 | adapterConfig에 주입 | adapterConfig에 주입 |
| 적합한 경우 | Redmine 접근이 여러 역할에 필요 | 전담 동기화 에이전트 1개 |

Redmine처럼 **공통 외부 시스템**은 스킬로 분리하는 것이 유지보수에 유리하다.

---

## 환경 변수 주입 방법

`adapterConfig`에 직접 설정하거나 `~/.paperclip/instances/default/.env`에 추가한다.

```json
{
  "adapterConfig": {
    "cwd": "/path/to/repo",
    "model": "claude-sonnet-4-6",
    "env": {
      "REDMINE_URL": "https://redmine.example.com",
      "REDMINE_API_KEY": "your-api-key"
    }
  }
}
```
