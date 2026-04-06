# 한글 깨짐 버그 수정 보고서

## 문제

Windows 환경에서 에이전트가 bash/curl로 Paperclip API에 한글(UTF-8) 텍스트를 전송할 때
인코딩이 손상되어 한글이 깨지는 문제 발생.

## 근본 원인

`curl`의 `-d`/`--data` 플래그는 Windows에서 비ASCII 문자를 포함한 문자열을 전달할 때
UTF-8 인코딩을 안정적으로 유지하지 못함.
bash 환경의 문자열 처리 방식 차이로 인해 API 전송 전 바이트가 손상됨.

---

## 수정 내용 (커밋: `55d0619e`)

### 1. Node.js UTF-8 안전 API 헬퍼 신규 추가

**파일**: `skills/paperclip/pc-api.js` (신규 생성)

curl 대신 Node.js의 `http`/`https` 모듈을 사용하는 헬퍼 스크립트.
요청 바디를 전송 전 명시적으로 UTF-8 Buffer로 인코딩하여 한글 손상 방지.

```
# 사용법
node skills/paperclip/pc-api.js <METHOD> <PATH> '<JSON>'

# 예시
node skills/paperclip/pc-api.js POST /api/companies/CLA/issues '{"title":"한글 제목"}'
```

환경 변수에서 `Authorization`, `X-Paperclip-Run-Id` 헤더를 자동 주입.

---

### 2. SKILL.md에 Windows 경고 추가

**파일**: `skills/paperclip/SKILL.md`

Authentication 섹션에 Windows UTF-8 인코딩 경고 추가.
한글 등 비ASCII 텍스트가 포함된 POST/PATCH/PUT 요청에는 반드시 `pc-api.js`를 사용하도록 명시.

---

### 3. 스킬 레퍼런스에서 curl → pc-api.js 교체

**파일**: `skills/paperclip-create-agent/SKILL.md`
- hire 요청, 승인 댓글, 승인 링크 API 호출

**파일**: `skills/paperclip/references/company-skills.md`
- skills import, sync, agent hire/create API 호출

위 파일들의 curl 명령을 모두 `node skills/paperclip/pc-api.js`로 교체.

---

### 4. 서버 측 방어적 수정 (근본 원인 아님)

**파일**: `packages/adapter-utils/src/server-utils.ts`

자식 프로세스의 stdout/stderr 스트림에 `setEncoding('utf8')` 추가.
UTF-8 멀티바이트 문자가 스트림 청크 경계에서 잘리는 현상을 방어적으로 처리.

```diff
- child.stdout?.on("data", (chunk: unknown) => {
-   const text = String(chunk);
+ child.stdout?.setEncoding("utf8");
+ child.stdout?.on("data", (chunk: string) => {

- child.stderr?.on("data", (chunk: unknown) => {
-   const text = String(chunk);
+ child.stderr?.setEncoding("utf8");
+ child.stderr?.on("data", (chunk: string) => {
```

> **참고**: 이 수정은 유효한 방어적 개선이지만, 한글 깨짐의 근본 원인은 아니었음.
> 근본 원인은 curl의 Windows 인코딩 처리 문제였으며, pc-api.js 도입으로 해결됨.

---

## 요약

| 구분 | 내용 |
|------|------|
| 근본 원인 | Windows에서 curl이 UTF-8 바디를 손상시킴 |
| 핵심 해결책 | `pc-api.js` (Node.js HTTP 클라이언트) 도입 |
| 영향 범위 | 에이전트 스킬의 API 호출 방식 전반 |
| 방어적 개선 | `server-utils.ts` stdout/stderr setEncoding |
