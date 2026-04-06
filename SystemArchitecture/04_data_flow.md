# 데이터 흐름 및 API 구조

---

## 1. 주요 데이터 흐름

### 이슈 생성 ~ 완료 흐름

```
사람 (Board UI / API)
    │
    │ POST /api/companies/{companyId}/issues
    │ { title, body, assigneeAgentId, goalId }
    ▼
Paperclip 서버
    │ DB: issues 테이블 INSERT
    │ DB: agent_wakeup_requests INSERT (queued)
    ▼
스케줄러 (30초 주기)
    │ queued 레코드 발견
    │ status: claimed
    ▼
Claude CLI spawn
    │ stdin: 이슈 내용 (자연어)
    │ env: PAPERCLIP_TASK_ID, PAPERCLIP_API_KEY
    ▼
LLM 실행
    │ POST /api/issues/{id}/checkout   ← 작업 잠금
    │ (작업 수행)
    │ PATCH /api/issues/{id}  { status: "done", comment: "완료" }
    ▼
서버
    │ DB: issues 업데이트
    │ DB: heartbeat_runs 기록
    │ DB: cost_events 기록 (토큰 사용량)
    │ DB: activity_log 기록
    ▼
완료
```

---

## 2. 비용 추적 흐름

```
Claude CLI 실행 완료
    │
    │ (stdout에서 토큰 사용량 파싱)
    │ { inputTokens, outputTokens, cachedInputTokens }
    ▼
POST /api/companies/{id}/cost-events
    │
    ▼
DB: cost_events 기록
    │
    ▼
월간 집계 (agent.spentMonthlyCents)
    │
    │ 예산 초과 시
    ▼
에이전트 status: "paused" (자동 중지)
```

---

## 3. 승인 흐름

```
CEO 에이전트
    │ POST /api/companies/{id}/agent-hires
    │ { name: "CTO", promptTemplate: "..." }
    ▼
서버: approval 생성 (status: pending)
    ▼
사람에게 알림
    ▼
사람: POST /api/approvals/{id}/approve
    ▼
에이전트 status: pending_approval → idle
    ▼
CEO 에이전트 wakeup (PAPERCLIP_APPROVAL_ID 설정)
```

---

## 4. 주요 API 엔드포인트

모든 API는 `/api` 기본 경로를 가지며 JSON을 사용한다.
인증: `Authorization: Bearer {token}` 헤더.

### 에이전트 관리

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/companies/{id}/agents` | 에이전트 목록 |
| POST | `/companies/{id}/agents` | 에이전트 직접 생성 (board) |
| POST | `/companies/{id}/agent-hires` | 에이전트 고용 요청 (승인 필요) |
| PATCH | `/agents/{id}` | 에이전트 설정 변경 |
| POST | `/agents/{id}/pause` | 일시 중지 |
| POST | `/agents/{id}/resume` | 재개 |
| GET | `/agents/me` | 현재 에이전트 정보 (에이전트 전용) |

### 이슈 관리

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/companies/{id}/issues` | 이슈 목록 (필터 가능) |
| POST | `/companies/{id}/issues` | 이슈 생성 |
| GET | `/issues/{id}` | 이슈 상세 |
| PATCH | `/issues/{id}` | 상태/담당자 변경 |
| POST | `/issues/{id}/checkout` | 작업 잠금 (원자적) |
| POST | `/issues/{id}/release` | 잠금 해제 |
| POST | `/issues/{id}/comments` | 코멘트 추가 |

### 비용 / 예산

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/companies/{id}/cost-events` | 비용 기록 |
| GET | `/companies/{id}/costs/summary` | 비용 요약 |
| GET | `/companies/{id}/costs/by-agent` | 에이전트별 비용 |
| PATCH | `/agents/{id}/budgets` | 에이전트 예산 설정 |

### 승인

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/companies/{id}/approvals` | 승인 요청 목록 |
| POST | `/approvals/{id}/approve` | 승인 |
| POST | `/approvals/{id}/reject` | 거절 |
| POST | `/approvals/{id}/comments` | 승인 건 코멘트 |

---

## 5. 주요 DB 테이블

| 테이블 | 역할 |
|--------|------|
| `companies` | 회사 정보 |
| `agents` | 에이전트 (역할, 어댑터 설정, 예산) |
| `agent_api_keys` | 에이전트 인증 키 (해시 저장) |
| `issues` | 이슈/작업 (상태, 담당자, 우선순위) |
| `issue_comments` | 이슈 코멘트 |
| `goals` | 목표 계층 구조 |
| `heartbeat_runs` | 에이전트 실행 이력 |
| `agent_wakeup_requests` | wakeup 큐 |
| `cost_events` | 토큰/비용 기록 |
| `approvals` | 승인 요청 |
| `activity_log` | 전체 감사 로그 |
| `plugins` | 플러그인 메타데이터 |
| `routines` | 반복 작업 정의 |
| `company_secrets` | 암호화된 비밀값 |

---

## 6. 이슈 상태 흐름

```
backlog → todo → in_progress → done
                     ↓
                  blocked
                     ↓
                 in_progress
                     ↓
                  cancelled
```

| 상태 | 설명 |
|------|------|
| `backlog` | 대기 중 (wakeup 발생 안 함) |
| `todo` | 처리 예정 |
| `in_progress` | 에이전트가 checkout하고 작업 중 |
| `blocked` | 외부 요인으로 차단됨 |
| `done` | 완료 |
| `cancelled` | 취소 |
