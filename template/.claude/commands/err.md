# /err Command

사용자가 에러 로그나 자연어로 문제를 설명하면, 분석 후 Task를 생성하여 에러를 수정하고 Lesson을 자동 생성하는 명령어입니다.

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
- ✅ z_list_tasks
- ✅ z_list_lessons
- ✅ z_query
- ✅ Bash tool (검증용 명령어 실행)

## 사용법

사용자가 에러 로그를 붙여넣거나 자연어로 문제를 설명합니다:

```
/err
error TS2322: Type 'string' is not assignable to type 'number'.
  src/utils.ts:15:3
```

```
/err 빌드하면 타입 에러가 나와. utils.ts에서 반환 타입이 안 맞는다고 함
```

```
/err
FAIL src/api.test.ts
  ● fetchData › should return data
    Expected: 200
    Received: undefined
```

```
/err 테스트가 계속 실패해. fetchData 함수에서 undefined가 반환됨
```

## 실행 흐름

### 1. 에러 분석

사용자가 제공한 에러 로그 또는 자연어 설명을 분석합니다:
- 에러 타입 파악 (타입 에러, 런타임 에러, 테스트 실패 등)
- 관련 파일 및 라인 추출
- 에러의 근본 원인 추론

### 2. 관련 Lesson 검색 (필수)

```
z_search_lessons(query: "에러 메시지 핵심 키워드")
→ 기존에 유사한 에러를 해결한 경험이 있는지 확인
→ 있다면 해당 Lesson의 solution 참조하여 빠르게 해결
```

**Lesson이 발견된 경우:**
```
💡 관련 Lesson 발견: lesson-001
이전 해결 방법: [solution 내용 요약]
→ 해당 방법 적용하여 빠르게 해결 시도
```

### 3. 난이도 분석

```
z_analyze_difficulty(input: "에러 내용 + 분석 결과")
→ difficulty: H/M/L
```

### 4. Task 생성

```
z_create_task(
  description: "[Error Fix] 에러 요약",
  todos: [
    { description: "에러 1 수정: 파일명:라인 - 원인", difficulty: "M" },
    { description: "에러 2 수정: 파일명:라인 - 원인", difficulty: "M" },
    ...
  ]
)
→ taskId, filePath
```

**TODO 생성 규칙:**
- 각 에러당 하나의 TODO 생성
- 같은 원인의 에러들은 하나의 TODO로 묶음
- description에 파일명, 라인, 원인 포함

### 5. TODO 순차 처리

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

### 6. 결과 보고

```
z_generate_summary(taskId)
→ 수정 내용 요약 출력
```

**출력 형식:**
```
## Task [task-001] 완료

### 요약
[에러 수정 내용 요약]

### 완료 항목
- ✅ TODO #1: [수정 내용]
- ✅ TODO #2: [수정 내용]

### 변경된 파일
- src/utils.ts:15 - 반환 타입 수정
- src/api.ts:42 - null 체크 추가
```

### 7. Lesson 자동 생성 (필수)

**에러 수정 완료 후 반드시 Lesson을 생성합니다:**

```
z_record_lesson(
  category: "debugging",  # 또는 적절한 카테고리
  problem: "에러 상황 설명 (에러 메시지 포함)",
  solution: "해결 방법 (수정한 내용)",
  tags: ["error-type", "관련-기술", "파일명"],
  relatedTasks: ["task-XXX"]
)
```

**카테고리 선택 가이드:**
- `debugging`: 런타임 에러, 버그 수정, 테스트 실패
- `best-practice`: 린트 에러, 코드 스타일
- `performance`: 성능 관련 경고/에러
- `security`: 보안 관련 에러
- `architecture`: 구조적 문제로 인한 에러

## 예시 1: TypeScript 타입 에러

