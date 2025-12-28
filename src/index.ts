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

interface PlanMeta {
  planId: string;
  title: string;
  description: string;
  createdAt: string;
  status: "draft" | "ready" | "in_progress" | "completed" | "cancelled";
  difficulty: "H" | "M" | "L";
  linkedTasks: string[];
  todos: Array<{
    description: string;
    difficulty: "H" | "M" | "L";
  }>;
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
  const dirs = ["tasks", "lessons", "scripts", "agents", "skills", "templates", "plans", "answers", "temp"];

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

function getNextPlanId(): string {
  const plansDir = path.join(getZAgentRoot(), "plans");
  if (!fs.existsSync(plansDir)) {
    return "PLAN-001";
  }

  const files = fs.readdirSync(plansDir).filter((f) => f.match(/^PLAN-\d+\.md$/));
  if (files.length === 0) {
    return "PLAN-001";
  }

  const maxNum = Math.max(
    ...files.map((f) => parseInt(f.match(/PLAN-(\d+)\.md/)?.[1] || "0"))
  );
  return `PLAN-${String(maxNum + 1).padStart(3, "0")}`;
}

function getNextAnswerId(): string {
  const answersDir = path.join(getZAgentRoot(), "answers");
  if (!fs.existsSync(answersDir)) {
    return "answer-001";
  }

  const files = fs.readdirSync(answersDir).filter((f) => f.match(/^answer-\d+\.md$/));
  if (files.length === 0) {
    return "answer-001";
  }

  const maxNum = Math.max(
    ...files.map((f) => parseInt(f.match(/answer-(\d+)\.md/)?.[1] || "0"))
  );
  return `answer-${String(maxNum + 1).padStart(3, "0")}`;
}

function saveAnswer(
  question: string,
  answer: string,
  summary: string,
  relatedLessons: string[] = [],
  relatedFiles: string[] = [],
  relatedPlans: string[] = [],
  relatedTasks: string[] = []
): { answerId: string; filePath: string; summary: string } {
  const answerId = getNextAnswerId();
  const now = new Date().toISOString();

  const content = `---
answerId: ${answerId}
question: "${question.replace(/"/g, '\\"').slice(0, 200)}"
summary: "${summary.replace(/"/g, '\\"')}"
createdAt: ${now}
relatedLessons: [${relatedLessons.map(l => `"${l}"`).join(", ")}]
relatedFiles: [${relatedFiles.map(f => `"${f}"`).join(", ")}]
relatedPlans: [${relatedPlans.map(p => `"${p}"`).join(", ")}]
relatedTasks: [${relatedTasks.map(t => `"${t}"`).join(", ")}]
---

# 질문
${question}

# 답변
${answer}

# 참고
${relatedLessons.length > 0 ? `- Lessons: ${relatedLessons.join(", ")}` : "- Lessons: 없음"}
${relatedFiles.length > 0 ? `- Files: ${relatedFiles.join(", ")}` : "- Files: 없음"}
${relatedPlans.length > 0 ? `- Plans: ${relatedPlans.join(", ")}` : "- Plans: 없음"}
${relatedTasks.length > 0 ? `- Tasks: ${relatedTasks.join(", ")}` : "- Tasks: 없음"}
`;

  const filePath = path.join(getZAgentRoot(), "answers", `${answerId}.md`);
  fs.writeFileSync(filePath, content, "utf-8");

  return { answerId, filePath, summary };
}

function createPlan(
  title: string,
  description: string,
  relatedAnswers: string[] = []
): { planId: string; filePath: string } {
  const planId = getNextPlanId();
  const now = new Date().toISOString();
  const difficultyResult = analyzeDifficulty(description);

  const content = `---
planId: ${planId}
title: "${title}"
description: "${description}"
createdAt: ${now}
status: draft
difficulty: ${difficultyResult.difficulty}
linkedTasks: []
relatedAnswers: [${relatedAnswers.map(a => `"${a}"`).join(", ")}]
---

# ${title}

## 개요
${description}

## 목표
(Opus가 계획 수립 시 작성)

## TODO 목록
(Opus가 계획 수립 시 작성)

## 구현 전략
(Opus가 계획 수립 시 작성)

## 예상 이슈
(Opus가 계획 수립 시 작성)

## 참고 사항
(Opus가 계획 수립 시 작성)
${relatedAnswers.length > 0 ? `\n## 관련 Q&A\n${relatedAnswers.map(a => `- ${a}`).join("\n")}` : ""}
`;

  const filePath = path.join(getZAgentRoot(), "plans", `${planId}.md`);
  fs.writeFileSync(filePath, content, "utf-8");

  return { planId, filePath };
}

function updatePlan(
  planId: string,
  updates: {
    status?: string;
    todos?: Array<{ description: string; difficulty: "H" | "M" | "L" }>;
    content?: string;
  }
): boolean {
  const filePath = path.join(getZAgentRoot(), "plans", `${planId}.md`);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  let fileContent = fs.readFileSync(filePath, "utf-8");

  // Update status in frontmatter
  if (updates.status) {
    fileContent = fileContent.replace(
      /status: \w+/,
      `status: ${updates.status}`
    );
  }

  // Update todos in frontmatter and content
  if (updates.todos && updates.todos.length > 0) {
    const todoListMd = updates.todos
      .map((t, i) => `${i + 1}. ${t.description} (${t.difficulty})`)
      .join("\n");

    // Replace TODO section
    fileContent = fileContent.replace(
      /## TODO 목록\n[\s\S]*?(?=\n## |$)/,
      `## TODO 목록\n${todoListMd}\n\n`
    );
  }

  // Append or replace content sections
  if (updates.content) {
    // Find where to insert (after frontmatter and title)
    const frontmatterEnd = fileContent.indexOf("---", 3) + 3;
    const titleEnd = fileContent.indexOf("\n## ", frontmatterEnd);

    if (titleEnd > 0) {
      fileContent = fileContent.substring(0, titleEnd) + "\n" + updates.content;
    } else {
      fileContent += "\n" + updates.content;
    }
  }

  fs.writeFileSync(filePath, fileContent, "utf-8");
  return true;
}

