#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";

// Types
interface TaskMeta {
  taskId: string;
  taskDesc: string;
  createdAt: string;
  difficulty: "H" | "M" | "L";
  status: "pending" | "in_progress" | "completed" | "cancelled" | "blocked";
  relatedLessons: string[];
}

interface TodoItem {
  index: number;
  description: string;
  difficulty: "H" | "M" | "L";
  status: "pending" | "in_progress" | "complete" | "completed" | "cancelled" | "blocked";
}

interface DifficultyResult {
  difficulty: "H" | "M" | "L";
  confidence: number;
  reasoning: string;
  suggestedModel: "opus" | "sonnet" | "haiku";
  keywords: string[];
}

interface LessonMeta {
  lessonId: string;
  category: string;
  tags: string[];
  summary: string;
}

// Constants
const STATUS_EMOJI: Record<string, string> = {
  pending: "⏳",
  in_progress: "🔄",
  complete: "✅",
  completed: "✅",
  cancelled: "❌",
  blocked: "🚫",
};

const DIFFICULTY_MODEL_MAP: Record<string, string> = {
  H: "opus",
  M: "sonnet",
  L: "haiku",
};

// Utility functions
function getZAgentRoot(): string {
  const cwd = process.cwd();
  return path.join(cwd, ".z-agent");
}

