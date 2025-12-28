---
lessonId: lesson-001
createdAt: 2024-01-15T14:00:00
updatedAt: 2024-01-15T14:00:00
relatedTasks: []
category: performance
tags:
  - async
  - io
  - bottleneck
  - nodejs
useCount: 0
lastUsed: null
---

# 문제 상황
동기 I/O 호출(fs.readFileSync, fs.writeFileSync 등)로 인해 Node.js 이벤트 루프가 차단되어 네트워크 요청 처리 성능이 저하됨. 특히 동시 요청이 많을 때 병목 현상 발생.

# 해결 방안
1. 동기 I/O 호출을 async/await 패턴으로 전환
2. fs.promises API 사용
3. 필요시 버퍼 크기 최적화 (기본 4KB → 64KB)

예시:
```javascript
// Before
const data = fs.readFileSync(path);
fs.writeFileSync(path, data);

// After
const data = await fs.promises.readFile(path);
await fs.promises.writeFile(path, data);
```

# 적용 조건
- 파일 크기 > 1MB
- 동시 요청 > 10건
- Node.js 환경

# 주의 사항
- 에러 핸들링 누락 주의 (try-catch 필수)
- 호출부에 async 전파 확인 필요
- 메모리 사용량 모니터링 필요 (대용량 파일 처리 시)

# 코드 예시
```typescript
// 변경 전
function readConfig(path: string): Config {
  const raw = fs.readFileSync(path, 'utf-8');
  return JSON.parse(raw);
}

// 변경 후
async function readConfig(path: string): Promise<Config> {
  try {
    const raw = await fs.promises.readFile(path, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    throw new ConfigError(`Failed to read config: ${error.message}`);
  }
}
```

# 참고 자료
- [Node.js fs.promises API](https://nodejs.org/api/fs.html#fspromisesreadfilepath-options)
- [Understanding Event Loop](https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick)
