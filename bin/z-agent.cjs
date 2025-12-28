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

function init() {
  log('\n🚀 z-agent setup\n', 'blue');

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

  log('\n✅ z-agent setup complete!\n', 'green');
  log('Available commands:', 'blue');
  log('  /task <description>    - Start a new task');
  log('  /ask <question>        - Ask a question');
  log('  /planning <plan>       - Create a plan\n');

  log('📖 See .z-agent/README.md for more details\n', 'dim');
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
