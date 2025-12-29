# z-agent Development Guide

## Project Overview

z-agent는 Claude Code를 위한 MCP 서버입니다. 세션 컨텍스트 관리, 작업 흐름 관리, Lessons Learned 시스템을 제공합니다.

## 핵심 파일 구조

```
z-agent/
├── src/index.ts          # MCP 서버 메인 코드 (도구 정의 및 구현)
├── bin/z-agent.cjs       # CLI 스크립트 (init, serve 명령어)
├── template/             # 사용자 프로젝트에 복사될 템플릿
│   ├── .z-agent/         # z-agent 설정 및 데이터
│   └── .claude/commands/ # 커스텀 슬래시 커맨드
├── README.md             # 프로젝트 문서
└── package.json          # 패키지 설정
```

## 변경 시 체크리스트

### 새 MCP 도구 추가 시

1. **src/index.ts** 수정:
   - 도구 정의 추가 (tools 배열에 추가)
   - case 문 추가 (switch 문에 추가)
   - 필요한 함수 구현

2. **README.md** 수정:
   - "사용 가능한 도구" 섹션에 새 도구 추가

3. **빌드 확인**:
   ```bash
   npm run build
   ```

### 새 슬래시 커맨드 추가 시

1. **template/.claude/commands/{command}.md** 생성:
   - 커맨드 설명 및 사용법 작성

2. **bin/z-agent.cjs** 수정:
   - init() 함수의 "Available commands" 출력에 추가

3. **README.md** 수정:
   - "커스텀 명령어" 테이블에 추가

### 새 템플릿 파일 추가 시

1. **template/.z-agent/{path}** 에 파일 생성
2. init 스크립트가 자동으로 복사함 (추가 수정 불필요)

## 코딩 규칙

### Windows 호환성

파일을 읽고 정규식으로 파싱할 때 반드시 CRLF 처리:

```typescript
const content = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");
```

### 도구 응답 형식

도구 결과는 간결하게 유지 (context 절약):

```typescript
return {
  content: [{
    type: "text",
    text: JSON.stringify(result, null, 2),
  }],
};
```

### ID 형식

- Task: `task-001`, `task-002`, ...
- Plan: `PLAN-001`, `PLAN-002`, ...
- Answer: `answer-001`, `answer-002`, ...
- Lesson: `lesson-001`, `lesson-002`, ...
- Memory: `mem-001`, `mem-002`, ...

## 테스트

### init 명령어 테스트

```bash
cd /tmp && rm -rf test-dir && mkdir test-dir && cd test-dir
node /path/to/z-agent/bin/z-agent.cjs init
```

### MCP 서버 테스트

```bash
npm run build
node dist/index.js
```

## 커밋 규칙

- feat: 새 기능 추가
- fix: 버그 수정
- docs: 문서 수정
- refactor: 리팩토링

커밋 메시지 끝에 항상 추가:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
