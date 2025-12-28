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
- `.claude/commands/` - Claude Code 커스텀 명령어 (`/task`, `/ask`, `/planning`)

### 3. Claude Code 재시작

설정 적용을 위해 Claude Code를 재시작하세요.

### 등록 확인

```bash
claude mcp list
```

## 사용 가능한 도구

MCP 서버가 제공하는 도구들:

| 도구 | 설명 |
|------|------|
| `z_analyze_difficulty` | 입력 난이도 분석 (H/M/L) |
| `z_create_task` | 새 Task 생성 및 TODO 목록 생성 |
| `z_update_todo` | TODO 상태 업데이트 |
| `z_get_task_status` | Task 상태 조회 |
| `z_search_lessons` | 관련 Lesson 검색 |
| `z_record_lesson` | 새 Lesson 기록 |
| `z_get_agent_prompt` | 난이도별 Agent 프롬프트 반환 |
| `z_save_todo_result` | TODO 결과 파일 저장 |
| `z_generate_summary` | Task 요약 생성 |

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
├── lessons/                 # Lessons Learned
│   └── lesson-001.md
├── agents/                  # Agent 프롬프트 참조
├── skills/                  # Skill 정의 참조
├── templates/               # 파일 템플릿
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

## 라이선스

MIT
