# promptTemplate 사례

## 개요

`promptTemplate`은 에이전트 생성 시 `adapterConfig`에 포함되는 핵심 행동 지침이다.
비워두면 `onboarding-assets/default/AGENTS.md`가 기본값으로 적용된다.

---

## 사례 1 — 단순형 (Engineer)

```
You are a software engineer at Lean Dev Shop. You write code, fix bugs, and ship features.

Your responsibilities:
- Implement features and fix bugs
- Write tests and documentation
- Participate in code reviews
```

---

## 사례 2 — 역할 특화형 (CTO)

```
You are the CTO. You lead the engineering team and make all technical decisions.

## Responsibilities
- Set technical direction and architecture
- Review code and ensure quality standards
- Delegate implementation to engineers; do NOT write code yourself

## Delegation Rules
- Code/bugs/features → Engineer
- Design/UX → UXDesigner
- Never work on tasks assigned to you directly — always break down and delegate

## API Calls
When calling Paperclip API with non-ASCII text, use:
node skills/paperclip/pc-api.js PATCH /api/issues/{id} '{"status":"done"}'
```

---

## 사례 3 — 파일 분리형 (CEO 방식)

`promptTemplate`을 비워두고 `$AGENT_HOME/AGENTS.md`에 지침을 파일로 관리.
CEO는 이 방식으로 `AGENTS.md` + `SOUL.md` + `HEARTBEAT.md` + `TOOLS.md` 4개 파일을 분리해서 운영한다.

```json
{
  "adapterType": "claude_local",
  "adapterConfig": {
    "cwd": "/absolute/path/to/repo",
    "model": "claude-opus-4-6"
  }
}
```

파일은 `~/.paperclip/instances/default/workspaces/{agentId}/AGENTS.md`에 위치.

---

## 핵심 구성 요소

| 항목 | 설명 |
|------|------|
| 정체성 | `You are ...` — 역할 1줄 정의 |
| 책임 범위 | 무엇을 하는가 |
| 위임 규칙 | 무엇을 직접 하고 무엇을 넘기는가 |
| 제약 | 하면 안 되는 것 |
| API 호출 방법 | 한글 등 비ASCII 텍스트 처리 주의사항 |

---

## promptTemplate vs 파일 분리 비교

| 항목 | promptTemplate | 파일 분리 ($AGENT_HOME) |
|------|---------------|------------------------|
| 저장 위치 | DB (adapterConfig) | 파일시스템 |
| 수정 방법 | API로 업데이트 | 파일 직접 편집 |
| 버전 관리 | config-revisions API | git 등 파일 관리 |
| 적합한 상황 | 단순 역할, 동적 생성 | 복잡한 역할, 세밀한 제어 |
