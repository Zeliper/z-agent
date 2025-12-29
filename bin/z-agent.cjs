#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, '..', 'template');
const TARGET_DIR = process.cwd();

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function copyDir(src, dest, options = {}) {
  const { skipExisting = false, filter = () => true } = options;

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (!filter(srcPath, entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, options);
    } else {
      if (skipExisting && fs.existsSync(destPath)) {
        log(`  건너뜀: ${path.relative(TARGET_DIR, destPath)}`, 'dim');
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
      log(`  생성: ${path.relative(TARGET_DIR, destPath)}`, 'green');
    }
  }
}

function clearZAgentCache() {
  const os = require('os');
  const homeDir = os.homedir();
  const npxCacheDir = path.join(homeDir, '.npm', '_npx');

  if (!fs.existsSync(npxCacheDir)) {
    return 0;
  }

  let cleared = 0;
  const entries = fs.readdirSync(npxCacheDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const pkgJsonPath = path.join(npxCacheDir, entry.name, 'node_modules', 'z-agent', 'package.json');
    const pkgJsonAltPath = path.join(npxCacheDir, entry.name, 'node_modules', '.package-lock.json');

    let isZAgent = false;

    // Check if this cache contains z-agent
    if (fs.existsSync(pkgJsonPath)) {
      isZAgent = true;
    } else if (fs.existsSync(pkgJsonAltPath)) {
      try {
        const lockContent = fs.readFileSync(pkgJsonAltPath, 'utf-8');
        if (lockContent.includes('z-agent') || lockContent.includes('Zeliper/z-agent')) {
          isZAgent = true;
        }
      } catch (e) {}
    }

    if (isZAgent) {
      const cachePath = path.join(npxCacheDir, entry.name);
      fs.rmSync(cachePath, { recursive: true, force: true });
      cleared++;
    }
  }

  return cleared;
}

function init() {
  log('\n🚀 z-agent 설정\n', 'blue');

  // Clear cache for next run (non-blocking, just ensures fresh version next time)
  const cleared = clearZAgentCache();
  if (cleared > 0) {
    log(`🧹 캐시 ${cleared}개 정리 완료 (다음 업데이트 준비)`, 'dim');
  }

  // 1. Copy .z-agent folder
  const zAgentSrc = path.join(TEMPLATE_DIR, '.z-agent');
  const zAgentDest = path.join(TARGET_DIR, '.z-agent');

  if (fs.existsSync(zAgentDest)) {
    log('⚠️  .z-agent 폴더가 이미 존재합니다. 업데이트 중...', 'yellow');
  }

  log('\n📁 .z-agent/ 설정 중...', 'blue');
  copyDir(zAgentSrc, zAgentDest);

  // 2. Copy .claude/commands only (not settings.json)
  const claudeCommandsSrc = path.join(TEMPLATE_DIR, '.claude', 'commands');
  const claudeCommandsDest = path.join(TARGET_DIR, '.claude', 'commands');

  log('\n📁 .claude/commands/ 설정 중...', 'blue');
  copyDir(claudeCommandsSrc, claudeCommandsDest);

  // 3. Create task folders if not exist
  const tasksDest = path.join(TARGET_DIR, '.z-agent', 'tasks');
  const lessonsDest = path.join(TARGET_DIR, '.z-agent', 'lessons');

  if (!fs.existsSync(tasksDest)) {
    fs.mkdirSync(tasksDest, { recursive: true });
  }
  if (!fs.existsSync(lessonsDest)) {
    fs.mkdirSync(lessonsDest, { recursive: true });
  }

  // 4. Setup MCP configuration in .claude.json
  log('\n📁 MCP 설정 중...', 'blue');
  setupMcpConfig();

  log('\n✅ z-agent 설정 완료!\n', 'green');
  log('사용 가능한 명령어:', 'blue');
  log('  /task <설명>           - 새 작업 시작');
  log('  /ask <질문>            - 질문하기');
  log('  /planning <계획>       - 계획 생성');
  log('  /list                  - 모든 Task, Plan, Lesson 보기');
  log('  /err [명령어]          - 에러 자동 수정 및 Lesson 생성');
  log('  /clear_task            - 완료된 항목 정리\n');

  log('📖 자세한 내용은 .z-agent/README.md 참조\n', 'dim');
}

