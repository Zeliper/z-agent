# Difficulty Analyzer Skill

## Description
사용자 입력의 난이도를 분석하여 H(High), M(Medium), L(Low)로 분류합니다.
이 분류에 따라 적절한 Agent(opus/sonnet/haiku)가 작업을 담당합니다.

## Trigger
- 모든 사용자 입력 시 자동 실행
- `session-manager`의 첫 번째 처리 단계

## Model
- Haiku (빠르고 비용 효율적)

## Input
```yaml
userInput: string   # 사용자 입력 원문
context: string     # 현재 세션 컨텍스트 (optional)
```

## Difficulty Criteria

### H (High) - Opus Agent
복잡한 작업으로 고급 논리와 깊은 이해가 필요한 경우

**해당 키워드/패턴:**
- 코드 작성, 구현, 개발
- 아키텍처 설계, 리팩토링
- 복잡한 버그 수정, 디버깅
- 성능 최적화, 병목 분석
- 보안 취약점 분석
- 다중 파일/모듈 변경
- 알고리즘 설계
- 시스템 통합

**예시:**
- "인증 시스템을 JWT로 전환해줘"
- "메모리 누수를 찾아서 해결해줘"
- "마이크로서비스 아키텍처로 리팩토링해줘"

### M (Medium) - Sonnet Agent
일반적인 작업으로 표준적인 판단과 처리가 필요한 경우

**해당 키워드/패턴:**
- 에러 로그 분석, 확인
- 일반적인 질문 답변
- 코드 리뷰, 설명
- 단일 파일 수정
- 설정 변경
- 테스트 작성
- 문서화

**예시:**
- "이 에러 로그가 무슨 의미야?"
- "이 함수가 어떻게 동작하는지 설명해줘"
- "단위 테스트 추가해줘"

### L (Low) - Haiku Agent
간단한 작업으로 빠른 처리가 가능한 경우

**해당 키워드/패턴:**
- 웹 검색, 정보 조회
- 파일 검색, 찾기
- 커밋 메시지 생성
- 간단한 번역
- 포맷팅, 정리
- 단순 질문

**예시:**
- "React 18 새로운 기능 검색해줘"
- "config 파일 어디있어?"
- "이 변경사항 커밋 메시지 작성해줘"

## Process

```
1. 사용자 입력 전처리
   - 언어 감지
   - 핵심 키워드 추출
   - 명령 유형 분류 (task/ask/planning)

2. 복잡도 요소 분석
   - 코드 작성 필요 여부
   - 예상 변경 파일 수
   - 논리적 복잡도
   - 도메인 지식 요구 수준

3. 난이도 점수 계산
   - 각 요소별 가중치 적용
   - 총점 기준 H/M/L 분류

4. 결과 반환
```

## Output
```yaml
difficulty: H|M|L
confidence: 0.0-1.0
reasoning: string           # 판단 근거 (1줄)
suggestedAgent: opus|sonnet|haiku
keywords:
  - keyword1
  - keyword2
estimatedComplexity:
  codeWriting: boolean
  fileCount: number
  logicDepth: high|medium|low
```

## Scoring Matrix

| 요소 | H (3점) | M (2점) | L (1점) |
|------|---------|---------|---------|
| 코드 작성 | 새 기능/모듈 | 수정/추가 | 없음 |
| 파일 수 | 5개+ | 2-4개 | 1개 |
| 논리 복잡도 | 알고리즘/설계 | 조건/분기 | 단순 작업 |
| 도메인 지식 | 전문 지식 | 일반 지식 | 불필요 |

**분류 기준:**
- 총점 10+ → H
- 총점 6-9 → M
- 총점 5 이하 → L

## Example

### Input
```
사용자: 네트워크 병목 현상을 분석하고 해결해줘
```

### Output
```yaml
difficulty: H
confidence: 0.92
reasoning: "성능 분석 및 코드 최적화 필요 - 고급 디버깅 작업"
suggestedAgent: opus
keywords:
  - 병목
  - 분석
  - 해결
  - 네트워크
estimatedComplexity:
  codeWriting: true
  fileCount: 3
  logicDepth: high
```

## Edge Cases
- 불명확한 입력: M으로 기본 설정, session-manager가 추가 질문
- 복합 작업: 가장 높은 난이도 기준
- 컨텍스트 의존: 이전 대화 참조 시 난이도 재평가
