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
        log(`  skip: ${path.relative(TARGET_DIR, destPath)}`, 'dim');
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
      log(`  create: ${path.relative(TARGET_DIR, destPath)}`, 'green');
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
  log('\n🚀 z-agent setup\n', 'blue');

  // Clear cache for next run (non-blocking, just ensures fresh version next time)
  const cleared = clearZAgentCache();
  if (cleared > 0) {
    log(`🧹 Cleared ${cleared} cached package(s) for future updates`, 'dim');
  }

  // 1. Copy .z-agent folder
  const zAgentSrc = path.join(TEMPLATE_DIR, '.z-agent');
  const zAgentDest = path.join(TARGET_DIR, '.z-agent');

  if (fs.existsSync(zAgentDest)) {
    log('⚠️  .z-agent already exists, updating...', 'yellow');
  }

  log('\n📁 Setting up .z-agent/', 'blue');
  copyDir(zAgentSrc, zAgentDest);

  // 2. Copy .claude/commands only (not settings.json)
  const claudeCommandsSrc = path.join(TEMPLATE_DIR, '.claude', 'commands');
  const claudeCommandsDest = path.join(TARGET_DIR, '.claude', 'commands');

  log('\n📁 Setting up .claude/commands/', 'blue');
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
  log('\n📁 Setting up MCP configuration...', 'blue');
  setupMcpConfig();

  log('\n✅ z-agent setup complete!\n', 'green');
  log('Available commands:', 'blue');
  log('  /task <description>    - Start a new task');
  log('  /ask <question>        - Ask a question');
  log('  /planning <plan>       - Create a plan');
  log('  /list                  - View all tasks, plans, lessons');
  log('  /err [command]         - Auto-fix errors and create lessons');
  log('  /clear_task            - Cleanup completed items\n');

  log('📖 See .z-agent/README.md for more details\n', 'dim');
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
        log(`  warning: could not parse ${name} .claude.json, creating new`, 'yellow');
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
      updateReason = 'adding';
    } else {
      // Check Windows wrapper requirement
      if (isWindows && existingConfig.command !== 'cmd') {
        needsUpdate = true;
        updateReason = 'adding Windows cmd wrapper';
      } else if (!isWindows && existingConfig.command === 'cmd') {
        needsUpdate = true;
        updateReason = 'removing Windows cmd wrapper';
      } else {
        // Check if args match (compare as arrays)
        const existingArgs = JSON.stringify(existingConfig.args || []);
        const newArgs = JSON.stringify(mcpConfig.args);
        if (existingArgs !== newArgs) {
          needsUpdate = true;
          updateReason = 'updating args';
        }
      }
    }

    if (!needsUpdate) {
      log(`  [${name}] z-agent MCP config already up to date`, 'dim');
      continue;
    }

    log(`  [${name}] ${updateReason} z-agent MCP config`, 'green');
    config.mcpServers['z-agent'] = mcpConfig;

    // Write config
    fs.writeFileSync(claudeJsonPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  log(`  platform: ${isWindows ? 'Windows' : 'Unix'}`, 'dim');
}

function serve() {
  // Start MCP server
  const serverPath = path.join(__dirname, '..', 'dist', 'index.js');

  if (!fs.existsSync(serverPath)) {
    log('Error: MCP server not built. Run "npm run build" first.', 'red');
    process.exit(1);
  }

  // Spawn the server process
  const { spawn } = require('child_process');
  const child = spawn('node', [serverPath], {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  child.on('error', (err) => {
    console.error('Failed to start MCP server:', err);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

function showHelp() {
  log('\nz-agent - Claude Code workflow management system\n', 'blue');
  log('Usage:', 'yellow');
  log('  npx z-agent init       Initialize z-agent in current directory');
  log('  npx z-agent serve      Start MCP server (for Claude Code)');
  log('  npx z-agent help       Show this help message\n');
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
    log(`Unknown command: ${command}`, 'red');
    showHelp();
    process.exit(1);
}
