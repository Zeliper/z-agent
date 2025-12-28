# /planning Command

사용자가 작업 계획을 수립할 때 사용하는 z-agent 명령어입니다.
계획은 `.z-agent/plans/PLAN-XXX.md` 파일로 저장되며, 나중에 `/task PLAN-XXX` 로 실행할 수 있습니다.

## 중요: 도구 사용 규칙

**반드시 z-agent MCP 도구(z_*)만 사용하세요.**

### 금지된 도구
- ❌ Task tool (Explore, Agent 등)
- ❌ Glob tool
- ❌ Grep tool
- ❌ Read tool

### 허용된 도구
- ✅ z_analyze_difficulty
- ✅ z_search_lessons
- ✅ z_create_plan
- ✅ z_update_plan
- ✅ z_get_plan
- ✅ z_list_plans
- ✅ z_list_dir
- ✅ z_glob
- ✅ z_read_file
- ✅ z_list_tasks (Task 목록 조회)
- ✅ z_list_lessons (Lesson 목록 조회)
- ✅ z_list_answers (Answer 목록 조회)
- ✅ z_get_answer (Answer 상세 조회)
- ✅ z_get_related (관련 항목 조회)
- ✅ z_query (통합 검색)

## 상호 참조 기능

### Answer를 참조하여 Plan 생성
```
# 사용자가 "answer-001에 대한 대응책을 계획해줘" 요청 시
1. z_get_answer(answerId: "answer-001")
   → Answer 내용 및 관련 항목 확인

2. z_create_plan(
     title: "성능 문제 대응",
     description: "answer-001에서 분석한 성능 문제 해결",
     relatedAnswers: ["answer-001"]  # 자동으로 양방향 연결
   )
   → PLAN-001 생성, Answer와 연결됨
```

### 기존 Plan/Task 참조
```
# 관련 Plan이 있는지 확인
z_list_plans()
z_get_plan("PLAN-001")

# 관련 Task가 있는지 확인
z_list_tasks()
z_get_task_status("task-001")

# 특정 엔티티의 관련 항목 조회
z_get_related(entityType: "answer", entityId: "answer-001")
→ 연결된 Plans, Tasks, Lessons 목록
```

## 실행 흐름

### 1. 입력 분석 및 참조 확인
```
# ID 참조가 있는지 확인
- "answer-XXX" → z_get_answer()로 조회
- "PLAN-XXX" → z_get_plan()으로 조회
- "task-XXX" → z_get_task_status()로 조회
```

### 2. Plan 생성
```
z_create_plan(
  title: "작업 제목",
  description: "사용자 입력",
  relatedAnswers: ["answer-001"]  # 선택 - 참조할 Answer
)
→ planId: PLAN-001
→ filePath: .z-agent/plans/PLAN-001.md
```

### 3. 난이도 분석
```
z_analyze_difficulty(input: "사용자의 계획 요청")
→ difficulty: H/M/L
→ suggestedModel: opus (복잡한 계획은 Opus 사용)
```

### 4. 관련 Lesson 검색
```
z_search_lessons(query: "계획 관련 키워드")
→ 이전 유사 작업에서의 교훈 참조
```

### 5. 프로젝트 분석 (필요시)
```
z_list_dir(dirPath: ".", recursive: true)
z_glob(pattern: "**/*.ts")
z_read_file(filePath: "src/main.ts")
```

### 6. 계획 수립 (Opus 수준 분석)
- 작업을 논리적 Phase와 단계로 분해
- 각 단계별 난이도(H/M/L) 판정
- 구현 전략 및 예상 이슈 분석

### 7. Plan 업데이트
```
z_update_plan(
  planId: "PLAN-001",
  status: "ready",
  todos: [
    { description: "현재 의존성 분석", difficulty: "M" },
    { description: "분리 가능한 모듈 식별", difficulty: "H" }
  ],
  content: "## 목표\n- 목표1\n- 목표2\n\n## 구현 전략\n..."
)
```

### 8. 사용자에게 계획 제시
계획서를 제시하고 사용자 검토 대기

## 예시: Answer 기반 Plan 생성

```
사용자: /planning answer-001에 대한 대응책 수립

1. z_get_answer("answer-001")
   → question: "성능 문제 분석해줘"
   → summary: "메모리 누수와 N+1 쿼리 문제 발견"

2. z_create_plan(
     title: "성능 최적화",
     description: "answer-001에서 발견된 성능 문제 해결",
     relatedAnswers: ["answer-001"]
   )
   → PLAN-001 생성, answer-001과 양방향 연결됨

3. z_analyze_difficulty("성능 최적화 메모리 누수 N+1 쿼리")
   → difficulty: H

4. z_search_lessons("성능 메모리 N+1")
   → lesson-003 참조

5. 계획 수립...

6. z_update_plan(planId="PLAN-001", status="ready", todos=[...])

7. 사용자에게 계획 제시:

---
## PLAN-001: 성능 최적화

**난이도**: H | **TODO**: 4개 | **참조**: answer-001

### 배경
answer-001에서 다음 문제가 발견됨:
- 메모리 누수
- N+1 쿼리 문제

### Phase 1: 진단
1. 메모리 프로파일링 실행 (M)
2. 쿼리 로그 분석 (M)

### Phase 2: 수정
3. 메모리 누수 수정 (H)
4. N+1 쿼리 최적화 (H)

📁 계획 저장됨: .z-agent/plans/PLAN-001.md
🔗 연결됨: answer-001

이 계획을 진행하려면: `/task PLAN-001 시작해줘`
---
```

## 응답 형식

```markdown
## PLAN-XXX: {제목}

**난이도**: H/M/L | **TODO**: N개 | **참조**: {관련 Answer/Plan}

### Phase 1: {단계명}
1. {작업} (난이도)
2. {작업} (난이도)

### Phase 2: {단계명}
...

### 예상 이슈
| 이슈 | 영향 | 대응 |
|------|------|------|
| ... | ... | ... |

📁 계획 저장됨: .z-agent/plans/PLAN-XXX.md
🔗 연결됨: {연결된 Answer/Task 목록}

이 계획을 진행하려면: `/task PLAN-XXX 시작해줘`
```

## 주의사항

- **z_* MCP 도구만 사용** (기본 도구 금지)
- 즉시 실행하지 않고 계획만 수립
- Plan 파일로 저장하여 나중에 실행 가능
- 사용자 검토 및 수정 기회 제공
- `.z-agent/`와 `.claude/` 폴더는 프로젝트 분석 시 제외
- **ID 참조 시 해당 엔티티 조회 후 연결 정보 포함**
