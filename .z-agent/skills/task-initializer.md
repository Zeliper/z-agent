# Task Initializer Skill

## Description
Task 파일 생성 및 초기화를 담당하는 Skill입니다.
사용자 입력을 받아 새로운 Task 파일을 생성하고 TODO 목록을 구성합니다.

## Trigger
- `/task` 명령어 입력 시
- `session-manager`가 새 Task 생성 요청 시

## Input
```yaml
userInput: string      # 사용자가 입력한 Task 설명
difficulty: H|M|L      # difficulty-analyzer가 분석한 난이도
relatedLessons: list   # 관련 Lessons Learned (optional)
```

## Process

### 1. Task ID 생성
```
- .z-agent/tasks/ 폴더 확인
- 가장 높은 task-NNN.md 번호 확인
- 다음 번호로 새 Task ID 생성 (task-001, task-002, ...)
```

### 2. TODO 목록 분석 및 생성
```
사용자 입력을 분석하여:
1. 작업을 논리적 단계로 분해
2. 각 단계별 난이도 판단 (H/M/L)
3. 의존성 순서 결정
4. TODO 목록 생성
```

### 3. Task 파일 생성
```yaml
---
taskId: task-{NNN}
taskDesc: {사용자 입력 요약}
createdAt: {ISO 8601 형식}
difficulty: {전체 난이도}
status: pending
relatedLessons:
  - lesson-001
  - lesson-003
---
# TODO List
⏳ - 1. {첫 번째 작업} (M)
⏳ - 2. {두 번째 작업} (H)
⏳ - 3. {세 번째 작업} (L)

# Footnote
{사용자 입력 원문 또는 특이사항}
```

### 4. Task 폴더 생성
```
.z-agent/task-{NNN}/ 폴더 생성
- 각 TODO 결과 파일이 저장될 위치
```

## Output
```yaml
taskId: task-001
taskFile: .z-agent/tasks/task-001.md
taskFolder: .z-agent/task-001/
todoCount: 3
status: created
```

## Example

### Input
```
사용자: /task 네트워크 병목 현상을 분석하고 해결해줘
```

### Generated Task File
```yaml
---
taskId: task-001
taskDesc: 네트워크 병목 현상 분석 및 해결
createdAt: 2024-01-15T10:30:00
difficulty: H
status: pending
relatedLessons:
  - lesson-005
---
# TODO List
⏳ - 1. 병목 현상이 발생하는 파일/위치 확인 (M)
⏳ - 2. 병목 원인 분석 (성능 프로파일링) (H)
⏳ - 3. 해결 방안 수립 (H)
⏳ - 4. 해결 방안 적용 (H)
⏳ - 5. 빌드 및 테스트 (L)

# Footnote
사용자가 특정 파일이 아닌 전반적인 분석을 요청함
```

## Error Handling
- Task 폴더 생성 실패 시: 권한 확인 후 재시도
- 기존 Task ID 충돌 시: 다음 번호로 자동 증가
- TODO 분석 실패 시: 기본 단일 TODO로 생성

## Cross-Platform Notes
- 경로는 `pathlib.Path` 사용
- 파일 I/O는 `encoding='utf-8', newline=''` 옵션 사용
