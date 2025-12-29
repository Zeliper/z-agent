# /ask Command

질문에 답변하고 저장합니다. **z_* 도구만 사용하세요.**

## 흐름

0. **`z_list_memories()`** - 프로젝트 Memory 조회 (필수 - 가장 먼저!)
   - 프로젝트 컨벤션, 특기사항 확인
   - priority: high 항목은 답변에 반영
1. `z_search_lessons(query: "키워드")` - 관련 lesson 검색
2. 필요시 `z_list_dir`, `z_glob`, `z_read_file`로 코드 탐색
3. 답변 작성 후 **Context 절약 방식으로 저장**

## Context 절약 방식 (권장)

긴 답변은 반드시 이 방식으로 저장하세요:

```
# 1. 먼저 답변을 파일에 저장
Write(.z-agent/temp/answer_draft.md, "전체 답변 내용...")

# 2. 파일 경로로 z_save_answer 호출
z_save_answer(
  question: "원래 질문",
  answer_file_path: ".z-agent/temp/answer_draft.md",
  summary: "1-2문장 요약",
  relatedLessons: ["lesson-001"],   // 선택
  relatedFiles: ["src/main.ts"],    // 선택
  relatedPlans: ["PLAN-001"],       // 선택
  relatedTasks: ["task-001"]        // 선택
)
```

**왜?** answer 파라미터에 긴 텍스트를 넣으면 tool_use 메시지에 포함되어 Context를 소모합니다.
파일 경로만 전달하면 Context가 절약됩니다.

## 상호 참조 기능

### 이전 답변 참조
```
z_get_answer(answerId: "answer-001")
→ 해당 Answer의 전체 내용과 관련 항목 조회
```

### Answer를 Plan/Task와 연결
```
z_link_answer_to_plan(answerId: "answer-001", planId: "PLAN-001")
z_link_answer_to_task(answerId: "answer-001", taskId: "task-001")
```

### 관련 항목 조회
```
z_get_related(entityType: "answer", entityId: "answer-001")
→ 연결된 Plans, Tasks, Lessons 목록
```

## 허용된 도구

- ✅ z_list_memories (Memory 목록 조회 - 필수!)
- ✅ z_search_memories (Memory 검색)
- ✅ z_search_lessons
- ✅ z_list_dir
- ✅ z_glob
- ✅ z_read_file
- ✅ z_save_answer
- ✅ z_get_answer
- ✅ z_list_answers
- ✅ z_link_answer_to_plan
- ✅ z_link_answer_to_task
- ✅ z_get_related
- ✅ z_query

## 규칙

- Task, Glob, Grep, Read 도구 **금지** (z_* 버전 사용)
- **⚠️ 반드시 z_list_memories()로 시작** (프로젝트 컨텍스트 확인)
- 반드시 z_save_answer로 저장 (context 절약)
- **긴 답변은 반드시 answer_file_path 방식 사용**
- 요약만 세션에 남김
