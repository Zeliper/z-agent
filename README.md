# z-agent

Claude Code를 위한 MCP 서버 - 세션 컨텍스트 관리, 작업 흐름 관리, Lessons Learned 시스템

## 빠른 설치

### 1. MCP 서버 등록

```bash
claude mcp add z-agent -- npx -y github:Zeliper/z-agent serve
```

### 2. 프로젝트에 템플릿 설치

```bash
npx -y github:Zeliper/z-agent init
```

이 명령어는 다음을 설치합니다:
- `.z-agent/` - 설정, 템플릿, 스크립트
- `.claude/commands/` - Claude Code 커스텀 명령어 (`/task`, `/ask`, `/planning`, `/list`)

### 3. Claude Code 재시작

설정 적용을 위해 Claude Code를 재시작하세요.

### 등록 확인

```bash
claude mcp list
```

## 커스텀 명령어

| 명령어 | 설명 |
|--------|------|
| `/task` | Task 기반 작업 실행 - 난이도 분석 후 적절한 모델에 위임 |
| `/ask` | 질문 및 답변 저장 - 나중에 참조 가능 |
| `/planning` | 계획 수립 - Answer를 참조하여 Plan 생성 |
| `/list` | Task, Plan, Lesson, Answer 통합 조회 |
| `/clear_task` | 완료된 Task, Plan 등 정리 - 자연어로 정리 대상 지정 |

## 사용 가능한 도구

### 핵심 도구

| 도구 | 설명 |
|------|------|
| `z_analyze_difficulty` | 입력 난이도 분석 (H/M/L) |
| `z_create_task` | 새 Task 생성 및 TODO 목록 생성 |
| `z_update_todo` | TODO 상태 업데이트 |
| `z_get_task_status` | Task 상태 조회 |
| `z_get_agent_prompt` | 난이도별 Agent 프롬프트 반환 |
| `z_save_todo_result` | TODO 결과 파일 저장 |
| `z_generate_summary` | Task 요약 생성 |

### Lesson 관리

| 도구 | 설명 |
|------|------|
| `z_search_lessons` | 관련 Lesson 검색 |
| `z_record_lesson` | 새 Lesson 기록 |
| `z_list_lessons` | Lesson 목록 조회 |

### Plan 관리

| 도구 | 설명 |
|------|------|
| `z_create_plan` | 새 Plan 생성 |
| `z_update_plan` | Plan 내용 업데이트 |
| `z_get_plan` | Plan 조회 |
| `z_list_plans` | Plan 목록 조회 |
| `z_link_plan_to_task` | Plan과 Task 연결 |

### Answer 관리

| 도구 | 설명 |
|------|------|
| `z_save_answer` | 질문에 대한 답변 저장 |
| `z_get_answer` | 답변 상세 조회 |
| `z_list_answers` | 답변 목록 조회 |
| `z_link_answer_to_plan` | Answer와 Plan 연결 |
| `z_link_answer_to_task` | Answer와 Task 연결 |

### 통합 검색 및 관계 조회

| 도구 | 설명 |
|------|------|
| `z_query` | Task, Plan, Lesson, Answer 통합 검색 |
| `z_get_related` | 특정 엔티티와 연결된 항목 조회 |
| `z_list_tasks` | Task 목록 조회 |

### 정리 도구

| 도구 | 설명 |
|------|------|
| `z_cleanup_preview` | 정리 대상 미리보기 |
| `z_get_tasks_by_status` | 상태별 Task 조회 (TODO 진행률 포함) |
| `z_get_plans_by_status` | 상태별 Plan 조회 (미완료 Task 경고) |
| `z_delete_task` | Task 및 관련 TODO 파일 삭제 |
| `z_delete_plan` | Plan 삭제 (연결된 Task 함께 삭제 옵션) |
| `z_delete_answer` | Answer 삭제 |
| `z_delete_lesson` | Lesson 삭제 |
| `z_delete_completed_tasks` | 완료된 Task 일괄 삭제 |

### 파일 시스템 (Context 절약)

| 도구 | 설명 |
|------|------|
| `z_write_file` | 파일 생성 (간결한 결과만 반환) |
| `z_edit_file` | 파일 수정 (간결한 결과만 반환) |
| `z_read_file` | 파일 읽기 |
| `z_list_dir` | 디렉토리 조회 (시스템 폴더 자동 제외) |
| `z_glob` | 패턴으로 파일 검색 |

## 워크플로우 예시

### /task 명령어 처리 흐름

```
1. z_analyze_difficulty로 난이도 분석
2. z_search_lessons로 관련 Lesson 검색
3. z_create_task로 Task 생성
4. 각 TODO에 대해:
   a. z_update_todo로 상태를 in_progress로 변경
   b. z_get_agent_prompt로 적절한 모델 프롬프트 획득
   c. Task tool로 해당 모델에 작업 위임
   d. z_save_todo_result로 결과 저장
   e. z_update_todo로 상태를 complete로 변경
5. z_generate_summary로 최종 요약 생성
6. (선택) z_record_lesson으로 Lesson 기록
```

### /ask → /planning → /task 흐름

```
1. /ask: 질문에 대한 답변 조사 및 저장
   - z_save_answer로 결과 저장

2. /planning: Answer를 참조하여 계획 수립
   - z_create_plan으로 Plan 생성
   - z_link_answer_to_plan으로 연결

3. /task: Plan을 기반으로 작업 실행
   - z_link_plan_to_task로 연결
```

## 난이도별 모델 매핑

| 난이도 | 모델 | 용도 |
|--------|------|------|
| **H** | Opus | 아키텍처 설계, 복잡한 코드, 고급 디버깅 |
| **M** | Sonnet | 에러 분석, 코드 리뷰, 테스트 작성 |
| **L** | Haiku | 파일 검색, 커밋 메시지, 간단한 조회 |

## 폴더 구조

```
.z-agent/
├── config.yaml              # 전역 설정
├── tasks/                   # Task 파일
│   └── task-001.md
├── task-001/                # Task별 결과
│   └── todo-001.md
├── plans/                   # Plan 파일
│   └── PLAN-001.md
├── answers/                 # Answer 파일
│   └── answer-001.md
├── lessons/                 # Lessons Learned
│   └── lesson-001.md
├── agents/                  # Agent 프롬프트 참조
├── skills/                  # Skill 정의 참조
├── templates/               # 파일 템플릿
├── temp/                    # 임시 파일 (draft 등)
└── scripts/
    └── task-manager.py      # CLI 도구
```

## Task 상태

| 이모지 | 상태 |
|--------|------|
| ⏳ | pending |
| 🔄 | in_progress |
| ✅ | complete |
| ❌ | cancelled |
| 🚫 | blocked |

## 개발

```bash
git clone https://github.com/Zeliper/z-agent.git
cd z-agent
npm install
npm run build
```

## 요구사항

- Node.js >= 18.0.0
- Claude Code CLI

## 라이선스

MIT
