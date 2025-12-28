# /task Command

사용자가 작업을 요청할 때 사용하는 z-agent 명령어입니다.

## 실행 시 반드시 수행할 작업

이 명령어가 실행되면 **반드시 z-agent MCP 도구들을 사용**하여 다음 순서로 처리하세요:

### 1. 난이도 분석
```
z_analyze_difficulty 도구 호출
- input: 사용자 입력 전체
- 결과: difficulty (H/M/L), suggestedModel (opus/sonnet/haiku)
```

### 2. 관련 Lesson 검색
```
z_search_lessons 도구 호출
- query: 사용자 입력에서 핵심 키워드
- 결과: 관련 lessons 목록
```

### 3. Task 생성
```
z_create_task 도구 호출
- description: 사용자 입력 요약
- todos: 작업을 분해한 TODO 목록 (각각 difficulty 포함)
- 결과: taskId, filePath
```

### 4. 각 TODO 처리 (순차적으로)
```
for each TODO:
  a. z_update_todo 호출 - status를 "in_progress"로 변경
  b. z_get_agent_prompt 호출 - 난이도에 맞는 프롬프트 획득
  c. Task tool로 해당 모델(opus/sonnet/haiku)에 작업 위임
  d. z_save_todo_result 호출 - 결과 저장
  e. z_update_todo 호출 - status를 "complete"로 변경
```

### 5. 최종 요약 생성
```
z_generate_summary 도구 호출
- taskId: 생성된 Task ID
- 결과를 사용자에게 출력
```

### 6. (선택) Lesson 기록
작업 중 새로운 패턴이나 해결책을 발견했다면:
```
z_record_lesson 도구 호출
- category, problem, solution, tags 포함
```

## 예시

```
사용자: /task 네트워크 병목 현상을 분석하고 해결해줘

1. z_analyze_difficulty(input="네트워크 병목 현상을 분석하고 해결해줘")
   → difficulty: H, suggestedModel: opus

2. z_search_lessons(query="네트워크 병목 성능")
   → [lesson-001: 동기 I/O 병목 해결]

3. z_create_task(description="네트워크 병목 현상 분석 및 해결", todos=[...])
   → taskId: task-001

4. TODO 순차 처리...

5. z_generate_summary(taskId="task-001")
   → 최종 요약 출력
```

## 주의사항

- **반드시 z_* MCP 도구들을 사용**하세요
- 세션 컨텍스트 최소화: 상세 내용은 파일에 저장, 요약만 출력
- 에러 발생 시 사용자에게 선택지 제공
- **`.z-agent/`와 `.claude/` 폴더는 z-agent 시스템 폴더이므로 프로젝트 분석 시 제외**
