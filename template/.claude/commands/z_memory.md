# /z_memory Command

프로젝트 메모리를 관리합니다. **z_* 도구만 사용하세요.**

## 개요

메모리는 프로젝트 특기사항, 컨벤션, 중요 정보 등을 저장합니다.
`/task`, `/ask`, `/planning` 실행 시 자동으로 참조됩니다.

## 자연어 명령 처리

사용자의 자연어 입력을 분석하여 적절한 작업을 수행합니다:

### 추가 (Create)
```
"프로젝트에서 tailwind 사용한다고 기억해줘"
"이 프로젝트는 monorepo 구조야"
"API 호출 시 항상 try-catch 써야 해"

→ z_add_memory(content: "...", tags: [...], priority: "medium")
```

### 조회 (Read)
```
"기억하고 있는 거 뭐 있어?"
"메모리 목록 보여줘"
"mem-001 내용 확인해줘"

→ z_list_memories() 또는 z_get_memory(memoryId)
```

### 검색 (Search)
```
"tailwind 관련 메모리 찾아줘"
"API 관련 기억 있어?"

→ z_search_memories(query: "...")
```

### 수정 (Update)
```
"mem-001 내용 수정해줘: ..."
"mem-002 우선순위 high로 변경해줘"

→ z_update_memory(memoryId, updates)
```

### 삭제 (Delete)
```
"mem-001 삭제해줘"
"tailwind 관련 메모리 지워줘"

→ z_delete_memory(memoryId)
```

## 우선순위

- **high**: 항상 참조됨 (프로젝트 핵심 규칙)
- **medium**: 기본값, 관련 작업 시 참조
- **low**: 필요할 때만 참조

## 태그 자동 추출

내용에서 키워드를 자동으로 태그로 추출합니다:
- 기술 스택: react, typescript, tailwind, next.js 등
- 패턴: monorepo, microservice, REST, GraphQL 등
- 도메인: auth, payment, user 등

## 사용 예시

```
사용자: /z_memory 이 프로젝트는 Next.js 14 App Router 사용하고, Tailwind CSS 적용돼 있어

응답:
1. 내용 분석
2. 태그 추출: ["next.js", "app-router", "tailwind"]
3. z_add_memory 호출

→ mem-001 추가됨
  - 내용: "이 프로젝트는 Next.js 14 App Router 사용하고, Tailwind CSS 적용돼 있어"
  - 태그: ["next.js", "app-router", "tailwind"]
  - 우선순위: medium
```

```
사용자: /z_memory 메모리 목록

→ z_list_memories() 호출
→ 저장된 메모리 목록 표시
```

## 허용된 도구

- ✅ z_add_memory
- ✅ z_get_memory
- ✅ z_list_memories
- ✅ z_search_memories
- ✅ z_update_memory
- ✅ z_delete_memory

## 주의사항

- 자연어로 요청을 분석하여 적절한 CRUD 작업 수행
- 내용에서 관련 태그 자동 추출
- 중요한 정보는 priority를 "high"로 설정 권장
- 메모리는 .z-agent/memory/ 폴더에 저장됨
