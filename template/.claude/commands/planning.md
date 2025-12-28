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

## 실행 흐름

### 1. Plan 생성
```
z_create_plan(
  title: "작업 제목",
  description: "사용자 입력"
)
→ planId: PLAN-001
→ filePath: .z-agent/plans/PLAN-001.md
```

### 2. 난이도 분석
```
z_analyze_difficulty(input: "사용자의 계획 요청")
→ difficulty: H/M/L
→ suggestedModel: opus (복잡한 계획은 Opus 사용)
```

### 3. 관련 Lesson 검색
```
z_search_lessons(query: "계획 관련 키워드")
→ 이전 유사 작업에서의 교훈 참조
```

### 4. 프로젝트 분석 (필요시)
```
z_list_dir(dirPath: ".", recursive: true)
z_glob(pattern: "**/*.ts")
z_read_file(filePath: "src/main.ts")
```

### 5. 계획 수립 (Opus 수준 분석)
- 작업을 논리적 Phase와 단계로 분해
- 각 단계별 난이도(H/M/L) 판정
- 구현 전략 및 예상 이슈 분석

### 6. Plan 업데이트
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

### 7. 사용자에게 계획 제시
계획서를 제시하고 사용자 검토 대기

## 예시

```
사용자: /planning 마이크로서비스 아키텍처로 전환

1. z_create_plan(title="마이크로서비스 전환", description="마이크로서비스 아키텍처로 전환")
   → PLAN-001 생성됨

2. z_analyze_difficulty(input="마이크로서비스 아키텍처로 전환")
   → difficulty: H, suggestedModel: opus

3. z_search_lessons(query="마이크로서비스 아키텍처")
   → lesson-005 참조

4. z_list_dir("src", recursive=true)
   → 프로젝트 구조 파악

5. 계획 수립 (Opus 수준 분석)

6. z_update_plan(planId="PLAN-001", status="ready", todos=[...], content="...")
   → 계획 저장됨

7. 사용자에게 계획 제시:

---
## PLAN-001: 마이크로서비스 전환 계획

**난이도**: H | **TODO**: 7개

### Phase 1: 준비
1. 현재 의존성 분석 (M)
2. 분리 가능한 모듈 식별 (H)

### Phase 2: 구현
3. 서비스 분리 (H)
4. API 게이트웨이 설정 (H)
5. 서비스 간 통신 구현 (H)

### Phase 3: 테스트
6. 통합 테스트 (M)
7. 배포 스크립트 작성 (M)

📁 계획 저장됨: .z-agent/plans/PLAN-001.md

이 계획을 진행하려면: `/task PLAN-001 시작해줘`
---
```

## 응답 형식

```markdown
## PLAN-XXX: {제목}

**난이도**: H/M/L | **TODO**: N개

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

이 계획을 진행하려면: `/task PLAN-XXX 시작해줘`
```

## 주의사항

- **z_* MCP 도구만 사용** (기본 도구 금지)
- 즉시 실행하지 않고 계획만 수립
- Plan 파일로 저장하여 나중에 실행 가능
- 사용자 검토 및 수정 기회 제공
- `.z-agent/`와 `.claude/` 폴더는 프로젝트 분석 시 제외