function getPlan(planId: string): { plan: PlanMeta | null; content: string } {
  const filePath = path.join(getZAgentRoot(), "plans", `${planId}.md`);

  if (!fs.existsSync(filePath)) {
    return { plan: null, content: "" };
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");

  // Parse frontmatter
  const titleMatch = fileContent.match(/title: "(.+)"/);
  const descMatch = fileContent.match(/description: "(.+)"/);
  const statusMatch = fileContent.match(/status: (\w+)/);
  const difficultyMatch = fileContent.match(/difficulty: ([HML])/);
  const linkedTasksMatch = fileContent.match(/linkedTasks: \[(.*)\]/);

  // Parse TODOs from content
  const todoSection = fileContent.match(/## TODO 목록\n([\s\S]*?)(?=\n## |$)/);
  const todos: Array<{ description: string; difficulty: "H" | "M" | "L" }> = [];

  if (todoSection) {
    const todoLines = todoSection[1].match(/\d+\. (.+) \(([HML])\)/g) || [];
    for (const line of todoLines) {
      const match = line.match(/\d+\. (.+) \(([HML])\)/);
      if (match) {
        todos.push({
          description: match[1],
          difficulty: match[2] as "H" | "M" | "L",
        });
      }
    }
  }

  const plan: PlanMeta = {
    planId,
    title: titleMatch?.[1] || "",
    description: descMatch?.[1] || "",
    createdAt: "",
    status: (statusMatch?.[1] as PlanMeta["status"]) || "draft",
    difficulty: (difficultyMatch?.[1] as "H" | "M" | "L") || "M",
    linkedTasks: linkedTasksMatch?.[1]
      ? linkedTasksMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)
      : [],
    todos,
  };

  return { plan, content: fileContent };
}

function listPlans(): Array<{ planId: string; title: string; status: string; difficulty: string }> {
  const plansDir = path.join(getZAgentRoot(), "plans");

  if (!fs.existsSync(plansDir)) {
    return [];
  }

  const files = fs.readdirSync(plansDir).filter((f) => f.match(/^PLAN-\d+\.md$/));
  const plans: Array<{ planId: string; title: string; status: string; difficulty: string }> = [];

  for (const file of files) {
    const planId = file.replace(".md", "");
    const { plan } = getPlan(planId);
    if (plan) {
      plans.push({
        planId: plan.planId,
        title: plan.title,
        status: plan.status,
        difficulty: plan.difficulty,
      });
    }
  }

  return plans.sort((a, b) => b.planId.localeCompare(a.planId));
}

function linkPlanToTask(planId: string, taskId: string): boolean {
  const filePath = path.join(getZAgentRoot(), "plans", `${planId}.md`);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  let content = fs.readFileSync(filePath, "utf-8");

  // Update linkedTasks in frontmatter
  const linkedMatch = content.match(/linkedTasks: \[(.*)\]/);
  if (linkedMatch) {
    const existing = linkedMatch[1]
      ? linkedMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)
      : [];

    if (!existing.includes(taskId)) {
      existing.push(taskId);
      const newLinked = existing.map((t) => `"${t}"`).join(", ");
      content = content.replace(/linkedTasks: \[.*\]/, `linkedTasks: [${newLinked}]`);
      fs.writeFileSync(filePath, content, "utf-8");
    }
  }

  // Update plan status to in_progress
  content = content.replace(/status: (draft|ready)/, "status: in_progress");
  fs.writeFileSync(filePath, content, "utf-8");

  return true;
}

// Get a specific answer by ID
function getAnswer(answerId: string): {
  answer: {
    answerId: string;
    question: string;
    summary: string;
    createdAt: string;
    relatedLessons: string[];
    relatedFiles: string[];
    relatedPlans: string[];
    relatedTasks: string[];
  } | null;
  content: string;
} {
  const filePath = path.join(getZAgentRoot(), "answers", `${answerId}.md`);

  if (!fs.existsSync(filePath)) {
    return { answer: null, content: "" };
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");

  const questionMatch = fileContent.match(/question:\s*"(.+?)"/);
  const summaryMatch = fileContent.match(/summary:\s*"(.+?)"/);
  const createdAtMatch = fileContent.match(/createdAt:\s*(.+)/);
  const relatedLessonsMatch = fileContent.match(/relatedLessons:\s*\[(.*)\]/);
  const relatedFilesMatch = fileContent.match(/relatedFiles:\s*\[(.*)\]/);
  const relatedPlansMatch = fileContent.match(/relatedPlans:\s*\[(.*)\]/);
  const relatedTasksMatch = fileContent.match(/relatedTasks:\s*\[(.*)\]/);

  // Extract full answer from content
  const answerSection = fileContent.match(/# 답변\n([\s\S]*?)(?=\n# |$)/);

  const answer = {
    answerId,
    question: questionMatch?.[1] || "",
    summary: summaryMatch?.[1] || "",
    createdAt: createdAtMatch?.[1] || "",
    relatedLessons: relatedLessonsMatch?.[1]
      ? relatedLessonsMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)
      : [],
    relatedFiles: relatedFilesMatch?.[1]
      ? relatedFilesMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)
      : [],
    relatedPlans: relatedPlansMatch?.[1]
      ? relatedPlansMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)
      : [],
    relatedTasks: relatedTasksMatch?.[1]
      ? relatedTasksMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)
      : [],
  };

  return { answer, content: fileContent };
}

