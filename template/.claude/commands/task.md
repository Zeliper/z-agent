# /task Command

사용자가 작업을 요청할 때 사용하는 z-agent 명령어입니다.
`/task PLAN-XXX` 형식으로 Plan을 기반으로 작업을 시작할 수 있습니다.

## 중요: 도구 사용 규칙

**반드시 z-agent MCP 도구(z_*)만 사용하세요.**

### 금지된 도구
- ❌ Task tool (Explore, Agent 등) - 단, z_get_agent_prompt로 받은 프롬프트 실행 시에만 허용
- ❌ Glob tool
- ❌ Grep tool
- ❌ Read tool
- ❌ Edit tool
- ❌ Write tool

### 허용된 도구
- ✅ z_analyze_difficulty
- ✅ z_search_lessons
- ✅ z_create_task
- ✅ z_update_todo
- ✅ z_get_task_status
- ✅ z_get_agent_prompt
- ✅ z_save_todo_result
- ✅ z_generate_summary
- ✅ z_record_lesson
- ✅ z_list_dir
- ✅ z_glob
- ✅ z_read_file
- ✅ z_write_file
- ✅ z_edit_file
- ✅ z_get_plan (Plan 연계 시)
- ✅ z_link_plan_to_task (Plan 연계 시)
- ✅ z_list_tasks (Task 목록 조회)
- ✅ z_list_lessons (Lesson 목록 조회)
- ✅ z_list_plans (Plan 목록 조회)
- ✅ z_list_answers (Answer 목록 조회)
- ✅ z_get_answer (Answer 상세 조회)
- ✅ z_link_answer_to_task (Answer 연결)
- ✅ z_get_related (관련 항목 조회)
- ✅ z_query (통합 검색)
- ✅ z_list_memories (Memory 목록 조회)
- ✅ z_search_memories (Memory 검색)

## 상호 참조 기능

### Answer를 참조하여 Task 실행
```
# 사용자가 "answer-001 내용 기반으로 수정해줘" 요청 시
1. z_get_answer(answerId: "answer-001")
   → Answer 내용 및 관련 항목 확인

2. z_create_task(
     description: "answer-001 기반 수정 작업",
     todos: [...]
   )
   → task-001 생성

3. z_link_answer_to_task(answerId: "answer-001", taskId: "task-001")
   → 양방향 연결
```

### Plan과 Answer가 모두 연결된 경우
```
# PLAN-001이 answer-001을 참조하고 있다면
z_get_plan("PLAN-001")
→ relatedAnswers: ["answer-001"]

# Task 생성 시 Answer도 함께 연결
z_link_answer_to_task("answer-001", "task-001")
```

### 관련 항목 조회
```
z_get_related(entityType: "task", entityId: "task-001")
→ 연결된 Answers, Plans, Lessons 목록
```

## 실행 흐름

### A. 일반 Task (기존 방식)

#### 0. 프로젝트 Memory 조회 (필수 - 가장 먼저!)

**⚠️ 모든 Task는 Memory 조회로 시작해야 합니다.**

```
z_list_memories()
→ 프로젝트 컨벤션, 특기사항, 중요 정보 확인
→ 특히 priority: high 항목은 반드시 고려
```

**Memory가 있는 경우:**
```
📋 프로젝트 Memory 참조:
- mem-001: [high] Next.js 14 App Router 사용
- mem-002: [medium] API는 /api/v1 경로 사용
→ 해당 정보를 작업에 반영
```

#### 1. 관련 Lesson 검색 (필수)

**⚠️ Memory 확인 후 Lesson도 검색합니다.**

```
z_search_lessons(query: "핵심 키워드")
→ 관련 lessons 참조
→ 기존 경험이 있다면 해당 solution 활용
```

**Lesson이 발견된 경우:**
```
💡 관련 Lesson 발견: lesson-XXX
이전 해결 방법: [solution 내용 요약]
→ 해당 방법 참고하여 작업 진행
```

#### 2. 난이도 분석
```
z_analyze_difficulty(input: "사용자 입력")
→ difficulty: H/M/L
→ suggestedModel: opus/sonnet/haiku
```

#### 3. Task 생성
```
z_create_task(
  description: "작업 요약",
  todos: [
    { description: "TODO 1", difficulty: "H" },
    { description: "TODO 2", difficulty: "M" }
  ]
)
→ taskId, filePath
```

### B. Plan 기반 Task (PLAN-XXX 지정 시)

#### 1. 관련 Lesson 검색 (필수)
```
z_search_lessons(query: "Plan 제목 또는 핵심 키워드")
→ 관련 lessons 참조
```

#### 2. Plan 조회
```
사용자: /task PLAN-001 시작해줘

z_get_plan(planId: "PLAN-001")
→ plan.todos, plan.title, plan.description
→ plan.relatedAnswers (연결된 Answer 목록)
```

