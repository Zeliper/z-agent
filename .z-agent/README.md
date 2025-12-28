# z-agent

Claude Code를 이용한 세션 컨텍스트 유지, 작업 흐름 관리, Lessons Learned 시스템

## 개요

z-agent는 Claude Code 세션에서:
- **컨텍스트 사용량 최소화**: 상세 내용은 파일에 저장, 세션에는 요약만
- **작업 흐름 관리**: Task → TODO → 결과 보고의 체계적 관리
- **지속적 개선**: Lessons Learned를 통한 학습 축적

## 폴더 구조

```
.z-agent/
├── config.yaml              # 전역 설정
├── README.md                # 이 파일
├── tasks/                   # Task 정의 파일
│   └── task-NNN.md
├── task-NNN/               # Task별 상세 결과
│   └── todo-NNN.md
├── lessons/                 # Lessons Learned 저장소
│   └── lesson-NNN.md
├── agents/                  # Agent 프롬프트
│   ├── session-manager.md
│   ├── opus-agent.md
│   ├── sonnet-agent.md
│   └── haiku-agent.md
├── skills/                  # Skill 정의
│   ├── task-initializer.md
│   ├── difficulty-analyzer.md
│   └── lesson-recorder.md
├── templates/               # 파일 템플릿
│   ├── task-template.md
│   ├── todo-result-template.md
│   └── lesson-template.md
└── scripts/
    └── task-manager.py      # Task 관리 CLI
```

## 명령어

| 명령어 | 설명 |
|--------|------|
| `/task <설명>` | 작업 지시 |
| `/ask <질문>` | 질문하기 |
| `/planning <계획>` | 작업 계획 수립 |

## Agent 구조

| Agent | 모델 | 용도 |
|-------|------|------|
| session-manager | Sonnet | 흐름 제어, 작업 관리 |
| opus-agent | Opus | 복잡한 코드, 고급 논리 |
| sonnet-agent | Sonnet | 에러 분석, 일반 작업 |
| haiku-agent | Haiku | 검색, 간단한 작업 |

## 난이도 분류

| 난이도 | Agent | 예시 |
|--------|-------|------|
| H (High) | Opus | 아키텍처 설계, 복잡한 버그 수정 |
| M (Medium) | Sonnet | 에러 분석, 코드 리뷰 |
| L (Low) | Haiku | 파일 검색, 커밋 메시지 |

## Task 상태

| 이모지 | 상태 | 설명 |
|--------|------|------|
| ⏳ | pending | 대기 중 |
| 🔄 | in_progress | 진행 중 |
| ✅ | complete | 완료 |
| ❌ | cancelled | 취소 |
| 🚫 | blocked | 차단됨 |

## task-manager.py 사용법

```bash
# TODO 상태 변경
python task-manager.py task-001 1 complete
python task-manager.py task-001 2 cancel

# Task 목록 조회
python task-manager.py list

# 새 Task 생성
python task-manager.py create "작업 설명" -d H

# Task 상태 확인
python task-manager.py check task-001
```

## 에러 처리

| 에러 유형 | 자동 재시도 | 대응 |
|-----------|-------------|------|
| timeout | 3회 | 시간 증가 후 재시도 |
| permission | X | 즉시 사용자 확인 |
| dependency | 1회 | 의존성 설치 시도 |
| unknown | 2회 | 상위 모델로 위임 |

## 크로스 플랫폼

- Windows와 Linux/macOS 모두 지원
- 경로: `pathlib.Path` 사용
- 파일 I/O: `encoding='utf-8', newline=''`
- Python: `auto` 설정으로 자동 감지

## 설정

`config.yaml`에서 다음 설정 변경 가능:
- Agent별 모델 선택
- 에러 재시도 횟수
- Lessons 자동 검색/기록
- 출력 언어 및 상세도
