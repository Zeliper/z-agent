# /list Command

z-agent에서 관리하는 Task, Plan, Lesson, Answer를 조회하는 명령어입니다.

## 사용법

```
/list                    # 전체 요약 (Task, Plan, Lesson, Answer 개수)
/list tasks              # 모든 Task 목록
/list tasks pending      # pending 상태의 Task만
/list plans              # 모든 Plan 목록
/list plans ready        # ready 상태의 Plan만
/list lessons            # 모든 Lesson 목록
/list lessons security   # security 카테고리 Lesson만
/list answers            # 모든 Q&A 답변 목록
/list answers 검색어     # 질문/요약에서 키워드 검색
/list <자연어 검색>       # 모든 항목에서 자연어 검색
```

## 자연어 검색 예시

```
/list 프로젝트 구조
/list API 에러 해결
/list 성능 최적화 관련
/list JWT 인증
```

## 상호 참조 조회

```
# 특정 항목과 연결된 모든 관련 항목 조회
/list related answer-001    # answer-001과 연결된 Plan, Task, Lesson
/list related PLAN-001      # PLAN-001과 연결된 Answer, Task
/list related task-001      # task-001과 연결된 Answer, Lesson
```

## 중요: 도구 사용 규칙

**반드시 z-agent MCP 도구(z_*)만 사용하세요.**

### 허용된 도구
- ✅ z_list_tasks - Task 목록 조회 (상태별 필터링)
- ✅ z_list_plans - Plan 목록 조회 (상태별 필터링)
- ✅ z_list_lessons - Lesson 목록 조회 (카테고리별 필터링)
- ✅ z_list_answers - Q&A 답변 목록 조회 (키워드 검색)
- ✅ z_get_answer - Answer 상세 조회 (관련 항목 포함)
- ✅ z_get_plan - Plan 상세 조회 (관련 항목 포함)
- ✅ z_get_task_status - Task 상태 조회
- ✅ z_get_related - 관련 항목 조회
- ✅ z_query - 통합 검색

### 금지된 도구
- ❌ Task tool
- ❌ Glob tool
- ❌ Grep tool
- ❌ Read tool

## 실행 흐름

### 0. 입력 분석 (중요!)
먼저 사용자 입력을 분석합니다:
- `tasks`, `plans`, `lessons`, `answers` → 해당 타입 조회
- `related <ID>` → 관련 항목 조회
- 빈 입력 → 전체 요약
- **그 외 모든 입력** → 자연어 검색으로 처리

```
예시:
"/list tasks" → z_list_tasks()
"/list related answer-001" → z_get_related("answer", "answer-001")
"/list 프로젝트 구조" → z_query(keyword: "프로젝트 구조")
"/list API 에러 해결" → z_query(keyword: "API 에러 해결")
```

### 1. 전체 요약 (`/list`)
```
z_query(type: "all")
→ Task 현황: 3개 (pending: 1, in_progress: 1, completed: 1)
→ Plan 현황: 2개 (draft: 0, ready: 1, in_progress: 1)
→ Lesson 현황: 5개
→ Answer 현황: 3개
```

### 2. Task 조회 (`/list tasks [status]`)
```
z_list_tasks()                    # 전체
z_list_tasks(status: "pending")   # pending만
z_list_tasks(status: "in_progress")
z_list_tasks(status: "completed")
```

### 3. Plan 조회 (`/list plans [status]`)
```
z_list_plans()                    # 전체
z_list_plans(status: "ready")     # ready만
z_list_plans(status: "in_progress")
z_list_plans(status: "completed")
```

### 4. Lesson 조회 (`/list lessons [category]`)
```
z_list_lessons()                       # 전체
z_list_lessons(category: "security")   # security만
z_list_lessons(category: "performance")
z_list_lessons(category: "architecture")
```

### 5. Answer 조회 (`/list answers [keyword]`)
```
z_list_answers()                       # 전체
z_list_answers(keyword: "프로젝트")     # 키워드 검색
z_list_answers(keyword: "구조")         # 질문/요약에서 검색
```

### 6. 관련 항목 조회 (`/list related <ID>`)
```
z_get_related(entityType: "answer", entityId: "answer-001")
→ 연결된 Plans, Tasks, Lessons 목록

z_get_related(entityType: "plan", entityId: "PLAN-001")
→ 연결된 Answers, Tasks 목록

z_get_related(entityType: "task", entityId: "task-001")
→ 연결된 Answers, Lessons 목록
```

### 7. 통합 검색 / 자연어 검색
```
z_query(keyword: "버그")
→ 관련 Task, Plan, Lesson, Answer 통합 검색

# 자연어 검색도 z_query로 처리
z_query(keyword: "프로젝트 구조")
z_query(keyword: "API 에러")
```