#### 3. Task 생성 (Plan 기반)
```
z_create_task(
  description: plan.title,
  todos: plan.todos  ← Plan의 TODO 목록 사용
)
→ taskId: task-001
```

#### 4. Plan-Task 연결
```
z_link_plan_to_task(planId: "PLAN-001", taskId: "task-001")
→ Plan 상태가 in_progress로 변경
→ Plan의 linkedTasks에 task-001 추가
```

#### 5. 관련 Answer 연결 (Plan에 Answer가 있는 경우)
```
# Plan의 relatedAnswers에서 Answer ID 확인 후 연결
for answerId in plan.relatedAnswers:
  z_link_answer_to_task(answerId, "task-001")
```

### C. Answer 기반 Task (answer-XXX 참조 시)

#### 1. 관련 Lesson 검색 (필수)
```
z_search_lessons(query: "Answer 내용 관련 키워드")
→ 관련 lessons 참조
```

#### 2. Answer 조회
```
사용자: /task answer-001 내용대로 수정해줘

z_get_answer(answerId: "answer-001")
→ answer.question, answer.summary
→ answer.relatedPlans (연결된 Plan 목록)
```

#### 3. Task 생성
```
z_create_task(
  description: "answer-001 기반 수정",
  todos: [...]
)
→ taskId: task-001
```

#### 4. Answer-Task 연결
```
z_link_answer_to_task(answerId: "answer-001", taskId: "task-001")
→ 양방향 연결됨
```

### 공통: TODO 처리
```
for each TODO:
  a. z_update_todo(taskId, todoIndex, "in_progress")

  b. z_get_agent_prompt(difficulty, todoDescription)
     → 프롬프트와 모델 정보

  c. Task tool로 해당 모델에 작업 위임
     (이때만 Task tool 사용 허용)

  d. z_save_todo_result(taskId, todoId, status, summary, details)

  e. z_update_todo(taskId, todoIndex, "complete")
```

### 최종 요약
```
z_generate_summary(taskId)
→ 간결한 요약만 출력 (context 절약)
```

## 파일 작업 시

### 파일 탐색
```
z_list_dir("src", recursive=true)
z_glob("**/*.ts")
z_read_file("src/main.ts")
```

### 파일 수정
```
z_write_file("src/new.ts", content)
z_edit_file("src/main.ts", oldString, newString)
```

**주의: Edit/Write tool 대신 z_write_file/z_edit_file 사용**
→ context에 코드 내용이 포함되지 않음

## 예시: Answer 기반 Task

```
사용자: /task answer-001 분석 결과대로 수정해줘

1. z_get_answer("answer-001")
   → question: "성능 문제 분석해줘"
   → summary: "메모리 누수와 N+1 쿼리 문제 발견"

2. z_create_task(
     description: "answer-001 기반 성능 수정",
     todos: [
       { description: "메모리 누수 수정", difficulty: "H" },
       { description: "N+1 쿼리 최적화", difficulty: "H" }
     ]
   )
   → task-001

3. z_link_answer_to_task("answer-001", "task-001")
   → ✅ 연결됨

4. TODO 순차 처리...

5. z_generate_summary("task-001")
   → 완료 요약

## Task [task-001] 완료

### 요약
answer-001 분석 결과 기반 성능 수정 완료

### 완료 항목
- ✅ TODO #1: 메모리 누수 수정
- ✅ TODO #2: N+1 쿼리 최적화

### 연결 정보
📁 .z-agent/task-001/
🔗 연결됨: answer-001
```

## 예시: Plan 기반 Task (Answer 포함)

```
사용자: /task PLAN-001 시작해줘

1. z_get_plan("PLAN-001")
   → title: "성능 최적화"
   → relatedAnswers: ["answer-001"]
   → todos: [...]

2. z_create_task(...)
   → task-001

3. z_link_plan_to_task("PLAN-001", "task-001")
   → ✅ 연결됨

4. z_link_answer_to_task("answer-001", "task-001")
   → ✅ Answer도 연결됨

5. TODO 순차 처리...

6. z_generate_summary("task-001")

## Task [task-001] 완료

### 연결된 항목
📁 .z-agent/plans/PLAN-001.md
📁 .z-agent/answers/answer-001.md
```

## 주의사항

- **z_* MCP 도구만 사용** (기본 도구 금지)
- **⚠️ Lesson 검색 필수**: 작업 시작 전 반드시 z_search_lessons 호출
- `PLAN-XXX` 입력 시 해당 Plan 기반으로 Task 생성
- `answer-XXX` 참조 시 해당 Answer와 연결
- 세션 컨텍스트 최소화: 상세 내용은 파일에 저장
- 에러 발생 시 사용자에게 선택지 제공
- `.z-agent/`와 `.claude/` 폴더는 프로젝트 분석 시 제외
- **ID 참조 시 해당 엔티티 조회 후 연결 정보 포함**
