# /z_lesson Command

Lessons Learned를 관리합니다. **z_* 도구만 사용하세요.**

## 개요

Lesson은 프로젝트에서 배운 교훈, 해결한 문제와 해결책을 기록합니다.
`/task`, `/ask`, `/planning` 실행 시 관련 Lesson을 검색하여 참조합니다.

## 자연어 명령 처리

사용자의 자연어 입력을 분석하여 적절한 작업을 수행합니다:

### 생성 (Create)
```
"Windows에서 이모지 정규식 문제 있었는데 해결했어. alternation 패턴 사용하면 됨"
"API 타임아웃 문제는 retry 로직으로 해결"

→ z_record_lesson(
    category: "debugging" 또는 적절한 카테고리,
    problem: "문제 상황",
    solution: "해결 방안",
    tags: [...]
  )
```

### 조회 (Read)
```
"lesson 목록 보여줘"
"lesson-001 자세히 보여줘"
"debugging 관련 lesson 있어?"

→ z_list_lessons() 또는 z_get_lesson(lessonId)
```

### 검색 (Search)
```
"정규식 관련 lesson 찾아줘"
"Windows 호환성 lesson 있어?"

→ z_search_lessons(query: "...")
```

### 수정 (Update)
```
"lesson-001 해결책 업데이트해줘: ..."
"lesson-002에 주의사항 추가해줘"

→ z_update_lesson(lessonId, updates)
```

### 삭제 (Delete)
```
"lesson-001 삭제해줘"

→ z_delete_lesson(lessonId)
```

## 카테고리

- **performance**: 성능 최적화 관련
- **security**: 보안 관련
- **architecture**: 아키텍처/설계 관련
- **debugging**: 디버깅/문제 해결
- **best-practice**: 모범 사례

## Lesson 구조

```
# 문제 상황
어떤 문제가 발생했는지

# 해결 방안
어떻게 해결했는지

# 적용 조건
언제 이 해결책을 적용해야 하는지

# 주의 사항
적용 시 주의할 점
```

## 사용 예시

```
사용자: /z_lesson Next.js에서 서버 컴포넌트와 클라이언트 컴포넌트 혼용 시 hydration 에러 발생. 'use client' 디렉티브 명확히 분리하고, 서버 컴포넌트에서 클라이언트 컴포넌트로 직렬화 가능한 props만 전달해서 해결

응답:
1. 문제/해결책 분석
2. 카테고리 결정: debugging
3. 태그 추출: ["next.js", "hydration", "server-component", "client-component"]
4. z_record_lesson 호출

→ lesson-001 기록됨
```

```
사용자: /z_lesson debugging 카테고리 목록

→ z_list_lessons(category: "debugging") 호출
→ debugging 카테고리 lesson 목록 표시
```

## 허용된 도구

- ✅ z_record_lesson (Create)
- ✅ z_get_lesson (Read)
- ✅ z_list_lessons (List)
- ✅ z_search_lessons (Search)
- ✅ z_update_lesson (Update)
- ✅ z_delete_lesson (Delete)

## 주의사항

- 자연어로 요청을 분석하여 적절한 CRUD 작업 수행
- 문제와 해결책을 명확히 분리하여 기록
- 관련 태그를 자동으로 추출
- Lesson은 .z-agent/lessons/ 폴더에 저장됨
- `/task`, `/ask`, `/planning` 실행 시 자동으로 관련 Lesson 검색됨
