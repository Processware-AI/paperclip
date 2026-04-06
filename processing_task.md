# 위임의 실제 시스템 처리

## 개요

"위임"은 에이전트 간 직접 통신이 아니다.
**DB 이슈 레코드 + assignee 설정 + wakeup 신호** 세 가지로 이루어진다.
모든 조율은 이슈 레코드를 매개로 서버가 처리한다.

---

## CEO가 CTO에게 위임하는 실제 흐름

```
CEO 에이전트 실행 중
    ↓
1. POST /api/companies/{id}/issues       ← 서브태스크 생성
   {
     parentId: 현재이슈ID,
     assigneeAgentId: CTO_ID,            ← CTO에게 할당
     title: "...",
     body: "..."
   }
    ↓
2. 서버가 assigneeAgentId 감지
    ↓
3. queueIssueAssignmentWakeup() 호출     ← CTO를 즉시 깨움
    ↓
4. heartbeat.wakeup(CTO_ID, { source: "assignment" })
    ↓
5. CTO 프로세스 실행 시작
    ↓
6. CTO가 PAPERCLIP_TASK_ID로 해당 이슈 인식
    ↓
7. POST /api/issues/{id}/checkout        ← 이슈 잠금 (다른 에이전트 접근 차단)
    ↓
8. 작업 수행
```

---

## 핵심 메커니즘 3가지

| 메커니즘 | 역할 |
|---------|------|
| **이슈 생성** (`POST /issues`) | 위임할 작업을 DB에 기록, `parentId`로 계층 구조 형성 |
| **assigneeAgentId 설정** | 담당 에이전트 지정 |
| **wakeup()** | 담당 에이전트를 heartbeat 주기 무관하게 즉시 실행 |

---

## 작업 완료 후 복귀 흐름

```
CTO가 작업 완료
    ↓
PATCH /api/issues/{id}  { status: "done" }
    ↓
서버가 parentId 감지 → CEO를 wakeup()
    ↓
CEO가 깨어나 결과 확인
```

---

## 이슈 계층 구조

```
[CEO 이슈] (parentId: null)
    └── [CTO 서브태스크] (parentId: CEO이슈ID)
            └── [Engineer 서브태스크] (parentId: CTO이슈ID)
```

`parentId`로 위임 체인 전체가 추적 가능하다.

---

## checkout 잠금의 의미

- `POST /api/issues/{id}/checkout` — 이슈를 특정 에이전트가 점유
- 409 응답 시 다른 에이전트가 이미 작업 중 → 재시도 금지, 다음 작업으로 이동
- 단일 assignee 모델로 중복 실행 방지