function ensureDirectories(): void {
  const root = getZAgentRoot();
  const dirs = ["tasks", "lessons", "scripts", "agents", "skills", "templates"];

  for (const dir of dirs) {
    const dirPath = path.join(root, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

function getNextTaskId(): string {
  const tasksDir = path.join(getZAgentRoot(), "tasks");
  if (!fs.existsSync(tasksDir)) {
    return "task-001";
  }

  const files = fs.readdirSync(tasksDir).filter((f) => f.match(/^task-\d+\.md$/));
  if (files.length === 0) {
    return "task-001";
  }

  const maxNum = Math.max(
    ...files.map((f) => parseInt(f.match(/task-(\d+)\.md/)?.[1] || "0"))
  );
  return `task-${String(maxNum + 1).padStart(3, "0")}`;
}

function getNextLessonId(): string {
  const lessonsDir = path.join(getZAgentRoot(), "lessons");
  if (!fs.existsSync(lessonsDir)) {
    return "lesson-001";
  }

  const files = fs.readdirSync(lessonsDir).filter((f) => f.match(/^lesson-\d+\.md$/));
  if (files.length === 0) {
    return "lesson-001";
  }

  const maxNum = Math.max(
    ...files.map((f) => parseInt(f.match(/lesson-(\d+)\.md/)?.[1] || "0"))
  );
  return `lesson-${String(maxNum + 1).padStart(3, "0")}`;
}

function analyzeDifficulty(input: string): DifficultyResult {
  const lowerInput = input.toLowerCase();

  // High difficulty keywords
  const highKeywords = [
    "아키텍처", "설계", "리팩토링", "최적화", "성능", "보안",
    "구현", "개발", "작성", "알고리즘", "시스템", "통합",
    "architecture", "refactor", "optimize", "implement", "design",
    "security", "performance", "algorithm", "complex"
  ];

  // Medium difficulty keywords
  const mediumKeywords = [
    "분석", "리뷰", "테스트", "에러", "버그", "수정", "설명",
    "analyze", "review", "test", "error", "bug", "fix", "explain",
    "debug", "check"
  ];

  // Low difficulty keywords
  const lowKeywords = [
    "검색", "찾기", "조회", "커밋", "메시지", "번역", "목록",
    "search", "find", "list", "commit", "message", "translate", "simple"
  ];

  let highScore = 0;
  let mediumScore = 0;
  let lowScore = 0;
  const foundKeywords: string[] = [];

  for (const kw of highKeywords) {
    if (lowerInput.includes(kw)) {
      highScore += 3;
      foundKeywords.push(kw);
    }
  }

  for (const kw of mediumKeywords) {
    if (lowerInput.includes(kw)) {
      mediumScore += 2;
      foundKeywords.push(kw);
    }
  }

  for (const kw of lowKeywords) {
    if (lowerInput.includes(kw)) {
      lowScore += 1;
      foundKeywords.push(kw);
    }
  }

  // Default to medium if no keywords found
  if (highScore === 0 && mediumScore === 0 && lowScore === 0) {
    return {
      difficulty: "M",
      confidence: 0.5,
      reasoning: "키워드 매칭 없음, 기본값 M 적용",
      suggestedModel: "sonnet",
      keywords: [],
    };
  }

  const totalScore = highScore + mediumScore + lowScore;

  if (highScore >= mediumScore && highScore >= lowScore) {
    return {
      difficulty: "H",
      confidence: highScore / totalScore,
      reasoning: `고급 작업 키워드 발견: ${foundKeywords.slice(0, 3).join(", ")}`,
      suggestedModel: "opus",
      keywords: foundKeywords,
    };
  } else if (mediumScore >= lowScore) {
    return {
      difficulty: "M",
      confidence: mediumScore / totalScore,
      reasoning: `일반 작업 키워드 발견: ${foundKeywords.slice(0, 3).join(", ")}`,
      suggestedModel: "sonnet",
      keywords: foundKeywords,
    };
  } else {
    return {
      difficulty: "L",
      confidence: lowScore / totalScore,
      reasoning: `간단한 작업 키워드 발견: ${foundKeywords.slice(0, 3).join(", ")}`,
      suggestedModel: "haiku",
      keywords: foundKeywords,
    };
  }
}

function createTaskFile(
  taskId: string,
  description: string,
  difficulty: "H" | "M" | "L",
  todos: TodoItem[],
  relatedLessons: string[] = []
): string {
  const now = new Date().toISOString();
  const todoList = todos
    .map((t) => `${STATUS_EMOJI[t.status]} - ${t.index}. ${t.description} (${t.difficulty})`)
    .join("\n");

  const content = `---
taskId: ${taskId}
taskDesc: ${description}
createdAt: ${now}
difficulty: ${difficulty}
status: pending
relatedLessons: [${relatedLessons.map(l => `"${l}"`).join(", ")}]
---
# TODO List
${todoList}

# Footnote
사용자 요청에 따라 자동 생성됨
`;

  const filePath = path.join(getZAgentRoot(), "tasks", `${taskId}.md`);
  fs.writeFileSync(filePath, content, "utf-8");

  // Create task folder
  const taskFolder = path.join(getZAgentRoot(), taskId);
  if (!fs.existsSync(taskFolder)) {
    fs.mkdirSync(taskFolder, { recursive: true });
  }

  return filePath;
}

function updateTodoStatus(
  taskId: string,
  todoIndex: number,
  newStatus: string
): boolean {
  const filePath = path.join(getZAgentRoot(), "tasks", `${taskId}.md`);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  let content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^([⏳🔄✅❌🚫])\s*-\s*(\d+)\.\s*(.+?)\s*\(([HML])\)\s*$/);
    if (match && parseInt(match[2]) === todoIndex) {
      const emoji = STATUS_EMOJI[newStatus] || "⏳";
      lines[i] = `${emoji} - ${match[2]}. ${match[3]} (${match[4]})`;
      break;
    }
  }

  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  return true;
}

function getTaskStatus(taskId: string): { task: TaskMeta | null; todos: TodoItem[] } {
  const filePath = path.join(getZAgentRoot(), "tasks", `${taskId}.md`);

  if (!fs.existsSync(filePath)) {
    return { task: null, todos: [] };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const todos: TodoItem[] = [];

  // Parse TODOs
  const todoMatches = content.matchAll(/^([⏳🔄✅❌🚫])\s*-\s*(\d+)\.\s*(.+?)\s*\(([HML])\)\s*$/gm);
  for (const match of todoMatches) {
    const emoji = match[1];
    const status = Object.entries(STATUS_EMOJI).find(([_, e]) => e === emoji)?.[0] || "pending";
    todos.push({
      index: parseInt(match[2]),
      description: match[3],
      difficulty: match[4] as "H" | "M" | "L",
      status: status as TodoItem["status"],
    });
  }

  // Parse meta
  const taskDescMatch = content.match(/taskDesc:\s*(.+)/);
  const difficultyMatch = content.match(/difficulty:\s*([HML])/);
  const statusMatch = content.match(/status:\s*(\w+)/);

  const task: TaskMeta = {
    taskId,
    taskDesc: taskDescMatch?.[1] || "",
    createdAt: "",
    difficulty: (difficultyMatch?.[1] as "H" | "M" | "L") || "M",
    status: (statusMatch?.[1] as TaskMeta["status"]) || "pending",
    relatedLessons: [],
  };

  return { task, todos };
}

function searchLessons(query: string, limit: number = 5): LessonMeta[] {
  const lessonsDir = path.join(getZAgentRoot(), "lessons");

  if (!fs.existsSync(lessonsDir)) {
    return [];
  }

  const files = fs.readdirSync(lessonsDir).filter((f) => f.match(/^lesson-\d+\.md$/));
  const results: (LessonMeta & { score: number })[] = [];
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);

  for (const file of files) {
    const content = fs.readFileSync(path.join(lessonsDir, file), "utf-8");
    const lessonId = file.replace(".md", "");

    // Extract metadata
    const categoryMatch = content.match(/category:\s*(\w+)/);
    const tagsMatch = content.match(/tags:\s*\n((?:\s*-\s*.+\n)+)/);
    const problemMatch = content.match(/# 문제 상황\n([\s\S]*?)(?=\n#|$)/);

    const category = categoryMatch?.[1] || "";
    const tags = tagsMatch?.[1]?.match(/-\s*(.+)/g)?.map(t => t.replace(/^-\s*/, "")) || [];
    const summary = problemMatch?.[1]?.trim().slice(0, 100) || "";

    // Calculate relevance score
    let score = 0;
    for (const word of queryWords) {
      if (tags.some(t => t.toLowerCase().includes(word))) score += 3;
      if (category.toLowerCase().includes(word)) score += 2;
      if (content.toLowerCase().includes(word)) score += 1;
    }

    if (score > 0) {
      results.push({ lessonId, category, tags, summary, score });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, ...rest }) => rest);
}

function recordLesson(
  category: string,
  problem: string,
  solution: string,
  tags: string[],
  relatedTasks: string[] = []
): string {
  const lessonId = getNextLessonId();
  const now = new Date().toISOString();

  const content = `---
lessonId: ${lessonId}
createdAt: ${now}
updatedAt: ${now}
relatedTasks: [${relatedTasks.map(t => `"${t}"`).join(", ")}]
category: ${category}
tags:
${tags.map(t => `  - ${t}`).join("\n")}
useCount: 0
lastUsed: null
---

# 문제 상황
${problem}

# 해결 방안
${solution}

# 적용 조건
(추후 작성)

# 주의 사항
(추후 작성)
`;

  const filePath = path.join(getZAgentRoot(), "lessons", `${lessonId}.md`);
  fs.writeFileSync(filePath, content, "utf-8");

  return lessonId;
}

function getAgentPrompt(difficulty: "H" | "M" | "L", todoDescription: string): string {
  const model = DIFFICULTY_MODEL_MAP[difficulty];

  const prompts: Record<string, string> = {
    opus: `당신은 고급 작업을 담당하는 Opus Agent입니다.

## 역할
- 복잡한 코드 작성 및 아키텍처 설계
- 고급 논리 처리 및 디버깅
- 성능 최적화 및 보안 분석

## 현재 작업
${todoDescription}

## 작업 지침
1. 깊이 있는 분석을 수행하세요
2. 여러 해결책을 고려하고 최선을 선택하세요
3. 코드 품질과 유지보수성을 고려하세요
4. 결과를 상세히 문서화하세요

## 응답 형식
작업 완료 후 다음 형식으로 결과를 제공하세요:
- summary: 한 줄 요약
- changedFiles: 변경된 파일 목록
- details: 상세 내용`,

    sonnet: `당신은 일반 작업을 담당하는 Sonnet Agent입니다.

## 역할
- 에러 분석 및 코드 리뷰
- 테스트 작성 및 일반 질문 답변
- 문서화 및 코드 설명

## 현재 작업
${todoDescription}

## 작업 지침
1. 문제를 명확히 파악하세요
2. 단계별로 해결책을 제시하세요
3. 필요시 코드 예시를 포함하세요

## 응답 형식
작업 완료 후 다음 형식으로 결과를 제공하세요:
- summary: 한 줄 요약
- details: 상세 내용`,

    haiku: `당신은 간단한 작업을 담당하는 Haiku Agent입니다.

## 역할
- 정보 검색 및 파일 찾기
- 커밋 메시지 작성
- 간단한 번역 및 포맷 변환

## 현재 작업
${todoDescription}

## 작업 지침
1. 빠르고 정확하게 처리하세요
2. 핵심 정보만 제공하세요

## 응답 형식
- summary: 결과 요약`,
  };

  return prompts[model] || prompts.sonnet;
}

function saveTodoResult(
  taskId: string,
  todoId: number,
  status: string,
  summary: string,
  details: string,
  changedFiles: string[] = []
): string {
  const now = new Date().toISOString();
  const content = `---
taskId: ${taskId}
todoId: ${todoId}
status: ${status}
summary: "${summary}"
changedFiles: [${changedFiles.map(f => `"${f}"`).join(", ")}]
completedAt: ${now}
---

# Details

${details}
`;

  const filePath = path.join(getZAgentRoot(), taskId, `todo-${String(todoId).padStart(3, "0")}.md`);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// File operation functions - return minimal output for context efficiency
function writeFile(filePath: string, content: string): { success: boolean; message: string } {
  try {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const dir = path.dirname(absolutePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(absolutePath, content, "utf-8");
    const lines = content.split("\n").length;

    return {
      success: true,
      message: `✅ ${filePath} 생성됨 (${lines}줄)`,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ 파일 생성 실패: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function editFile(
  filePath: string,
  oldString: string,
  newString: string,
  replaceAll: boolean = false
): { success: boolean; message: string; replacements: number } {
  try {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

    if (!fs.existsSync(absolutePath)) {
      return {
        success: false,
        message: `❌ 파일 없음: ${filePath}`,
        replacements: 0,
      };
    }

    let content = fs.readFileSync(absolutePath, "utf-8");

    if (!content.includes(oldString)) {
      return {
        success: false,
        message: `❌ 일치하는 문자열 없음`,
        replacements: 0,
      };
    }

    let replacements = 0;
    if (replaceAll) {
      const regex = new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      replacements = (content.match(regex) || []).length;
      content = content.replace(regex, newString);
    } else {
      replacements = 1;
      content = content.replace(oldString, newString);
    }

    fs.writeFileSync(absolutePath, content, "utf-8");

    return {
      success: true,
      message: `✅ ${filePath} 수정됨 (${replacements}개 교체)`,
      replacements,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ 파일 수정 실패: ${error instanceof Error ? error.message : String(error)}`,
      replacements: 0,
    };
  }
}

function readFile(filePath: string, offset?: number, limit?: number): { success: boolean; content?: string; message: string; lines?: number } {
  try {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

    if (!fs.existsSync(absolutePath)) {
      return {
        success: false,
        message: `❌ 파일 없음: ${filePath}`,
      };
    }

    const content = fs.readFileSync(absolutePath, "utf-8");
    const allLines = content.split("\n");
    const totalLines = allLines.length;

    const startLine = offset || 0;
    const endLine = limit ? startLine + limit : totalLines;
    const selectedLines = allLines.slice(startLine, endLine);

    return {
      success: true,
      content: selectedLines.join("\n"),
      message: `✅ ${filePath} 읽기 완료`,
      lines: totalLines,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ 파일 읽기 실패: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function listDir(dirPath: string, recursive: boolean = false): { success: boolean; entries: string[]; message: string } {
  try {
    const absolutePath = path.isAbsolute(dirPath) ? dirPath : path.join(process.cwd(), dirPath);

    if (!fs.existsSync(absolutePath)) {
      return {
        success: false,
        entries: [],
        message: `❌ 디렉토리 없음: ${dirPath}`,
      };
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isDirectory()) {
      return {
        success: false,
        entries: [],
        message: `❌ 디렉토리가 아님: ${dirPath}`,
      };
    }

    const entries: string[] = [];
    const ignoreDirs = ['.git', 'node_modules', '.z-agent', '.claude', '__pycache__', '.venv', 'venv', 'dist', 'build'];

    function scanDir(currentPath: string, relativeTo: string) {
      const items = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const item of items) {
        if (ignoreDirs.includes(item.name)) continue;
        if (item.name.startsWith('.') && item.name !== '.') continue;

        const fullPath = path.join(currentPath, item.name);
        const relativePath = path.relative(relativeTo, fullPath);

        if (item.isDirectory()) {
          entries.push(relativePath + '/');
          if (recursive) {
            scanDir(fullPath, relativeTo);
          }
        } else {
          entries.push(relativePath);
        }
      }
    }

    scanDir(absolutePath, absolutePath);
    entries.sort();

    return {
      success: true,
      entries,
      message: `✅ ${dirPath} (${entries.length}개 항목)`,
    };
  } catch (error) {
    return {
      success: false,
      entries: [],
      message: `❌ 디렉토리 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function globFiles(pattern: string, basePath?: string): { success: boolean; files: string[]; message: string } {
  try {
    const searchPath = basePath
      ? (path.isAbsolute(basePath) ? basePath : path.join(process.cwd(), basePath))
      : process.cwd();

    if (!fs.existsSync(searchPath)) {
      return {
        success: false,
        files: [],
        message: `❌ 경로 없음: ${basePath || '.'}`,
      };
    }

    const files: string[] = [];
    const ignoreDirs = ['.git', 'node_modules', '.z-agent', '.claude', '__pycache__', '.venv', 'venv'];

    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{GLOBSTAR}}/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);

    function scanDir(currentPath: string) {
      const items = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const item of items) {
        if (ignoreDirs.includes(item.name)) continue;

        const fullPath = path.join(currentPath, item.name);
        const relativePath = path.relative(searchPath, fullPath);

        if (item.isDirectory()) {
          scanDir(fullPath);
        } else {
          if (regex.test(relativePath) || regex.test(item.name)) {
            files.push(relativePath);
          }
        }
      }
    }

    scanDir(searchPath);
    files.sort();

    return {
      success: true,
      files,
      message: `✅ ${pattern} (${files.length}개 파일)`,
    };
  } catch (error) {
    return {
      success: false,
      files: [],
      message: `❌ 파일 검색 실패: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function generateTaskSummary(taskId: string): string {
  const { task, todos } = getTaskStatus(taskId);

  if (!task) {
    return `Task ${taskId} not found`;
  }

  const completedTodos = todos.filter(t => t.status === "complete" || t.status === "completed");
  const failedTodos = todos.filter(t => t.status === "cancelled" || t.status === "blocked");

  let summary = `## Task [${taskId}] ${task.status === "completed" ? "완료" : "진행 중"}\n\n`;
  summary += `### 요약\n${task.taskDesc}\n\n`;
  summary += `### 완료 항목\n`;

  for (const todo of todos) {
    const emoji = STATUS_EMOJI[todo.status] || "⏳";
    summary += `- ${emoji} TODO #${todo.index}: ${todo.description}\n`;
  }

  summary += `\n### 상세 내용\n📁 .z-agent/${taskId}/\n`;

  return summary;
}

// Define tools
const tools: Tool[] = [
  {
    name: "z_analyze_difficulty",
    description: "사용자 입력의 난이도를 분석하여 H(High), M(Medium), L(Low)로 분류하고 적절한 모델을 추천합니다.",
    inputSchema: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "분석할 사용자 입력",
        },
      },
      required: ["input"],
    },
  },
  {
    name: "z_create_task",
    description: "새로운 Task를 생성합니다. 자동으로 난이도 분석 및 TODO 목록을 생성합니다.",
    inputSchema: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Task 설명",
        },
        todos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              difficulty: { type: "string", enum: ["H", "M", "L"] },
            },
          },
          description: "TODO 항목 목록",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "z_update_todo",
    description: "Task의 TODO 항목 상태를 업데이트합니다.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Task ID (예: task-001)",
        },
        todoIndex: {
          type: "number",
          description: "TODO 인덱스 (1부터 시작)",
        },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "complete", "cancelled", "blocked"],
          description: "새로운 상태",
        },
      },
      required: ["taskId", "todoIndex", "status"],
    },
  },
  {
    name: "z_get_task_status",
    description: "Task의 현재 상태와 TODO 목록을 조회합니다.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Task ID (예: task-001)",
        },
      },
      required: ["taskId"],
    },
  },
  {
    name: "z_search_lessons",
    description: "관련된 Lessons Learned를 검색합니다.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "검색 쿼리 (키워드 또는 문장)",
        },
        limit: {
          type: "number",
          description: "최대 결과 수 (기본값: 5)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "z_record_lesson",
    description: "새로운 Lesson을 기록합니다.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["performance", "security", "architecture", "debugging", "best-practice"],
          description: "Lesson 카테고리",
        },
        problem: {
          type: "string",
          description: "문제 상황 설명",
        },
        solution: {
          type: "string",
          description: "해결 방안",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "검색용 태그",
        },
        relatedTasks: {
          type: "array",
          items: { type: "string" },
          description: "관련 Task ID 목록",
        },
      },
      required: ["category", "problem", "solution", "tags"],
    },
  },
  {
    name: "z_get_agent_prompt",
    description: "난이도에 맞는 Agent 프롬프트를 반환합니다. 이 프롬프트를 사용하여 Task tool로 적절한 모델에 작업을 위임하세요.",
    inputSchema: {
      type: "object",
      properties: {
        difficulty: {
          type: "string",
          enum: ["H", "M", "L"],
          description: "작업 난이도",
        },
        todoDescription: {
          type: "string",
          description: "수행할 TODO 설명",
        },
      },
      required: ["difficulty", "todoDescription"],
    },
  },
  {
    name: "z_save_todo_result",
    description: "TODO 작업 결과를 파일로 저장합니다.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Task ID",
        },
        todoId: {
          type: "number",
          description: "TODO 인덱스",
        },
        status: {
          type: "string",
          enum: ["complete", "failed", "blocked"],
          description: "완료 상태",
        },
        summary: {
          type: "string",
          description: "한 줄 요약",
        },
        details: {
          type: "string",
          description: "상세 내용",
        },
        changedFiles: {
          type: "array",
          items: { type: "string" },
          description: "변경된 파일 목록",
        },
      },
      required: ["taskId", "todoId", "status", "summary", "details"],
    },
  },
  {
    name: "z_generate_summary",
    description: "Task 완료 후 최종 요약을 생성합니다. 세션 컨텍스트 최소화를 위해 간결한 요약만 반환합니다.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Task ID",
        },
      },
      required: ["taskId"],
    },
  },
  {
    name: "z_write_file",
    description: "파일을 생성합니다. 코드 내용은 context에 포함되지 않고 간결한 결과만 반환합니다.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "생성할 파일 경로 (절대 경로 또는 상대 경로)",
        },
        content: {
          type: "string",
          description: "파일 내용",
        },
      },
      required: ["filePath", "content"],
    },
  },
  {
    name: "z_edit_file",
    description: "파일의 특정 부분을 수정합니다. 코드 내용은 context에 포함되지 않고 간결한 결과만 반환합니다.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "수정할 파일 경로",
        },
        oldString: {
          type: "string",
          description: "교체할 기존 문자열",
        },
        newString: {
          type: "string",
          description: "새로운 문자열",
        },
        replaceAll: {
          type: "boolean",
          description: "모든 일치 항목을 교체할지 여부 (기본값: false)",
        },
      },
      required: ["filePath", "oldString", "newString"],
    },
  },
  {
    name: "z_read_file",
    description: "파일 내용을 읽습니다. Sub Agent가 파일을 분석할 때 사용합니다.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "읽을 파일 경로",
        },
        offset: {
          type: "number",
          description: "시작 줄 번호 (0부터 시작, 선택사항)",
        },
        limit: {
          type: "number",
          description: "읽을 줄 수 (선택사항)",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "z_list_dir",
    description: "디렉토리 내용을 조회합니다. .git, node_modules, .z-agent, .claude 등 시스템 폴더는 자동 제외됩니다.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: {
          type: "string",
          description: "조회할 디렉토리 경로 (기본값: 현재 디렉토리)",
        },
        recursive: {
          type: "boolean",
          description: "하위 디렉토리까지 조회할지 여부 (기본값: false)",
        },
      },
      required: [],
    },
  },
  {
    name: "z_glob",
    description: "패턴으로 파일을 검색합니다. **, *, ? 패턴을 지원합니다. 시스템 폴더는 자동 제외됩니다.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "검색 패턴 (예: **/*.ts, src/*.js, *.md)",
        },
        basePath: {
          type: "string",
          description: "검색 시작 경로 (기본값: 현재 디렉토리)",
        },
      },
      required: ["pattern"],
    },
  },
];

// Create server
const server = new Server(
  {
    name: "z-agent",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    ensureDirectories();

    switch (name) {
      case "z_analyze_difficulty": {
        const result = analyzeDifficulty(args.input as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "z_create_task": {
        const description = args.description as string;
        const difficultyResult = analyzeDifficulty(description);

        // Search related lessons
        const relatedLessons = searchLessons(description, 3).map(l => l.lessonId);

        // Create TODO list from input or generate default
        let todos: TodoItem[] = [];
        if (args.todos && Array.isArray(args.todos)) {
          todos = (args.todos as Array<{ description: string; difficulty: string }>).map((t, i) => ({
            index: i + 1,
            description: t.description,
            difficulty: (t.difficulty as "H" | "M" | "L") || difficultyResult.difficulty,
            status: "pending" as const,
          }));
        } else {
          // Default single TODO
          todos = [{
            index: 1,
            description: description,
            difficulty: difficultyResult.difficulty,
            status: "pending" as const,
          }];
        }

        const taskId = getNextTaskId();
        const filePath = createTaskFile(
          taskId,
          description,
          difficultyResult.difficulty,
          todos,
          relatedLessons
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                taskId,
                filePath,
                difficulty: difficultyResult.difficulty,
                suggestedModel: difficultyResult.suggestedModel,
                todoCount: todos.length,
                relatedLessons,
                message: `Task ${taskId} 생성됨. 난이도: ${difficultyResult.difficulty}, 권장 모델: ${difficultyResult.suggestedModel}`,
              }, null, 2),
            },
          ],
        };
      }

      case "z_update_todo": {
        const success = updateTodoStatus(
          args.taskId as string,
          args.todoIndex as number,
          args.status as string
        );

        return {
          content: [
            {
              type: "text",
              text: success
                ? `TODO #${args.todoIndex} 상태가 ${args.status}로 업데이트됨`
                : `TODO 업데이트 실패: Task ${args.taskId} 또는 TODO #${args.todoIndex}를 찾을 수 없음`,
            },
          ],
        };
      }

      case "z_get_task_status": {
        const result = getTaskStatus(args.taskId as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "z_search_lessons": {
        const results = searchLessons(
          args.query as string,
          (args.limit as number) || 5
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                query: args.query,
                count: results.length,
                lessons: results,
              }, null, 2),
            },
          ],
        };
      }

      case "z_record_lesson": {
        const lessonId = recordLesson(
          args.category as string,
          args.problem as string,
          args.solution as string,
          args.tags as string[],
          (args.relatedTasks as string[]) || []
        );
        return {
          content: [
            {
              type: "text",
              text: `Lesson ${lessonId} 기록됨`,
            },
          ],
        };
      }

      case "z_get_agent_prompt": {
        const prompt = getAgentPrompt(
          args.difficulty as "H" | "M" | "L",
          args.todoDescription as string
        );
        const model = DIFFICULTY_MODEL_MAP[args.difficulty as string];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                difficulty: args.difficulty,
                model,
                prompt,
                usage: `Task tool을 사용하여 model: "${model}"로 이 프롬프트와 함께 작업을 위임하세요.`,
              }, null, 2),
            },
          ],
        };
      }

      case "z_save_todo_result": {
        const filePath = saveTodoResult(
          args.taskId as string,
          args.todoId as number,
          args.status as string,
          args.summary as string,
          args.details as string,
          (args.changedFiles as string[]) || []
        );

        // Update TODO status
        updateTodoStatus(
          args.taskId as string,
          args.todoId as number,
          args.status as string
        );

        return {
          content: [
            {
              type: "text",
              text: `결과 저장됨: ${filePath}`,
            },
          ],
        };
      }

      case "z_generate_summary": {
        const summary = generateTaskSummary(args.taskId as string);
        return {
          content: [
            {
              type: "text",
              text: summary,
            },
          ],
        };
      }

      case "z_write_file": {
        const result = writeFile(
          args.filePath as string,
          args.content as string
        );
        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
          isError: !result.success,
        };
      }

      case "z_edit_file": {
        const result = editFile(
          args.filePath as string,
          args.oldString as string,
          args.newString as string,
          (args.replaceAll as boolean) || false
        );
        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
          isError: !result.success,
        };
      }

      case "z_read_file": {
        const result = readFile(
          args.filePath as string,
          args.offset as number | undefined,
          args.limit as number | undefined
        );
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? result.content!
                : result.message,
            },
          ],
          isError: !result.success,
        };
      }

      case "z_list_dir": {
        const result = listDir(
          (args.dirPath as string) || ".",
          (args.recursive as boolean) || false
        );
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? result.entries.join("\n")
                : result.message,
            },
          ],
          isError: !result.success,
        };
      }

      case "z_glob": {
        const result = globFiles(
          args.pattern as string,
          args.basePath as string | undefined
        );
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? result.files.join("\n")
                : result.message,
            },
          ],
          isError: !result.success,
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("z-agent MCP server running on stdio");
}

main().catch(console.error);