// Link an answer to a plan (bidirectional)
function linkAnswerToPlan(answerId: string, planId: string): boolean {
  const answerPath = path.join(getZAgentRoot(), "answers", `${answerId}.md`);
  const planPath = path.join(getZAgentRoot(), "plans", `${planId}.md`);

  if (!fs.existsSync(answerPath) || !fs.existsSync(planPath)) {
    return false;
  }

  // Update answer's relatedPlans
  let answerContent = fs.readFileSync(answerPath, "utf-8");
  const answerPlansMatch = answerContent.match(/relatedPlans:\s*\[(.*)\]/);
  if (answerPlansMatch) {
    const existing = answerPlansMatch[1]
      ? answerPlansMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)
      : [];
    if (!existing.includes(planId)) {
      existing.push(planId);
      const newPlans = existing.map((p) => `"${p}"`).join(", ");
      answerContent = answerContent.replace(/relatedPlans:\s*\[.*\]/, `relatedPlans: [${newPlans}]`);
      fs.writeFileSync(answerPath, answerContent, "utf-8");
    }
  }

  // Update plan's relatedAnswers
  let planContent = fs.readFileSync(planPath, "utf-8");
  const planAnswersMatch = planContent.match(/relatedAnswers:\s*\[(.*)\]/);
  if (planAnswersMatch) {
    const existing = planAnswersMatch[1]
      ? planAnswersMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)
      : [];
    if (!existing.includes(answerId)) {
      existing.push(answerId);
      const newAnswers = existing.map((a) => `"${a}"`).join(", ");
      planContent = planContent.replace(/relatedAnswers:\s*\[.*\]/, `relatedAnswers: [${newAnswers}]`);
      fs.writeFileSync(planPath, planContent, "utf-8");
    }
  } else {
    // Add relatedAnswers field if it doesn't exist
    planContent = planContent.replace(
      /linkedTasks:\s*\[(.*)\]/,
      `linkedTasks: [$1]\nrelatedAnswers: ["${answerId}"]`
    );
    fs.writeFileSync(planPath, planContent, "utf-8");
  }

  return true;
}

// Link an answer to a task (bidirectional)
function linkAnswerToTask(answerId: string, taskId: string): boolean {
  const answerPath = path.join(getZAgentRoot(), "answers", `${answerId}.md`);
  const taskPath = path.join(getZAgentRoot(), "tasks", `${taskId}.md`);

  if (!fs.existsSync(answerPath) || !fs.existsSync(taskPath)) {
    return false;
  }

  // Update answer's relatedTasks
  let answerContent = fs.readFileSync(answerPath, "utf-8");
  const answerTasksMatch = answerContent.match(/relatedTasks:\s*\[(.*)\]/);
  if (answerTasksMatch) {
    const existing = answerTasksMatch[1]
      ? answerTasksMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)
      : [];
    if (!existing.includes(taskId)) {
      existing.push(taskId);
      const newTasks = existing.map((t) => `"${t}"`).join(", ");
      answerContent = answerContent.replace(/relatedTasks:\s*\[.*\]/, `relatedTasks: [${newTasks}]`);
      fs.writeFileSync(answerPath, answerContent, "utf-8");
    }
  }

  // Update task's relatedAnswers (add field if not exists)
  let taskContent = fs.readFileSync(taskPath, "utf-8");
  const taskAnswersMatch = taskContent.match(/relatedAnswers:\s*\[(.*)\]/);
  if (taskAnswersMatch) {
    const existing = taskAnswersMatch[1]
      ? taskAnswersMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)
      : [];
    if (!existing.includes(answerId)) {
      existing.push(answerId);
      const newAnswers = existing.map((a) => `"${a}"`).join(", ");
      taskContent = taskContent.replace(/relatedAnswers:\s*\[.*\]/, `relatedAnswers: [${newAnswers}]`);
      fs.writeFileSync(taskPath, taskContent, "utf-8");
    }
  } else {
    // Add relatedAnswers field after relatedLessons
    taskContent = taskContent.replace(
      /relatedLessons:\s*\[(.*)\]/,
      `relatedLessons: [$1]\nrelatedAnswers: ["${answerId}"]`
    );
    fs.writeFileSync(taskPath, taskContent, "utf-8");
  }

  return true;
}

