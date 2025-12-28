# /task Command

사용자가 작업을 요청할 때 사용하는 z-agent 명령어입니다.

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

## 실행 흐름

### 1. 난이도 분석
```
z_analyze_difficulty(input: "사용자 입력")
→ difficulty: H/M/L
→ suggestedModel: opus/sonnet/haiku
```

### 2. 관련 Lesson 검색
```
z_search_lessons(query: "핵심 키워드")
→ 관련 lessons 참조
```

### 3. Task 생성
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

### 4. 각 TODO 처리
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

### 5. 최종 요약
```
z_generate_summary(taskId)
→ 간결한 요약만 출력 (context 절약)
```

### 6. Lesson 기록 (선택)
```
z_record_lesson(category, problem, solution, tags)
→ 새로운 패턴/해결책 발견 시
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

## 예시

```
사용자: /task 버그 수정해줘

1. z_analyze_difficulty("버그 수정해줘")
   → difficulty: M

2. z_search_lessons("버그 디버깅")
   → lesson-002 참조

3. z_create_task("버그 수정", todos=[...])
   → task-001

4. z_list_dir("src", recursive=true)
   → 파일 구조 파악

5. z_read_file("src/buggy.ts")
   → 코드 분석

6. z_edit_file("src/buggy.ts", "old", "new")
   → ✅ 수정 완료

7. z_save_todo_result(...)
8. z_generate_summary("task-001")
```

## 주의사항

- **z_* MCP 도구만 사용** (기본 도구 금지)
- 세션 컨텍스트 최소화: 상세 내용은 파일에 저장
- 에러 발생 시 사용자에게 선택지 제공
- `.z-agent/`와 `.claude/` 폴더는 프로젝트 분석 시 제외
