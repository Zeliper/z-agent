# /ask Command

사용자가 질문을 할 때 사용하는 z-agent 명령어입니다.

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
- ✅ z_list_dir
- ✅ z_glob
- ✅ z_read_file
- ✅ z_save_answer (필수 - 답변 저장용)

## 실행 흐름

### 1. 난이도 분석
```
z_analyze_difficulty(input: "사용자 질문")
→ difficulty: H/M/L
→ 답변 깊이 결정
```

### 2. 관련 Lesson 검색
```
z_search_lessons(query: "핵심 키워드")
→ 관련 lesson 참조
```

### 3. 프로젝트 탐색 (필요시)
```
z_list_dir(dirPath: ".", recursive: true)
→ 프로젝트 구조 파악

z_glob(pattern: "**/*.ts")
→ 특정 파일 검색

z_read_file(filePath: "src/main.ts")
→ 파일 내용 확인
```

### 4. 답변 저장 (필수!)
```
z_save_answer(
  question: "원래 질문",
  answer: "전체 답변 내용",
  summary: "1-2문장 요약",
  relatedLessons: ["lesson-001"],
  relatedFiles: ["src/main.ts"]
)
→ 파일로 저장, 요약만 context에 남김
```

## 예시

```
사용자: /ask 이 프로젝트 구조를 설명해줘

1. z_analyze_difficulty(input="이 프로젝트 구조를 설명해줘")
   → difficulty: M

2. z_search_lessons(query="프로젝트 구조")
   → lessons 참조

3. z_list_dir(dirPath=".", recursive=true)
   → 프로젝트 파일 목록

4. z_read_file(filePath="package.json")
   → 프로젝트 정보

5. z_save_answer(
     question="이 프로젝트 구조를 설명해줘",
     answer="이 프로젝트는 TypeScript로 작성된 MCP 서버입니다...(상세 내용)",
     summary="TypeScript 기반 MCP 서버로, src/에 핵심 코드가 있고 template/에 사용자 템플릿이 위치함",
     relatedFiles=["package.json", "src/index.ts"]
   )
   → 요약만 사용자에게 표시
```

## 응답 형식

z_save_answer가 반환하는 형식 그대로 출력:

```markdown
## 답변 요약

{1-2문장 요약}

📁 상세 내용: .z-agent/answers/answer-XXX.md
```

## 주의사항

- **z_* MCP 도구만 사용** (Explore, Glob, Grep, Read 금지)
- **반드시 z_save_answer로 답변 저장** (context 절약)
- Task 파일을 생성하지 않음 (단순 Q&A)
- `.z-agent/`와 `.claude/` 폴더는 프로젝트 설명 시 제외
- 복잡한 질문은 상세하게, 간단한 질문은 간결하게
- 답변의 상세 내용은 파일에, 요약만 세션에 남김