## 출력 형식

### Task 목록
```
## Tasks (3개)

| ID        | 설명              | 상태        | 난이도 | TODO 진행률 | 연결 |
|-----------|------------------|-------------|--------|-------------|------|
| task-003  | API 리팩토링      | 🔄 in_progress | H      | 2/5 (40%)   | answer-001 |
| task-002  | 버그 수정         | ✅ completed   | M      | 3/3 (100%)  | - |
| task-001  | 초기 설정         | ✅ completed   | L      | 2/2 (100%)  | - |
```

### Plan 목록
```
## Plans (2개)

| ID        | 제목              | 상태        | 난이도 | 연결된 Task | 연결된 Answer |
|-----------|------------------|-------------|--------|-------------|---------------|
| PLAN-002  | 마이크로서비스    | 📝 ready       | H      | -           | answer-002    |
| PLAN-001  | 성능 최적화       | 🔄 in_progress | M      | task-003    | answer-001    |
```

### Lesson 목록
```
## Lessons (5개)

| ID         | 카테고리      | 태그                    | 요약                |
|------------|--------------|------------------------|---------------------|
| lesson-005 | security     | [auth, jwt]            | JWT 토큰 만료 처리   |
| lesson-004 | performance  | [cache, redis]         | Redis 캐시 전략     |
| lesson-003 | debugging    | [async, promise]       | Promise 체인 디버깅  |
```

### Answer 목록
```
## Q&A 답변 (3개)

| ID         | 질문                          | 요약                          | 연결 |
|------------|------------------------------|-------------------------------|------|
| answer-003 | 이 프로젝트 구조를 설명해줘     | TypeScript 기반 MCP 서버...   | PLAN-001 |
| answer-002 | 빌드 에러가 발생해요          | npm run build 후 dist 확인... | - |
| answer-001 | z-agent가 뭐야?              | Claude Code 워크플로우 관리... | task-002 |
```

### 관련 항목 조회 결과
```
## answer-001 관련 항목

### 연결된 Plans
- PLAN-001: 성능 최적화

### 연결된 Tasks
- task-003: API 리팩토링

### 연결된 Lessons
- lesson-002: 메모리 최적화

💡 사용법:
- Plan 실행: /task PLAN-001
- Task 확인: /list tasks
- Answer 상세: z_get_answer("answer-001")
```

## 예시

### 진행 중인 작업 확인
```
사용자: /list tasks in_progress

z_list_tasks(status: "in_progress")

## 진행 중인 Tasks (1개)

| ID        | 설명              | TODO 진행률 | 현재 작업          | 연결 |
|-----------|------------------|-------------|-------------------|------|
| task-003  | API 리팩토링      | 2/5 (40%)   | 엔드포인트 분리    | answer-001 |

💡 상세 보기: z_get_task_status("task-003")
💡 관련 항목: z_get_related("task", "task-003")
```

### 관련 항목 조회
```
사용자: /list related answer-001

z_get_related(entityType: "answer", entityId: "answer-001")

## answer-001 관련 항목

### 연결된 Plans
- PLAN-001: 성능 최적화 [🔄 in_progress]

### 연결된 Tasks
- task-003: API 리팩토링 [🔄 in_progress]

### 연결된 Lessons
- lesson-002: 메모리 최적화 기법

💡 answer-001 기반 새 Plan: /planning answer-001에 대한 추가 계획
💡 answer-001 기반 Task: /task answer-001 내용대로 수정
```

### 자연어 검색
```
사용자: /list 프로젝트 구조

z_query(keyword: "프로젝트 구조")

## 조회 결과

### 요약
- Tasks: 1개
- Plans: 0개
- Lessons: 1개
- Answers: 2개

### Tasks
- task-005: 프로젝트 구조 개선 [🔄 in_progress] 1/3 (33%)

### Lessons
- lesson-003: [architecture] 모듈 구조 설계 원칙

### Q&A Answers
- answer-003: 이 프로젝트 구조를 설명해줘... → TypeScript 기반 MCP 서버...
  🔗 연결됨: PLAN-001
- answer-001: 폴더 구조가 어떻게 되나요... → src/에 핵심 코드가...
  🔗 연결됨: task-002
```

## 주의사항

- 상태별 필터링으로 필요한 항목만 조회
- 간결한 테이블 형식으로 출력
- 상세 내용이 필요하면 z_get_task_status, z_get_plan, z_get_answer 사용
- **자연어 입력은 자동으로 통합 검색(z_query)으로 처리**
- **관련 항목 조회로 연결 관계 확인 가능**