function setupMcpConfig() {
  const os = require('os');
  const homeDir = os.homedir();
  const isWindows = process.platform === 'win32';

  // Create platform-specific MCP config
  let mcpConfig;
  if (isWindows) {
    mcpConfig = {
      command: 'cmd',
      args: ['/c', 'npx', '-y', 'github:Zeliper/z-agent', 'serve']
    };
  } else {
    mcpConfig = {
      command: 'npx',
      args: ['-y', 'github:Zeliper/z-agent', 'serve']
    };
  }

  // Update both project and home directory configs
  const configPaths = [
    { path: path.join(TARGET_DIR, '.claude.json'), name: 'project' },
    { path: path.join(homeDir, '.claude.json'), name: 'home' }
  ];

  for (const { path: claudeJsonPath, name } of configPaths) {
    // Read existing config or create new
    let config = {};
    if (fs.existsSync(claudeJsonPath)) {
      try {
        const content = fs.readFileSync(claudeJsonPath, 'utf-8');
        config = JSON.parse(content);
      } catch (e) {
        log(`  경고: ${name} .claude.json 파싱 실패, 새로 생성`, 'yellow');
      }
    }

    // Merge MCP servers config
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    const existingConfig = config.mcpServers['z-agent'];

    // Check if update is needed
    let needsUpdate = false;
    let updateReason = '';

    if (!existingConfig) {
      needsUpdate = true;
      updateReason = '추가';
    } else {
      // Check Windows wrapper requirement
      if (isWindows && existingConfig.command !== 'cmd') {
        needsUpdate = true;
        updateReason = 'Windows cmd 래퍼 추가';
      } else if (!isWindows && existingConfig.command === 'cmd') {
        needsUpdate = true;
        updateReason = 'Windows cmd 래퍼 제거';
      } else {
        // Check if args match (compare as arrays)
        const existingArgs = JSON.stringify(existingConfig.args || []);
        const newArgs = JSON.stringify(mcpConfig.args);
        if (existingArgs !== newArgs) {
          needsUpdate = true;
          updateReason = '인자 업데이트';
        }
      }
    }

    if (!needsUpdate) {
      log(`  [${name}] z-agent MCP 설정 이미 최신`, 'dim');
      continue;
    }

    log(`  [${name}] z-agent MCP 설정 ${updateReason}`, 'green');
    config.mcpServers['z-agent'] = mcpConfig;

    // Write config
    fs.writeFileSync(claudeJsonPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  log(`  플랫폼: ${isWindows ? 'Windows' : 'Unix'}`, 'dim');
}

function serve() {
  // Start MCP server
  const serverPath = path.join(__dirname, '..', 'dist', 'index.js');

  if (!fs.existsSync(serverPath)) {
    log('오류: MCP 서버가 빌드되지 않았습니다. "npm run build"를 먼저 실행하세요.', 'red');
    process.exit(1);
  }

  // Spawn the server process
  const { spawn } = require('child_process');
  const child = spawn('node', [serverPath], {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  child.on('error', (err) => {
    console.error('MCP 서버 시작 실패:', err);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

function showHelp() {
  log('\nz-agent - Claude Code 워크플로우 관리 시스템\n', 'blue');
  log('사용법:', 'yellow');
  log('  npx z-agent init       현재 디렉토리에 z-agent 초기화');
  log('  npx z-agent serve      MCP 서버 시작 (Claude Code용)');
  log('  npx z-agent help       도움말 표시\n');
}

// Main
const command = process.argv[2];

switch (command) {
  case 'init':
    init();
    break;
  case 'serve':
    serve();
    break;
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
  case undefined:
    init();
    break;
  default:
    log(`알 수 없는 명령어: ${command}`, 'red');
    showHelp();
    process.exit(1);
}
