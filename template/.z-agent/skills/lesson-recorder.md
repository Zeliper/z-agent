# Lesson Recorder Skill

## Description
Lessons Learned를 기록하고 관리하는 Skill입니다.
Task 완료 후 학습 내용을 저장하고, 새 Task 시작 시 관련 Lesson을 검색합니다.

## Trigger
- Task 완료 후 자동 실행 (config.lessons.autoRecord가 true인 경우)
- session-manager의 명시적 호출
- 사용자가 `/lesson` 명령어 사용 시

## Functions

### 1. Record Lesson (기록)
Task에서 학습한 내용을 새로운 Lesson 파일로 저장

### 2. Search Lessons (검색)
새 Task와 관련된 기존 Lesson 검색

### 3. Update Lesson (갱신)
기존 Lesson에 새로운 정보 추가

---

## Record Lesson

### Input
```yaml
taskId: string              # 관련 Task ID
category: string            # performance|security|architecture|debugging|best-practice
problem: string             # 문제 상황 설명
solution: string            # 해결 방안
conditions: list            # 적용 조건
cautions: list              # 주의 사항
tags: list                  # 검색용 태그
```

### Process
```
1. Lesson ID 생성
   - .z-agent/lessons/ 폴더에서 최대 번호 확인
   - lesson-{NNN}.md 형식으로 생성

2. Task 정보 수집
   - task 파일에서 작업 내용 추출
   - todo 결과 파일에서 상세 내용 추출

3. Lesson 패턴 분석
   - 문제-해결 쌍 식별
   - 재사용 가능한 패턴 추출
   - 적용 조건 정리

4. Lesson 파일 생성
```

### Output Template
```yaml
---
lessonId: lesson-{NNN}
createdAt: {ISO 8601}
updatedAt: {ISO 8601}
relatedTasks:
  - task-001
  - task-003
category: performance
tags:
  - async
  - io
  - bottleneck
useCount: 0
lastUsed: null
---

# 문제 상황
{문제 설명 - 구체적인 증상과 컨텍스트}

# 해결 방안
{해결 방법 - 단계별 설명}
- 첫 번째 단계
- 두 번째 단계

# 적용 조건
{이 해결책이 효과적인 조건}
- 조건 1
- 조건 2

# 주의 사항
{적용 시 주의할 점}
- 주의 1
- 주의 2

# 코드 예시 (optional)
```{language}
// 변경 전
...

// 변경 후
...
```

# 참고 자료 (optional)
- [링크 설명](URL)
```

---

## Search Lessons

### Input
```yaml
query: string               # 검색 쿼리 (Task 설명 또는 키워드)
category: string            # 카테고리 필터 (optional)
tags: list                  # 태그 필터 (optional)
limit: number               # 최대 결과 수 (default: 5)
```

### Process
```
1. 검색 전략
   a. 태그 매칭 (가중치: 높음)
   b. 카테고리 매칭 (가중치: 중간)
   c. 텍스트 유사도 (가중치: 낮음)

2. 점수 계산
   - 태그 일치: +3점/개
   - 카테고리 일치: +2점
   - 키워드 일치: +1점/개
   - 최근 사용: +1점

3. 상위 N개 반환
```

### Output
```yaml
results:
  - lessonId: lesson-001
    relevance: 0.85
    category: performance
    summary: "동기 I/O 호출로 인한 병목 해결"
    tags: [async, io, bottleneck]
  - lessonId: lesson-005
    relevance: 0.72
    category: performance
    summary: "버퍼 크기 최적화로 처리량 개선"
    tags: [buffer, io, optimization]
totalFound: 2
searchTime: 45ms
```

---

## Update Lesson

### Input
```yaml
lessonId: string            # 갱신할 Lesson ID
updates:
  relatedTasks: list        # 추가할 관련 Task
  tags: list                # 추가할 태그
  cautions: list            # 추가할 주의사항
  examples: list            # 추가할 예시
```

### Process
```
1. 기존 Lesson 파일 읽기
2. 메타데이터 갱신
   - updatedAt 갱신
   - useCount 증가
   - lastUsed 갱신
   - relatedTasks 병합
3. 내용 병합
   - 중복 제거
   - 새 항목 추가
4. 파일 저장
```

---

## Lesson Categories

| Category | 설명 | 예시 |
|----------|------|------|
| `performance` | 성능 최적화 관련 | 병목 해결, 캐싱, 비동기 처리 |
| `security` | 보안 관련 | 인증, 암호화, 입력 검증 |
| `architecture` | 구조/설계 관련 | 패턴 적용, 모듈화, API 설계 |
| `debugging` | 디버깅/문제해결 | 에러 추적, 로깅, 프로파일링 |
| `best-practice` | 모범 사례 | 코드 스타일, 테스트, 문서화 |

---

## Auto-Recording Criteria

자동 기록 대상 판단 기준:

```yaml
recordIf:
  # 다음 조건 중 하나 이상 만족 시 기록 제안
  - errorFixed: true          # 에러를 수정한 경우
  - performanceImproved: true # 성능이 개선된 경우
  - patternIdentified: true   # 반복 가능한 패턴 발견
  - workaroundApplied: true   # 특수한 해결책 적용
  - newTechUsed: true         # 새로운 기술/도구 사용

skipIf:
  # 다음 조건 시 기록 스킵
  - trivialChange: true       # 사소한 변경
  - duplicatePattern: true    # 이미 유사한 Lesson 존재
  - oneTimeIssue: true        # 일회성 문제
```

---

## Example Usage

### Task 완료 후 Lesson 기록 제안
```
Task [task-001] 완료

Lesson 기록을 추천합니다:
- Category: performance
- Problem: 동기 I/O 호출로 인한 네트워크 병목
- Solution: async/await 패턴 적용 및 버퍼 최적화

기록하시겠습니까? [Y/n]
```

### 새 Task 시작 시 Lesson 검색 결과
```
관련 Lessons 발견:

📚 lesson-001 (관련도: 85%)
   "동기 I/O 호출로 인한 병목 해결"
   Tags: #async #io #bottleneck

📚 lesson-005 (관련도: 72%)
   "버퍼 크기 최적화로 처리량 개선"
   Tags: #buffer #optimization

이 Lessons를 참고하여 작업을 진행합니다.
```

---

## Cross-Platform Notes
- 파일 경로: `pathlib.Path` 사용
- 텍스트 인코딩: UTF-8
- 줄바꿈: `newline=''` 옵션
- 검색: 대소문자 구분 없이 처리