```
사용자: /err
error TS2322: Type 'string' is not assignable to type 'number'.
  src/utils.ts:15:3

1. 에러 분석
   → TypeScript 타입 에러
   → src/utils.ts:15에서 string을 number 타입에 할당 시도
   → 함수 반환 타입과 실제 반환값 불일치 가능성

2. z_search_lessons(query: "TypeScript TS2322 type string number")
   → 관련 Lesson 없음

3. z_analyze_difficulty(input: "TypeScript 타입 에러 1개")
   → difficulty: M

4. z_create_task(
     description: "[Error Fix] TypeScript TS2322 타입 에러 수정",
     todos: [
       { description: "src/utils.ts:15 - Type 'string' is not assignable to type 'number' 수정", difficulty: "M" }
     ]
   )
   → task-001

5. TODO 처리
   → calculateTotal 함수의 반환 타입을 number → string으로 수정

6. z_generate_summary("task-001")

## Task [task-001] 완료

### 요약
TypeScript 타입 에러 수정 - calculateTotal 함수 반환 타입 수정

### 변경된 파일
- src/utils.ts:15 - 반환 타입 number → string

7. z_record_lesson(
     category: "debugging",
     problem: "TypeScript TS2322 에러 - Type 'string' is not assignable to type 'number'. calculateTotal 함수가 실제로는 문자열을 반환하는데 반환 타입이 number로 선언됨",
     solution: "함수의 실제 반환값을 확인하고 반환 타입을 일치시킴. 이 경우 반환 타입을 string으로 변경",
     tags: ["typescript", "type-error", "TS2322", "return-type"],
     relatedTasks: ["task-001"]
   )
   → lesson-001 생성

### Lesson 생성됨
📝 lesson-001: TypeScript TS2322 타입 에러 해결
```

## 예시 2: 자연어 설명

```
사용자: /err 테스트가 실패해. API 호출 결과가 undefined로 나옴

1. 에러 분석
   → 테스트 실패
   → API 호출 함수가 undefined 반환
   → 비동기 처리 또는 반환문 누락 가능성

2. z_search_lessons(query: "테스트 실패 API undefined 반환")
   → lesson-003 발견: "async 함수에서 await 누락으로 인한 undefined 반환"

   💡 관련 Lesson 발견: lesson-003
   이전 해결 방법: async 함수 호출 시 await 키워드 확인

3. z_analyze_difficulty(input: "테스트 실패, 기존 유사 경험 있음")
   → difficulty: L

4. z_create_task(
     description: "[Error Fix] API 호출 undefined 반환 문제 수정",
     todos: [
       { description: "API 호출 함수 확인 - await 누락 또는 반환문 확인 (lesson-003 참조)", difficulty: "L" }
     ]
   )

5. TODO 처리
   → fetchData 호출 시 await 누락 확인, 추가

6. z_generate_summary("task-002")

7. z_record_lesson(
     category: "debugging",
     problem: "테스트에서 API 호출 결과가 undefined - fetchData 함수 호출 시 await 누락",
     solution: "async 함수 호출 시 await 키워드 추가. IDE의 async/await 린트 규칙 활성화 권장",
     tags: ["async", "await", "undefined", "test-failure"],
     relatedTasks: ["task-002"]
   )
```

## 예시 3: 기존 Lesson으로 빠른 해결

```
사용자: /err 빌드 에러 - Cannot find module 'lodash'

1. 에러 분석
   → 모듈 찾을 수 없음 에러
   → lodash 패키지 미설치 또는 경로 문제

2. z_search_lessons(query: "Cannot find module 패키지")
   → lesson-010 발견: "모듈 설치 누락 에러 해결"
   → solution: "npm install 또는 package.json 확인"

   💡 관련 Lesson 발견: lesson-010
   이전 해결 방법: npm install로 누락된 패키지 설치

3. 빠른 해결 (Task 생성 없이 바로 해결 가능한 경우)
   → npm install lodash 실행
   → 해결 확인

4. 새로운 인사이트가 있으면 Lesson 추가
   (동일한 해결 방법이면 Lesson 생성 생략 가능)
```

## 주의사항

- **z_* MCP 도구만 사용** (기본 도구 금지, Bash 제외)
- **Lesson 검색 필수**: 작업 시작 전 반드시 z_search_lessons 호출
- **Lesson 생성 필수**: 에러 수정 완료 후 반드시 z_record_lesson 호출
- 기존 Lesson 검색으로 빠른 해결 시도
- 같은 원인의 에러는 하나의 TODO로 묶어서 효율적 처리
- `.z-agent/`와 `.claude/` 폴더는 분석에서 제외
