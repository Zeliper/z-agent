# /list Command

z-agent에서 관리하는 Task, Plan, Lesson을 조회하는 명령어입니다.

## 사용법

```
/list                    # 전체 요약 (Task, Plan, Lesson 개수)
/list tasks              # 모든 Task 목록
/list tasks pending      # pending 상태의 Task만
/list plans              # 모든 Plan 목록
/list plans ready        # ready 상태의 Plan만
/list lessons            # 모든 Lesson 목록
/list lessons security   # security 카테고리 Lesson만
```

## 중요: 도구 사용 규칙

**반드시 z-agent MCP 도구(z_*)만 사용하세요.**

### 허용된 도구
- ✅ z_list_tasks - Task 목록 조회 (상태별 필터링)
- ✅ z_list_plans - Plan 목록 조회 (상태별 필터링)
- ✅ z_list_lessons - Lesson 목록 조회 (카테고리별 필터링)
- ✅ z_query - 통합 검색

### 금지된 도구
- ❌ Task tool
- ❌ Glob tool
- ❌ Grep tool
- ❌ Read tool

## 실행 흐름

### 1. 전체 요약 (`/list`)
```
z_query(type: "all")
→ Task 현황: 3개 (pending: 1, in_progress: 1, completed: 1)
→ Plan 현황: 2개 (draft: 0, ready: 1, in_progress: 1)
→ Lesson 현황: 5개
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

### 5. 통합 검색 (`/list search <keyword>`)
```
z_query(keyword: "버그")
→ 관련 Task, Plan, Lesson 통합 검색
```

## 출력 형식

### Task 목록
```
## Tasks (3개)

| ID        | 설명              | 상태        | 난이도 | TODO 진행률 |
|-----------|------------------|-------------|--------|-------------|
| task-003  | API 리팩토링      | 🔄 in_progress | H      | 2/5 (40%)   |
| task-002  | 버그 수정         | ✅ completed   | M      | 3/3 (100%)  |
| task-001  | 초기 설정         | ✅ completed   | L      | 2/2 (100%)  |
```

### Plan 목록
```
## Plans (2개)

| ID        | 제목              | 상태        | 난이도 | 연결된 Task |
|-----------|------------------|-------------|--------|-------------|
| PLAN-002  | 마이크로서비스    | 📝 ready       | H      | -           |
| PLAN-001  | 성능 최적화       | 🔄 in_progress | M      | task-003    |
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

## 예시

### 진행 중인 작업 확인
```
사용자: /list tasks in_progress

z_list_tasks(status: "in_progress")

## 진행 중인 Tasks (1개)

| ID        | 설명              | TODO 진행률 | 현재 작업          |
|-----------|------------------|-------------|-------------------|
| task-003  | API 리팩토링      | 2/5 (40%)   | 엔드포인트 분리    |

💡 상세 보기: z_get_task_status("task-003")
```

### 준비된 Plan 확인
```
사용자: /list plans ready

z_list_plans(status: "ready")

## 실행 대기 중인 Plans (1개)

| ID        | 제목              | 난이도 | TODO 수 |
|-----------|------------------|--------|---------|
| PLAN-002  | 마이크로서비스    | H      | 8개     |

💡 실행하려면: /task PLAN-002
```

## 주의사항

- 상태별 필터링으로 필요한 항목만 조회
- 간결한 테이블 형식으로 출력
- 상세 내용이 필요하면 z_get_task_status, z_get_plan 사용
- 검색어가 있으면 z_query로 통합 검색
