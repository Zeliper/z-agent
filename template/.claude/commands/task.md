# /task Command

사용자가 작업을 요청할 때 사용하는 z-agent 명령어입니다.

## 사용법
```
/task <작업 설명>
```

## 예시
```
/task 네트워크 병목 현상을 분석하고 해결해줘
/task 사용자 인증 기능을 JWT로 구현해줘
/task 이 코드의 성능을 최적화해줘
```

## 처리 흐름

1. **난이도 분석** (Haiku)
   - 사용자 입력을 분석하여 H/M/L 난이도 판정
   - `.z-agent/skills/difficulty-analyzer.md` 참조

2. **Task 초기화**
   - 새 Task 파일 생성 (`.z-agent/tasks/task-NNN.md`)
   - TODO 목록 자동 생성
   - 관련 Lessons 검색 및 첨부
   - `.z-agent/skills/task-initializer.md` 참조

3. **작업 수행** (Session Manager)
   - 각 TODO를 순차적으로 처리
   - 난이도에 따른 적절한 Agent 선택
   - 진행 상황 모니터링
   - `.z-agent/agents/session-manager.md` 참조

4. **결과 보고**
   - 간결한 요약 세션에 출력
   - 상세 내용은 파일에 저장
   - Lesson 기록 여부 판단

## 실행 시 동작

이 명령어가 실행되면 다음을 수행하세요:

1. 사용자 입력을 분석하여 난이도를 판정합니다.
2. `.z-agent/tasks/` 폴더에 새 Task 파일을 생성합니다.
3. 작업을 논리적 단계로 분해하여 TODO 목록을 만듭니다.
4. 각 TODO를 순차적으로 처리합니다.
5. 모든 작업 완료 후 결과를 요약하여 보고합니다.

## 주의사항

- 세션 컨텍스트 최소화를 위해 상세 내용은 파일에 저장
- 에러 발생 시 사용자에게 선택지 제공
- 크로스 플랫폼 호환성 유지 (Windows/Linux)
