# /ask Command

사용자가 질문을 할 때 사용하는 z-agent 명령어입니다.

## 실행 시 반드시 수행할 작업

이 명령어가 실행되면 **z-agent MCP 도구들을 사용**하여 처리하세요:

### 1. 난이도 분석
```
z_analyze_difficulty 도구 호출
- input: 사용자 질문
- 결과에 따라 적절한 깊이로 답변
  - H: 상세하고 깊이 있는 설명 (Opus 수준)
  - M: 일반적인 설명과 예시 (Sonnet 수준)
  - L: 간단명료한 답변 (Haiku 수준)
```

### 2. 관련 Lesson 검색
```
z_search_lessons 도구 호출
- query: 질문 키워드
- 관련 lesson이 있으면 참조하여 답변 품질 향상
```

### 3. 답변 제공
난이도에 맞는 깊이로 답변 생성

## 예시

```
사용자: /ask 이 에러가 무슨 의미야?

1. z_analyze_difficulty(input="이 에러가 무슨 의미야?")
   → difficulty: M, suggestedModel: sonnet

2. z_search_lessons(query="에러 디버깅")
   → 관련 lesson 확인

3. 에러 분석 및 해결책 제시
```

## 응답 형식

```markdown
## 답변

{질문에 대한 답변}

### 코드 예시 (해당 시)
...

### 참고
- 관련 파일: ...
- 관련 Lesson: lesson-XXX (있는 경우)
```

## 주의사항

- **z_analyze_difficulty, z_search_lessons MCP 도구 사용**
- Task 파일을 생성하지 않음 (단순 Q&A)
- 필요시 코드베이스 참조
- 복잡한 질문은 상세하게, 간단한 질문은 간결하게
- **`.z-agent/`와 `.claude/` 폴더는 z-agent 시스템 폴더이므로 프로젝트 설명 시 제외**