// Get related items for an entity (answer, plan, task)
function getRelatedItems(entityType: "answer" | "plan" | "task", entityId: string): {
  answers: string[];
  plans: string[];
  tasks: string[];
  lessons: string[];
} {
  const result = { answers: [] as string[], plans: [] as string[], tasks: [] as string[], lessons: [] as string[] };

  if (entityType === "answer") {
    const { answer } = getAnswer(entityId);
    if (answer) {
      result.plans = answer.relatedPlans;
      result.tasks = answer.relatedTasks;
      result.lessons = answer.relatedLessons;
    }
  } else if (entityType === "plan") {
    const { plan } = getPlan(entityId);
    if (plan) {
      result.tasks = plan.linkedTasks;
      // Parse relatedAnswers from file
      const filePath = path.join(getZAgentRoot(), "plans", `${entityId}.md`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        const answersMatch = content.match(/relatedAnswers:\s*\[(.*)\]/);
        if (answersMatch?.[1]) {
          result.answers = answersMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
        }
      }
    }
  } else if (entityType === "task") {
    const { task } = getTaskStatus(entityId);
    if (task) {
      result.lessons = task.relatedLessons;
      // Parse relatedAnswers from file
      const filePath = path.join(getZAgentRoot(), "tasks", `${entityId}.md`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        const answersMatch = content.match(/relatedAnswers:\s*\[(.*)\]/);
        if (answersMatch?.[1]) {
          result.answers = answersMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
        }
      }
    }
  }

  return result;
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

// List all tasks with optional status filter
function listTasks(status?: string): Array<{
  taskId: string;
  taskDesc: string;
  status: string;
  difficulty: string;
  todoProgress: string;
  currentTodo?: string;
}> {
  const tasksDir = path.join(getZAgentRoot(), "tasks");

  if (!fs.existsSync(tasksDir)) {
    return [];
  }

  const files = fs.readdirSync(tasksDir).filter((f) => f.match(/^task-\d+\.md$/));
  const tasks: Array<{
    taskId: string;
    taskDesc: string;
    status: string;
    difficulty: string;
    todoProgress: string;
    currentTodo?: string;
  }> = [];

  for (const file of files) {
    const taskId = file.replace(".md", "");
    const { task, todos } = getTaskStatus(taskId);

    if (!task) continue;
    if (status && task.status !== status) continue;

    const completedCount = todos.filter(
      (t) => t.status === "complete" || t.status === "completed"
    ).length;
    const totalCount = todos.length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const inProgressTodo = todos.find((t) => t.status === "in_progress");

    tasks.push({
      taskId: task.taskId,
      taskDesc: task.taskDesc,
      status: task.status,
      difficulty: task.difficulty,
      todoProgress: `${completedCount}/${totalCount} (${progress}%)`,
      currentTodo: inProgressTodo?.description,
    });
  }

  return tasks.sort((a, b) => b.taskId.localeCompare(a.taskId));
}

// List all answers with optional keyword filter
function listAnswers(keyword?: string): Array<{
  answerId: string;
  question: string;
  summary: string;
  createdAt: string;
  relatedLessons: string[];
  relatedFiles: string[];
}> {
  const answersDir = path.join(getZAgentRoot(), "answers");

  if (!fs.existsSync(answersDir)) {
    return [];
  }

  const files = fs.readdirSync(answersDir).filter((f) => f.match(/^answer-\d+\.md$/));
  const answers: Array<{
    answerId: string;
    question: string;
    summary: string;
    createdAt: string;
    relatedLessons: string[];
    relatedFiles: string[];
  }> = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(answersDir, file), "utf-8");
    const answerId = file.replace(".md", "");

    const questionMatch = content.match(/question:\s*"(.+?)"/);
    const summaryMatch = content.match(/summary:\s*"(.+?)"/);
    const createdAtMatch = content.match(/createdAt:\s*(.+)/);
    const relatedLessonsMatch = content.match(/relatedLessons:\s*\[(.*)\]/);
    const relatedFilesMatch = content.match(/relatedFiles:\s*\[(.*)\]/);

    const question = questionMatch?.[1] || "";
    const summary = summaryMatch?.[1] || "";

    // Apply keyword filter
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      if (!question.toLowerCase().includes(lowerKeyword) &&
          !summary.toLowerCase().includes(lowerKeyword)) {
        continue;
      }
    }

    const relatedLessons = relatedLessonsMatch?.[1]
      ? relatedLessonsMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)
      : [];
    const relatedFiles = relatedFilesMatch?.[1]
      ? relatedFilesMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)
      : [];

    answers.push({
      answerId,
      question,
      summary,
      createdAt: createdAtMatch?.[1] || "",
      relatedLessons,
      relatedFiles,
    });
  }

  return answers.sort((a, b) => b.answerId.localeCompare(a.answerId));
}

// List all lessons with optional category filter
function listLessons(category?: string): Array<{
  lessonId: string;
  category: string;
  tags: string[];
  summary: string;
  useCount: number;
}> {
  const lessonsDir = path.join(getZAgentRoot(), "lessons");

  if (!fs.existsSync(lessonsDir)) {
    return [];
  }

  const files = fs.readdirSync(lessonsDir).filter((f) => f.match(/^lesson-\d+\.md$/));
  const lessons: Array<{
    lessonId: string;
    category: string;
    tags: string[];
    summary: string;
    useCount: number;
  }> = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(lessonsDir, file), "utf-8");
    const lessonId = file.replace(".md", "");

    const categoryMatch = content.match(/category:\s*(\S+)/);
    const lessonCategory = categoryMatch?.[1] || "unknown";

    if (category && lessonCategory !== category) continue;

    const tagsMatch = content.match(/tags:\s*\n((?:\s*-\s*.+\n)+)/);
    const tags = tagsMatch?.[1]?.match(/-\s*(.+)/g)?.map((t) => t.replace(/^-\s*/, "").trim()) || [];

    const problemMatch = content.match(/# 문제 상황\n([\s\S]*?)(?=\n#|$)/);
    const summary = problemMatch?.[1]?.trim().slice(0, 100) || "";

    const useCountMatch = content.match(/useCount:\s*(\d+)/);
    const useCount = parseInt(useCountMatch?.[1] || "0");

    lessons.push({
      lessonId,
      category: lessonCategory,
      tags,
      summary,
      useCount,
    });
  }

  return lessons.sort((a, b) => b.lessonId.localeCompare(a.lessonId));
}

// Unified query for tasks, plans, lessons, and answers
function queryAll(options: {
  type?: "all" | "tasks" | "plans" | "lessons" | "answers";
  keyword?: string;
  status?: string;
  category?: string;
}): {
  tasks?: ReturnType<typeof listTasks>;
  plans?: ReturnType<typeof listPlans>;
  lessons?: ReturnType<typeof listLessons>;
  answers?: ReturnType<typeof listAnswers>;
  summary: {
    taskCount: number;
    planCount: number;
    lessonCount: number;
    answerCount: number;
    tasksByStatus?: Record<string, number>;
    plansByStatus?: Record<string, number>;
  };
} {
  const { type = "all", keyword, status, category } = options;
  const result: ReturnType<typeof queryAll> = {
    summary: {
      taskCount: 0,
      planCount: 0,
      lessonCount: 0,
      answerCount: 0,
    },
  };

  // Get tasks
  if (type === "all" || type === "tasks") {
    let tasks = listTasks(status);

    if (keyword) {
      tasks = tasks.filter(
        (t) =>
          t.taskId.toLowerCase().includes(keyword.toLowerCase()) ||
          t.taskDesc.toLowerCase().includes(keyword.toLowerCase())
      );
    }

    result.tasks = tasks;
    result.summary.taskCount = tasks.length;

    if (type === "all") {
      const allTasks = listTasks();
      result.summary.tasksByStatus = allTasks.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }
  }

  // Get plans
  if (type === "all" || type === "plans") {
    let plans = listPlans();

    if (status) {
      plans = plans.filter((p) => p.status === status);
    }

    if (keyword) {
      plans = plans.filter(
        (p) =>
          p.planId.toLowerCase().includes(keyword.toLowerCase()) ||
          p.title.toLowerCase().includes(keyword.toLowerCase())
      );
    }

    result.plans = plans;
    result.summary.planCount = plans.length;

    if (type === "all") {
      const allPlans = listPlans();
      result.summary.plansByStatus = allPlans.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }
  }

  // Get lessons
  if (type === "all" || type === "lessons") {
    let lessons = listLessons(category);

    if (keyword) {
      lessons = lessons.filter(
        (l) =>
          l.lessonId.toLowerCase().includes(keyword.toLowerCase()) ||
          l.summary.toLowerCase().includes(keyword.toLowerCase()) ||
          l.tags.some((t) => t.toLowerCase().includes(keyword.toLowerCase()))
      );
    }

    result.lessons = lessons;
    result.summary.lessonCount = lessons.length;
  }

  // Get answers
  if (type === "all" || type === "answers") {
    const answers = listAnswers(keyword);
    result.answers = answers;
    result.summary.answerCount = answers.length;
  }

  return result;
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
  {
    name: "z_create_plan",
    description: "새로운 Plan을 생성합니다. /planning 명령어에서 사용됩니다. Answer를 참조하여 계획을 수립할 수 있습니다.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Plan 제목",
        },
        description: {
          type: "string",
          description: "Plan 설명",
        },
        relatedAnswers: {
          type: "array",
          items: { type: "string" },
          description: "참조할 Answer ID 목록 (예: answer-001). /ask 결과를 기반으로 계획 수립 시 사용",
        },
      },
      required: ["title", "description"],
    },
  },
  {
    name: "z_update_plan",
    description: "Plan 내용을 업데이트합니다. Opus가 계획 수립 후 호출합니다.",
    inputSchema: {
      type: "object",
      properties: {
        planId: {
          type: "string",
          description: "Plan ID (예: PLAN-001)",
        },
        status: {
          type: "string",
          enum: ["draft", "ready", "in_progress", "completed", "cancelled"],
          description: "Plan 상태",
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
          description: "TODO 목록",
        },
        content: {
          type: "string",
          description: "Plan 본문 내용 (목표, 전략 등)",
        },
      },
      required: ["planId"],
    },
  },
  {
    name: "z_get_plan",
    description: "Plan 내용을 조회합니다. /task에서 Plan 기반 작업 시 사용합니다.",
    inputSchema: {
      type: "object",
      properties: {
        planId: {
          type: "string",
          description: "Plan ID (예: PLAN-001)",
        },
      },
      required: ["planId"],
    },
  },
  {
    name: "z_list_plans",
    description: "모든 Plan 목록을 조회합니다.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "z_link_plan_to_task",
    description: "Plan과 Task를 연결합니다. Plan 기반으로 Task 생성 시 호출합니다.",
    inputSchema: {
      type: "object",
      properties: {
        planId: {
          type: "string",
          description: "Plan ID",
        },
        taskId: {
          type: "string",
          description: "Task ID",
        },
      },
      required: ["planId", "taskId"],
    },
  },
  {
    name: "z_list_tasks",
    description: "모든 Task 목록을 조회합니다. 상태별 필터링을 지원합니다.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending", "in_progress", "completed", "cancelled", "blocked"],
          description: "필터링할 상태 (선택사항)",
        },
      },
      required: [],
    },
  },
  {
    name: "z_list_lessons",
    description: "모든 Lesson 목록을 조회합니다. 카테고리별 필터링을 지원합니다.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["performance", "security", "architecture", "debugging", "best-practice"],
          description: "필터링할 카테고리 (선택사항)",
        },
      },
      required: [],
    },
  },
  {
    name: "z_list_answers",
    description: "저장된 Q&A 답변 목록을 조회합니다. 키워드로 필터링할 수 있습니다.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "검색 키워드 (선택사항, 질문/요약에서 검색)",
        },
      },
      required: [],
    },
  },
  {
    name: "z_query",
    description: "Task, Plan, Lesson, Answer를 통합 검색합니다. /list 명령어에서 사용됩니다.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["all", "tasks", "plans", "lessons", "answers"],
          description: "검색 대상 (기본값: all)",
        },
        keyword: {
          type: "string",
          description: "검색 키워드 (선택사항)",
        },
        status: {
          type: "string",
          description: "상태 필터 (Task, Plan용)",
        },
        category: {
          type: "string",
          description: "카테고리 필터 (Lesson용)",
        },
      },
      required: [],
    },
  },
  {
    name: "z_save_answer",
    description:
      "질문에 대한 답변을 저장하고 요약만 반환합니다. Context 절약을 위해 answer_file_path를 사용하세요 - Write 툴로 먼저 .z-agent/temp/answer_draft.md에 답변을 저장한 후 파일 경로만 전달하면 됩니다.",
    inputSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "사용자의 원래 질문",
        },
        answer_file_path: {
          type: "string",
          description:
            "답변이 저장된 파일 경로 (권장). Context 절약을 위해 answer 대신 사용하세요.",
        },
        answer: {
          type: "string",
          description:
            "전체 답변 내용 (비권장 - Context 소모가 큼. answer_file_path 사용 권장)",
        },
        summary: {
          type: "string",
          description: "답변 요약 (1-2문장)",
        },
        relatedLessons: {
          type: "array",
          items: { type: "string" },
          description: "관련 Lesson ID 목록",
        },
        relatedFiles: {
          type: "array",
          items: { type: "string" },
          description: "참조한 파일 목록",
        },
        relatedPlans: {
          type: "array",
          items: { type: "string" },
          description: "관련 Plan ID 목록 (예: PLAN-001)",
        },
        relatedTasks: {
          type: "array",
          items: { type: "string" },
          description: "관련 Task ID 목록 (예: task-001)",
        },
      },
      required: ["question", "summary"],
    },
  },
  {
    name: "z_get_answer",
    description: "특정 Answer의 상세 내용을 조회합니다. 관련된 Plan, Task, Lesson 참조 정보도 포함됩니다.",
    inputSchema: {
      type: "object",
      properties: {
        answerId: {
          type: "string",
          description: "Answer ID (예: answer-001)",
        },
      },
      required: ["answerId"],
    },
  },
  {
    name: "z_link_answer_to_plan",
    description: "Answer와 Plan을 양방향으로 연결합니다. /ask 결과를 /planning에서 참조할 때 사용합니다.",
    inputSchema: {
      type: "object",
      properties: {
        answerId: {
          type: "string",
          description: "Answer ID (예: answer-001)",
        },
        planId: {
          type: "string",
          description: "Plan ID (예: PLAN-001)",
        },
      },
      required: ["answerId", "planId"],
    },
  },
  {
    name: "z_link_answer_to_task",
    description: "Answer와 Task를 양방향으로 연결합니다. /ask 결과를 /task에서 참조할 때 사용합니다.",
    inputSchema: {
      type: "object",
      properties: {
        answerId: {
          type: "string",
          description: "Answer ID (예: answer-001)",
        },
        taskId: {
          type: "string",
          description: "Task ID (예: task-001)",
        },
      },
      required: ["answerId", "taskId"],
    },
  },
  {
    name: "z_get_related",
    description: "특정 엔티티(Answer, Plan, Task)와 연결된 모든 관련 항목을 조회합니다.",
    inputSchema: {
      type: "object",
      properties: {
        entityType: {
          type: "string",
          enum: ["answer", "plan", "task"],
          description: "엔티티 유형",
        },
        entityId: {
          type: "string",
          description: "엔티티 ID (예: answer-001, PLAN-001, task-001)",
        },
      },
      required: ["entityType", "entityId"],
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

      case "z_create_plan": {
        const relatedAnswers = (args.relatedAnswers as string[]) || [];
        const result = createPlan(
          args.title as string,
          args.description as string,
          relatedAnswers
        );

        // Bidirectionally link answers to plan
        for (const answerId of relatedAnswers) {
          linkAnswerToPlan(answerId, result.planId);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                planId: result.planId,
                filePath: result.filePath,
                relatedAnswers: relatedAnswers.length > 0 ? relatedAnswers : undefined,
                message: `✅ ${result.planId} 생성됨${relatedAnswers.length > 0 ? ` (${relatedAnswers.join(", ")} 참조)` : ""}`,
              }, null, 2),
            },
          ],
        };
      }

      case "z_update_plan": {
        const success = updatePlan(
          args.planId as string,
          {
            status: args.status as string | undefined,
            todos: args.todos as Array<{ description: string; difficulty: "H" | "M" | "L" }> | undefined,
            content: args.content as string | undefined,
          }
        );
        return {
          content: [
            {
              type: "text",
              text: success
                ? `✅ ${args.planId} 업데이트됨`
                : `❌ ${args.planId} 업데이트 실패`,
            },
          ],
          isError: !success,
        };
      }

      case "z_get_plan": {
        const result = getPlan(args.planId as string);
        if (!result.plan) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Plan 없음: ${args.planId}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                plan: result.plan,
                content: result.content,
              }, null, 2),
            },
          ],
        };
      }

      case "z_list_plans": {
        const plans = listPlans();
        if (plans.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "등록된 Plan이 없습니다.",
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: plans
                .map((p) => `${p.planId}: ${p.title} [${p.status}] (${p.difficulty})`)
                .join("\n"),
            },
          ],
        };
      }

      case "z_link_plan_to_task": {
        const success = linkPlanToTask(
          args.planId as string,
          args.taskId as string
        );
        return {
          content: [
            {
              type: "text",
              text: success
                ? `✅ ${args.planId} ↔ ${args.taskId} 연결됨`
                : `❌ 연결 실패: ${args.planId}`,
            },
          ],
          isError: !success,
        };
      }

      case "z_list_tasks": {
        const tasks = listTasks(args.status as string | undefined);
        if (tasks.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: args.status
                  ? `${args.status} 상태의 Task가 없습니다.`
                  : "등록된 Task가 없습니다.",
              },
            ],
          };
        }

        const header = `## Tasks (${tasks.length}개)${args.status ? ` - ${args.status}` : ""}\n\n`;
        const table = tasks
          .map((t) => {
            const emoji = STATUS_EMOJI[t.status] || "⏳";
            return `| ${t.taskId} | ${t.taskDesc.slice(0, 30)}${t.taskDesc.length > 30 ? "..." : ""} | ${emoji} ${t.status} | ${t.difficulty} | ${t.todoProgress} |${t.currentTodo ? ` ${t.currentTodo.slice(0, 20)}...` : ""}`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: header + "| ID | 설명 | 상태 | 난이도 | 진행률 |\n|---|---|---|---|---|\n" + table,
            },
          ],
        };
      }

      case "z_list_lessons": {
        const lessons = listLessons(args.category as string | undefined);
        if (lessons.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: args.category
                  ? `${args.category} 카테고리의 Lesson이 없습니다.`
                  : "등록된 Lesson이 없습니다.",
              },
            ],
          };
        }

        const header = `## Lessons (${lessons.length}개)${args.category ? ` - ${args.category}` : ""}\n\n`;
        const table = lessons
          .map((l) => {
            const tagsStr = l.tags.slice(0, 3).join(", ");
            return `| ${l.lessonId} | ${l.category} | [${tagsStr}] | ${l.summary.slice(0, 40)}${l.summary.length > 40 ? "..." : ""} |`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: header + "| ID | 카테고리 | 태그 | 요약 |\n|---|---|---|---|\n" + table,
            },
          ],
        };
      }

      case "z_list_answers": {
        const answers = listAnswers(args.keyword as string | undefined);
        if (answers.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: args.keyword
                  ? `"${args.keyword}" 검색 결과가 없습니다.`
                  : "저장된 Q&A 답변이 없습니다.",
              },
            ],
          };
        }

        const header = `## Q&A 답변 (${answers.length}개)${args.keyword ? ` - "${args.keyword}" 검색` : ""}\n\n`;
        const table = answers
          .map((a) => {
            return `| ${a.answerId} | ${a.question.slice(0, 40)}${a.question.length > 40 ? "..." : ""} | ${a.summary.slice(0, 40)}${a.summary.length > 40 ? "..." : ""} |`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: header + "| ID | 질문 | 요약 |\n|---|---|---|\n" + table,
            },
          ],
        };
      }

      case "z_query": {
        const result = queryAll({
          type: (args.type as "all" | "tasks" | "plans" | "lessons" | "answers") || "all",
          keyword: args.keyword as string | undefined,
          status: args.status as string | undefined,
          category: args.category as string | undefined,
        });

        let output = "## 조회 결과\n\n";

        // Summary
        output += "### 요약\n";
        output += `- Tasks: ${result.summary.taskCount}개`;
        if (result.summary.tasksByStatus) {
          const statusParts = Object.entries(result.summary.tasksByStatus)
            .map(([s, c]) => `${s}: ${c}`)
            .join(", ");
          output += ` (${statusParts})`;
        }
        output += "\n";

        output += `- Plans: ${result.summary.planCount}개`;
        if (result.summary.plansByStatus) {
          const statusParts = Object.entries(result.summary.plansByStatus)
            .map(([s, c]) => `${s}: ${c}`)
            .join(", ");
          output += ` (${statusParts})`;
        }
        output += "\n";

        output += `- Lessons: ${result.summary.lessonCount}개\n`;
        output += `- Answers: ${result.summary.answerCount}개\n\n`;

        // Tasks
        if (result.tasks && result.tasks.length > 0) {
          output += "### Tasks\n";
          for (const t of result.tasks.slice(0, 10)) {
            const emoji = STATUS_EMOJI[t.status] || "⏳";
            output += `- ${t.taskId}: ${t.taskDesc.slice(0, 40)} [${emoji} ${t.status}] ${t.todoProgress}\n`;
          }
          if (result.tasks.length > 10) {
            output += `  ... 외 ${result.tasks.length - 10}개\n`;
          }
          output += "\n";
        }

        // Plans
        if (result.plans && result.plans.length > 0) {
          output += "### Plans\n";
          for (const p of result.plans.slice(0, 10)) {
            output += `- ${p.planId}: ${p.title} [${p.status}] (${p.difficulty})\n`;
          }
          if (result.plans.length > 10) {
            output += `  ... 외 ${result.plans.length - 10}개\n`;
          }
          output += "\n";
        }

        // Lessons
        if (result.lessons && result.lessons.length > 0) {
          output += "### Lessons\n";
          for (const l of result.lessons.slice(0, 10)) {
            output += `- ${l.lessonId}: [${l.category}] ${l.summary.slice(0, 40)}\n`;
          }
          if (result.lessons.length > 10) {
            output += `  ... 외 ${result.lessons.length - 10}개\n`;
          }
          output += "\n";
        }

        // Answers
        if (result.answers && result.answers.length > 0) {
          output += "### Q&A Answers\n";
          for (const a of result.answers.slice(0, 10)) {
            output += `- ${a.answerId}: ${a.question.slice(0, 30)}... → ${a.summary.slice(0, 30)}\n`;
          }
          if (result.answers.length > 10) {
            output += `  ... 외 ${result.answers.length - 10}개\n`;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: output,
            },
          ],
        };
      }

      case "z_save_answer": {
        // answer_file_path가 있으면 파일에서 읽고, 없으면 answer 사용
        let answerContent: string;
        if (args.answer_file_path) {
          try {
            answerContent = fs.readFileSync(args.answer_file_path as string, "utf-8");
          } catch {
            return {
              content: [{ type: "text", text: `❌ 파일을 읽을 수 없습니다: ${args.answer_file_path}` }],
            };
          }
        } else if (args.answer) {
          answerContent = args.answer as string;
        } else {
          return {
            content: [{ type: "text", text: "❌ answer 또는 answer_file_path가 필요합니다." }],
          };
        }

        const result = saveAnswer(
          args.question as string,
          answerContent,
          args.summary as string,
          (args.relatedLessons as string[]) || [],
          (args.relatedFiles as string[]) || [],
          (args.relatedPlans as string[]) || [],
          (args.relatedTasks as string[]) || []
        );

        // 임시 파일 삭제
        if (args.answer_file_path) {
          try {
            fs.unlinkSync(args.answer_file_path as string);
          } catch {
            // 삭제 실패해도 무시
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `✅ ${result.answerId} 저장됨\n📝 ${result.summary}`,
            },
          ],
        };
      }

      case "z_get_answer": {
        const result = getAnswer(args.answerId as string);
        if (!result.answer) {
          return {
            content: [
              {
                type: "text",
                text: `❌ Answer 없음: ${args.answerId}`,
              },
            ],
            isError: true,
          };
        }

        const related = getRelatedItems("answer", args.answerId as string);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                answer: result.answer,
                relatedItems: related,
                content: result.content,
              }, null, 2),
            },
          ],
        };
      }

      case "z_link_answer_to_plan": {
        const success = linkAnswerToPlan(
          args.answerId as string,
          args.planId as string
        );
        return {
          content: [
            {
              type: "text",
              text: success
                ? `✅ ${args.answerId} ↔ ${args.planId} 연결됨`
                : `❌ 연결 실패: ${args.answerId} 또는 ${args.planId}를 찾을 수 없음`,
            },
          ],
          isError: !success,
        };
      }

      case "z_link_answer_to_task": {
        const success = linkAnswerToTask(
          args.answerId as string,
          args.taskId as string
        );
        return {
          content: [
            {
              type: "text",
              text: success
                ? `✅ ${args.answerId} ↔ ${args.taskId} 연결됨`
                : `❌ 연결 실패: ${args.answerId} 또는 ${args.taskId}를 찾을 수 없음`,
            },
          ],
          isError: !success,
        };
      }

      case "z_get_related": {
        const related = getRelatedItems(
          args.entityType as "answer" | "plan" | "task",
          args.entityId as string
        );

        let output = `## ${args.entityId} 관련 항목\n\n`;

        if (related.answers.length > 0) {
          output += `### 연결된 Answers\n${related.answers.map(a => `- ${a}`).join("\n")}\n\n`;
        }
        if (related.plans.length > 0) {
          output += `### 연결된 Plans\n${related.plans.map(p => `- ${p}`).join("\n")}\n\n`;
        }
        if (related.tasks.length > 0) {
          output += `### 연결된 Tasks\n${related.tasks.map(t => `- ${t}`).join("\n")}\n\n`;
        }
        if (related.lessons.length > 0) {
          output += `### 연결된 Lessons\n${related.lessons.map(l => `- ${l}`).join("\n")}\n\n`;
        }

        if (related.answers.length === 0 && related.plans.length === 0 &&
            related.tasks.length === 0 && related.lessons.length === 0) {
          output += "연결된 항목 없음\n";
        }

        return {
          content: [
            {
              type: "text",
              text: output,
            },
          ],
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
