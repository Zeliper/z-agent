#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
// Constants
const STATUS_EMOJI = {
    pending: "⏳",
    in_progress: "🔄",
    complete: "✅",
    completed: "✅",
    cancelled: "❌",
    blocked: "🚫",
};
const DIFFICULTY_MODEL_MAP = {
    H: "opus",
    M: "sonnet",
    L: "haiku",
};
// Utility functions
function getZAgentRoot() {
    const cwd = process.cwd();
    return path.join(cwd, ".z-agent");
}
function ensureDirectories() {
    const root = getZAgentRoot();
    const dirs = ["tasks", "lessons", "scripts", "agents", "skills", "templates", "plans", "answers", "temp", "memory"];
    for (const dir of dirs) {
        const dirPath = path.join(root, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
}
// 병렬 처리 그룹 분석 함수
function analyzeParallelGroups(todos) {
    const groups = [];
    const processed = new Set();
    let groupIndex = 1;
    // BFS로 레벨별 그룹화
    const pendingTodos = todos.filter(t => t.status === "pending" || t.status === "in_progress");
    const completed = new Set();
    while (processed.size < pendingTodos.length) {
        // 현재 실행 가능한 TODO들 찾기
        const executable = pendingTodos.filter(t => !processed.has(t.index) &&
            (!t.dependsOn || t.dependsOn.every(dep => completed.has(dep))));
        if (executable.length === 0) {
            // 순환 의존성이 있거나 더 이상 진행 불가
            break;
        }
        // 파일 충돌 없이 병렬 실행 가능한 그룹 찾기
        const parallelGroup = [];
        const usedFiles = new Set();
        for (const todo of executable) {
            // 이미 처리된 TODO 건너뛰기
            if (processed.has(todo.index))
                continue;
            // 파일 충돌 검사
            let hasConflict = false;
            if (todo.targetFiles && todo.targetFiles.length > 0) {
                for (const file of todo.targetFiles) {
                    if (usedFiles.has(file)) {
                        hasConflict = true;
                        break;
                    }
                }
            }
            if (!hasConflict) {
                parallelGroup.push(todo.index);
                if (todo.targetFiles) {
                    todo.targetFiles.forEach(f => usedFiles.add(f));
                }
            }
        }
        if (parallelGroup.length > 0) {
            groups.push({
                groupIndex,
                todos: parallelGroup,
                canRunParallel: parallelGroup.length > 1,
                reason: parallelGroup.length > 1
                    ? "파일 충돌 없음, 병렬 실행 가능"
                    : "단일 작업"
            });
            groupIndex++;
            parallelGroup.forEach(idx => {
                processed.add(idx);
                completed.add(idx);
            });
        }
    }
    return groups;
}
function getNextTaskId() {
    const tasksDir = path.join(getZAgentRoot(), "tasks");
    if (!fs.existsSync(tasksDir)) {
        return "task-001";
    }
    const files = fs.readdirSync(tasksDir).filter((f) => f.match(/^task-\d+\.md$/));
    if (files.length === 0) {
        return "task-001";
    }
    const maxNum = Math.max(...files.map((f) => parseInt(f.match(/task-(\d+)\.md/)?.[1] || "0")));
    return `task-${String(maxNum + 1).padStart(3, "0")}`;
}
function getNextLessonId() {
    const lessonsDir = path.join(getZAgentRoot(), "lessons");
    if (!fs.existsSync(lessonsDir)) {
        return "lesson-001";
    }
    const files = fs.readdirSync(lessonsDir).filter((f) => f.match(/^lesson-\d+\.md$/));
    if (files.length === 0) {
        return "lesson-001";
    }
    const maxNum = Math.max(...files.map((f) => parseInt(f.match(/lesson-(\d+)\.md/)?.[1] || "0")));
    return `lesson-${String(maxNum + 1).padStart(3, "0")}`;
}
function getNextPlanId() {
    const plansDir = path.join(getZAgentRoot(), "plans");
    if (!fs.existsSync(plansDir)) {
        return "PLAN-001";
    }
    const files = fs.readdirSync(plansDir).filter((f) => f.match(/^PLAN-\d+\.md$/));
    if (files.length === 0) {
        return "PLAN-001";
    }
    const maxNum = Math.max(...files.map((f) => parseInt(f.match(/PLAN-(\d+)\.md/)?.[1] || "0")));
    return `PLAN-${String(maxNum + 1).padStart(3, "0")}`;
}
function getNextAnswerId() {
    const answersDir = path.join(getZAgentRoot(), "answers");
    if (!fs.existsSync(answersDir)) {
        return "answer-001";
    }
    const files = fs.readdirSync(answersDir).filter((f) => f.match(/^answer-\d+\.md$/));
    if (files.length === 0) {
        return "answer-001";
    }
    const maxNum = Math.max(...files.map((f) => parseInt(f.match(/answer-(\d+)\.md/)?.[1] || "0")));
    return `answer-${String(maxNum + 1).padStart(3, "0")}`;
}
function saveAnswer(question, answer, summary, relatedLessons = [], relatedFiles = [], relatedPlans = [], relatedTasks = []) {
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
function createPlan(title, description, relatedAnswers = []) {
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
function updatePlan(planId, updates) {
    const filePath = path.join(getZAgentRoot(), "plans", `${planId}.md`);
    if (!fs.existsSync(filePath)) {
        return false;
    }
    let fileContent = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");
    // Update status in frontmatter
    if (updates.status) {
        fileContent = fileContent.replace(/status: \w+/, `status: ${updates.status}`);
    }
    // Update todos in frontmatter and content
    if (updates.todos && updates.todos.length > 0) {
        const todoListMd = updates.todos
            .map((t, i) => `${i + 1}. ${t.description} (${t.difficulty})`)
            .join("\n");
        // Replace TODO section
        fileContent = fileContent.replace(/## TODO 목록\n[\s\S]*?(?=\n## |$)/, `## TODO 목록\n${todoListMd}\n\n`);
    }
    // Append or replace content sections
    if (updates.content) {
        // Find where to insert (after frontmatter and title)
        const frontmatterEnd = fileContent.indexOf("---", 3) + 3;
        const titleEnd = fileContent.indexOf("\n## ", frontmatterEnd);
        if (titleEnd > 0) {
            fileContent = fileContent.substring(0, titleEnd) + "\n" + updates.content;
        }
        else {
            fileContent += "\n" + updates.content;
        }
    }
    fs.writeFileSync(filePath, fileContent, "utf-8");
    return true;
}
function getPlan(planId) {
    const filePath = path.join(getZAgentRoot(), "plans", `${planId}.md`);
    if (!fs.existsSync(filePath)) {
        return { plan: null, content: "" };
    }
    const fileContent = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");
    // Parse frontmatter
    const titleMatch = fileContent.match(/title: "(.+)"/);
    const descMatch = fileContent.match(/description: "(.+)"/);
    const statusMatch = fileContent.match(/status: (\w+)/);
    const difficultyMatch = fileContent.match(/difficulty: ([HML])/);
    const linkedTasksMatch = fileContent.match(/linkedTasks: \[(.*)\]/);
    // Parse TODOs from content
    const todoSection = fileContent.match(/## TODO 목록\n([\s\S]*?)(?=\n## |$)/);
    const todos = [];
    if (todoSection) {
        const todoLines = todoSection[1].match(/\d+\. (.+) \(([HML])\)/g) || [];
        for (const line of todoLines) {
            const match = line.match(/\d+\. (.+) \(([HML])\)/);
            if (match) {
                todos.push({
                    description: match[1],
                    difficulty: match[2],
                });
            }
        }
    }
    const plan = {
        planId,
        title: titleMatch?.[1] || "",
        description: descMatch?.[1] || "",
        createdAt: "",
        status: statusMatch?.[1] || "draft",
        difficulty: difficultyMatch?.[1] || "M",
        linkedTasks: linkedTasksMatch?.[1]
            ? linkedTasksMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)
            : [],
        todos,
    };
    return { plan, content: fileContent };
}
function listPlans() {
    const plansDir = path.join(getZAgentRoot(), "plans");
    if (!fs.existsSync(plansDir)) {
        return [];
    }
    const files = fs.readdirSync(plansDir).filter((f) => f.match(/^PLAN-\d+\.md$/));
    const plans = [];
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
function linkPlanToTask(planId, taskId) {
    const filePath = path.join(getZAgentRoot(), "plans", `${planId}.md`);
    if (!fs.existsSync(filePath)) {
        return false;
    }
    let content = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");
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
function getAnswer(answerId) {
    const filePath = path.join(getZAgentRoot(), "answers", `${answerId}.md`);
    if (!fs.existsSync(filePath)) {
        return { answer: null, content: "" };
    }
    const fileContent = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");
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
function linkAnswerToPlan(answerId, planId) {
    const answerPath = path.join(getZAgentRoot(), "answers", `${answerId}.md`);
    const planPath = path.join(getZAgentRoot(), "plans", `${planId}.md`);
    if (!fs.existsSync(answerPath) || !fs.existsSync(planPath)) {
        return false;
    }
    // Update answer's relatedPlans
    let answerContent = fs.readFileSync(answerPath, "utf-8").replace(/\r\n/g, "\n");
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
    let planContent = fs.readFileSync(planPath, "utf-8").replace(/\r\n/g, "\n");
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
    }
    else {
        // Add relatedAnswers field if it doesn't exist
        planContent = planContent.replace(/linkedTasks:\s*\[(.*)\]/, `linkedTasks: [$1]\nrelatedAnswers: ["${answerId}"]`);
        fs.writeFileSync(planPath, planContent, "utf-8");
    }
    return true;
}
// Link an answer to a task (bidirectional)
function linkAnswerToTask(answerId, taskId) {
    const answerPath = path.join(getZAgentRoot(), "answers", `${answerId}.md`);
    const taskPath = path.join(getZAgentRoot(), "tasks", `${taskId}.md`);
    if (!fs.existsSync(answerPath) || !fs.existsSync(taskPath)) {
        return false;
    }
    // Update answer's relatedTasks
    let answerContent = fs.readFileSync(answerPath, "utf-8").replace(/\r\n/g, "\n");
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
    let taskContent = fs.readFileSync(taskPath, "utf-8").replace(/\r\n/g, "\n");
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
    }
    else {
        // Add relatedAnswers field after relatedLessons
        taskContent = taskContent.replace(/relatedLessons:\s*\[(.*)\]/, `relatedLessons: [$1]\nrelatedAnswers: ["${answerId}"]`);
        fs.writeFileSync(taskPath, taskContent, "utf-8");
    }
    return true;
}
// Get related items for an entity (answer, plan, task)
function getRelatedItems(entityType, entityId) {
    const result = { answers: [], plans: [], tasks: [], lessons: [] };
    if (entityType === "answer") {
        const { answer } = getAnswer(entityId);
        if (answer) {
            result.plans = answer.relatedPlans;
            result.tasks = answer.relatedTasks;
            result.lessons = answer.relatedLessons;
        }
    }
    else if (entityType === "plan") {
        const { plan } = getPlan(entityId);
        if (plan) {
            result.tasks = plan.linkedTasks;
            // Parse relatedAnswers from file
            const filePath = path.join(getZAgentRoot(), "plans", `${entityId}.md`);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");
                const answersMatch = content.match(/relatedAnswers:\s*\[(.*)\]/);
                if (answersMatch?.[1]) {
                    result.answers = answersMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
                }
            }
        }
    }
    else if (entityType === "task") {
        const { task } = getTaskStatus(entityId);
        if (task) {
            result.lessons = task.relatedLessons;
            // Parse relatedAnswers from file
            const filePath = path.join(getZAgentRoot(), "tasks", `${entityId}.md`);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");
                const answersMatch = content.match(/relatedAnswers:\s*\[(.*)\]/);
                if (answersMatch?.[1]) {
                    result.answers = answersMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
                }
            }
        }
    }
    return result;
}
function analyzeDifficulty(input) {
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
    const foundKeywords = [];
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
    }
    else if (mediumScore >= lowScore) {
        return {
            difficulty: "M",
            confidence: mediumScore / totalScore,
            reasoning: `일반 작업 키워드 발견: ${foundKeywords.slice(0, 3).join(", ")}`,
            suggestedModel: "sonnet",
            keywords: foundKeywords,
        };
    }
    else {
        return {
            difficulty: "L",
            confidence: lowScore / totalScore,
            reasoning: `간단한 작업 키워드 발견: ${foundKeywords.slice(0, 3).join(", ")}`,
            suggestedModel: "haiku",
            keywords: foundKeywords,
        };
    }
}
function createTodoTemplateFile(taskId, todo, createdAt) {
    const taskFolder = path.join(getZAgentRoot(), taskId);
    const todoFileName = `todo-${String(todo.index).padStart(3, "0")}.md`;
    const todoFilePath = path.join(taskFolder, todoFileName);
    const targetFilesStr = todo.targetFiles && todo.targetFiles.length > 0
        ? `[${todo.targetFiles.map(f => `"${f}"`).join(", ")}]`
        : "[]";
    const dependsOnStr = todo.dependsOn && todo.dependsOn.length > 0
        ? `[${todo.dependsOn.join(", ")}]`
        : "[]";
    const content = `---
todoId: ${todo.index}
taskId: ${taskId}
description: ${todo.description}
difficulty: ${todo.difficulty}
status: ${todo.status}
targetFiles: ${targetFilesStr}
dependsOn: ${dependsOnStr}
createdAt: ${createdAt}
updatedAt: ${createdAt}
---
# TODO #${todo.index}: ${todo.description}

**난이도**: ${todo.difficulty} | **상태**: ${STATUS_EMOJI[todo.status]} ${todo.status}

---

## Progress Log

(진행 내역이 여기에 기록됨)

---

## Changed Files

(변경된 파일 목록)

---

## Notes

(추가 메모)
`;
    fs.writeFileSync(todoFilePath, content, "utf-8");
}
function createTaskFile(taskId, description, difficulty, todos, relatedLessons = []) {
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
    // Create individual TODO template files
    for (const todo of todos) {
        createTodoTemplateFile(taskId, todo, now);
    }
    return filePath;
}
function updateTodoFile(taskId, todoIndex, newStatus) {
    const todoFileName = `todo-${String(todoIndex).padStart(3, "0")}.md`;
    const todoFilePath = path.join(getZAgentRoot(), taskId, todoFileName);
    if (!fs.existsSync(todoFilePath)) {
        return false;
    }
    const now = new Date().toISOString();
    let content = fs.readFileSync(todoFilePath, "utf-8").replace(/\r\n/g, "\n");
    const emoji = STATUS_EMOJI[newStatus] || "⏳";
    // Update status in frontmatter
    content = content.replace(/^status: .+$/m, `status: ${newStatus}`);
    content = content.replace(/^updatedAt: .+$/m, `updatedAt: ${now}`);
    // Update status display line (use alternation for emoji surrogate pairs)
    content = content.replace(/\*\*상태\*\*: (⏳|🔄|✅|❌|🚫) \w+/u, `**상태**: ${emoji} ${newStatus}`);
    fs.writeFileSync(todoFilePath, content, "utf-8");
    return true;
}
function updateTodoStatus(taskId, todoIndex, newStatus) {
    const filePath = path.join(getZAgentRoot(), "tasks", `${taskId}.md`);
    if (!fs.existsSync(filePath)) {
        return false;
    }
    let content = fs.readFileSync(filePath, "utf-8");
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    let updated = false;
    // More flexible regex: use alternation for emoji (surrogate pairs issue in char class)
    const todoRegex = /^(⏳|🔄|✅|❌|🚫)\s*-\s*(\d+)\.\s*(.+)\s*\(([HML])\)\s*$/u;
    for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i].trim();
        const match = trimmedLine.match(todoRegex);
        if (match && parseInt(match[2]) === todoIndex) {
            const emoji = STATUS_EMOJI[newStatus] || "⏳";
            lines[i] = `${emoji} - ${match[2]}. ${match[3].trim()} (${match[4]})`;
            updated = true;
            break;
        }
    }
    if (updated) {
        fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
        // Also update the individual TODO file
        updateTodoFile(taskId, todoIndex, newStatus);
    }
    return updated;
}
function getTaskStatus(taskId) {
    const filePath = path.join(getZAgentRoot(), "tasks", `${taskId}.md`);
    if (!fs.existsSync(filePath)) {
        return { task: null, todos: [] };
    }
    const content = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");
    const todos = [];
    // Parse TODOs - use alternation for emoji (surrogate pairs issue in char class)
    const todoRegex = /^(⏳|🔄|✅|❌|🚫)\s*-\s*(\d+)\.\s*(.+)\s*\(([HML])\)\s*$/u;
    const lines = content.split("\n");
    for (const line of lines) {
        const trimmedLine = line.trim();
        const match = trimmedLine.match(todoRegex);
        if (match) {
            const emoji = match[1];
            const status = Object.entries(STATUS_EMOJI).find(([_, e]) => e === emoji)?.[0] || "pending";
            todos.push({
                index: parseInt(match[2]),
                description: match[3].trim(),
                difficulty: match[4],
                status: status,
            });
        }
    }
    // Parse meta
    const taskDescMatch = content.match(/taskDesc:\s*(.+)/);
    const difficultyMatch = content.match(/difficulty:\s*([HML])/);
    const statusMatch = content.match(/status:\s*(\w+)/);
    const task = {
        taskId,
        taskDesc: taskDescMatch?.[1] || "",
        createdAt: "",
        difficulty: difficultyMatch?.[1] || "M",
        status: statusMatch?.[1] || "pending",
        relatedLessons: [],
    };
    return { task, todos };
}
function searchLessons(query, limit = 5) {
    const lessonsDir = path.join(getZAgentRoot(), "lessons");
    if (!fs.existsSync(lessonsDir)) {
        return [];
    }
    const files = fs.readdirSync(lessonsDir).filter((f) => f.match(/^lesson-\d+\.md$/));
    const results = [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);
    for (const file of files) {
        const content = fs.readFileSync(path.join(lessonsDir, file), "utf-8").replace(/\r\n/g, "\n");
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
            if (tags.some(t => t.toLowerCase().includes(word)))
                score += 3;
            if (category.toLowerCase().includes(word))
                score += 2;
            if (content.toLowerCase().includes(word))
                score += 1;
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
function recordLesson(category, problem, solution, tags, relatedTasks = []) {
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
// Get a specific lesson by ID
function getLesson(lessonId) {
    const lessonPath = path.join(getZAgentRoot(), "lessons", `${lessonId}.md`);
    if (!fs.existsSync(lessonPath)) {
        return { found: false };
    }
    const content = fs.readFileSync(lessonPath, "utf-8").replace(/\r\n/g, "\n");
    const categoryMatch = content.match(/category:\s*(\w+)/);
    const tagsMatch = content.match(/tags:\s*\n((?:\s*-\s*.+\n)+)/);
    const problemMatch = content.match(/# 문제 상황\n([\s\S]*?)(?=\n# |$)/);
    const solutionMatch = content.match(/# 해결 방안\n([\s\S]*?)(?=\n# |$)/);
    const conditionsMatch = content.match(/# 적용 조건\n([\s\S]*?)(?=\n# |$)/);
    const warningsMatch = content.match(/# 주의 사항\n([\s\S]*?)(?=\n# |$)/);
    const relatedTasksMatch = content.match(/relatedTasks:\s*\[(.*?)\]/);
    const useCountMatch = content.match(/useCount:\s*(\d+)/);
    const category = categoryMatch?.[1] || "";
    const tags = tagsMatch?.[1]?.match(/-\s*(.+)/g)?.map(t => t.replace(/^-\s*/, "").trim()) || [];
    const problem = problemMatch?.[1]?.trim() || "";
    const solution = solutionMatch?.[1]?.trim() || "";
    const conditions = conditionsMatch?.[1]?.trim();
    const warnings = warningsMatch?.[1]?.trim();
    const relatedTasks = relatedTasksMatch?.[1]?.match(/"([^"]+)"/g)?.map(t => t.replace(/"/g, "")) || [];
    const useCount = parseInt(useCountMatch?.[1] || "0");
    return {
        found: true,
        lesson: {
            lessonId,
            category,
            tags,
            summary: problem.slice(0, 100),
            problem,
            solution,
            conditions,
            warnings,
            relatedTasks,
            useCount
        }
    };
}
// Update an existing lesson
function updateLesson(lessonId, updates) {
    const lessonPath = path.join(getZAgentRoot(), "lessons", `${lessonId}.md`);
    if (!fs.existsSync(lessonPath)) {
        return { success: false, message: `Lesson ${lessonId} not found` };
    }
    let content = fs.readFileSync(lessonPath, "utf-8").replace(/\r\n/g, "\n");
    const now = new Date().toISOString();
    // Update updatedAt
    content = content.replace(/updatedAt:\s*.+/, `updatedAt: ${now}`);
    if (updates.category) {
        content = content.replace(/category:\s*\w+/, `category: ${updates.category}`);
    }
    if (updates.tags) {
        const tagsStr = updates.tags.map(t => `  - ${t}`).join("\n");
        content = content.replace(/tags:\s*\n((?:\s*-\s*.+\n)+)/, `tags:\n${tagsStr}\n`);
    }
    if (updates.relatedTasks) {
        const tasksStr = updates.relatedTasks.map(t => `"${t}"`).join(", ");
        content = content.replace(/relatedTasks:\s*\[.*?\]/, `relatedTasks: [${tasksStr}]`);
    }
    if (updates.problem) {
        content = content.replace(/# 문제 상황\n[\s\S]*?(?=\n# )/, `# 문제 상황\n${updates.problem}\n\n`);
    }
    if (updates.solution) {
        content = content.replace(/# 해결 방안\n[\s\S]*?(?=\n# )/, `# 해결 방안\n${updates.solution}\n\n`);
    }
    if (updates.conditions) {
        content = content.replace(/# 적용 조건\n[\s\S]*?(?=\n# |$)/, `# 적용 조건\n${updates.conditions}\n\n`);
    }
    if (updates.warnings) {
        content = content.replace(/# 주의 사항\n[\s\S]*$/, `# 주의 사항\n${updates.warnings}\n`);
    }
    fs.writeFileSync(lessonPath, content, "utf-8");
    return { success: true, message: `Lesson ${lessonId} updated` };
}
// ===== Memory Functions =====
function getNextMemoryId() {
    const memoryDir = path.join(getZAgentRoot(), "memory");
    if (!fs.existsSync(memoryDir)) {
        return "mem-001";
    }
    const files = fs.readdirSync(memoryDir).filter((f) => f.match(/^mem-\d+\.md$/));
    if (files.length === 0) {
        return "mem-001";
    }
    const maxNum = Math.max(...files.map((f) => parseInt(f.match(/mem-(\d+)\.md/)?.[1] || "0")));
    return `mem-${String(maxNum + 1).padStart(3, "0")}`;
}
function addMemory(content, tags = [], priority = "medium") {
    ensureDirectories();
    const memoryId = getNextMemoryId();
    const now = new Date().toISOString();
    const fileContent = `---
memoryId: ${memoryId}
createdAt: ${now}
updatedAt: ${now}
priority: ${priority}
tags:
${tags.map(t => `  - ${t}`).join("\n") || "  # (none)"}
---

# 내용
${content}
`;
    const filePath = path.join(getZAgentRoot(), "memory", `${memoryId}.md`);
    fs.writeFileSync(filePath, fileContent, "utf-8");
    return { memoryId, filePath };
}
function getMemory(memoryId) {
    const memoryPath = path.join(getZAgentRoot(), "memory", `${memoryId}.md`);
    if (!fs.existsSync(memoryPath)) {
        return { found: false };
    }
    const fileContent = fs.readFileSync(memoryPath, "utf-8").replace(/\r\n/g, "\n");
    const priorityMatch = fileContent.match(/priority:\s*(high|medium|low)/);
    const tagsMatch = fileContent.match(/tags:\s*\n((?:\s*-\s*.+\n)*)/);
    const createdAtMatch = fileContent.match(/createdAt:\s*(.+)/);
    const updatedAtMatch = fileContent.match(/updatedAt:\s*(.+)/);
    const contentMatch = fileContent.match(/# 내용\n([\s\S]*?)$/);
    const priority = (priorityMatch?.[1] || "medium");
    const tags = tagsMatch?.[1]?.match(/-\s*(.+)/g)?.map(t => t.replace(/^-\s*/, "").trim()).filter(t => t && !t.startsWith("#")) || [];
    const createdAt = createdAtMatch?.[1]?.trim() || "";
    const updatedAt = updatedAtMatch?.[1]?.trim() || "";
    const content = contentMatch?.[1]?.trim() || "";
    return {
        found: true,
        memory: {
            memoryId,
            content,
            tags,
            priority,
            createdAt,
            updatedAt
        }
    };
}
function getAllMemories() {
    const memoryDir = path.join(getZAgentRoot(), "memory");
    if (!fs.existsSync(memoryDir)) {
        return [];
    }
    const files = fs.readdirSync(memoryDir).filter((f) => f.match(/^mem-\d+\.md$/));
    const memories = [];
    for (const file of files) {
        const memoryId = file.replace(".md", "");
        const result = getMemory(memoryId);
        if (result.found && result.memory) {
            memories.push(result.memory);
        }
    }
    // Sort by priority (high > medium > low) then by updatedAt
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return memories.sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0)
            return priorityDiff;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}
function updateMemory(memoryId, updates) {
    const memoryPath = path.join(getZAgentRoot(), "memory", `${memoryId}.md`);
    if (!fs.existsSync(memoryPath)) {
        return { success: false, message: `Memory ${memoryId} not found` };
    }
    let fileContent = fs.readFileSync(memoryPath, "utf-8").replace(/\r\n/g, "\n");
    const now = new Date().toISOString();
    // Update updatedAt
    fileContent = fileContent.replace(/updatedAt:\s*.+/, `updatedAt: ${now}`);
    if (updates.priority) {
        fileContent = fileContent.replace(/priority:\s*(high|medium|low)/, `priority: ${updates.priority}`);
    }
    if (updates.tags) {
        const tagsStr = updates.tags.length > 0
            ? updates.tags.map(t => `  - ${t}`).join("\n")
            : "  # (none)";
        fileContent = fileContent.replace(/tags:\s*\n((?:\s*-\s*.+\n)*|(?:\s*#\s*.+\n)*)/, `tags:\n${tagsStr}\n`);
    }
    if (updates.content) {
        fileContent = fileContent.replace(/# 내용\n[\s\S]*$/, `# 내용\n${updates.content}\n`);
    }
    fs.writeFileSync(memoryPath, fileContent, "utf-8");
    return { success: true, message: `Memory ${memoryId} updated` };
}
function deleteMemory(memoryId) {
    const memoryPath = path.join(getZAgentRoot(), "memory", `${memoryId}.md`);
    if (!fs.existsSync(memoryPath)) {
        return { success: false, message: `Memory ${memoryId} not found` };
    }
    fs.unlinkSync(memoryPath);
    return { success: true, message: `Memory ${memoryId} deleted` };
}
function searchMemories(query, limit = 10) {
    const memories = getAllMemories();
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);
    const results = [];
    for (const memory of memories) {
        let score = 0;
        // Priority bonus
        if (memory.priority === "high")
            score += 5;
        else if (memory.priority === "medium")
            score += 2;
        for (const word of queryWords) {
            if (memory.tags.some(t => t.toLowerCase().includes(word)))
                score += 3;
            if (memory.content.toLowerCase().includes(word))
                score += 1;
        }
        if (score > 0) {
            results.push({ ...memory, score });
        }
    }
    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ score, ...rest }) => rest);
}
// Delete a task and its todo directory
function deleteTask(taskId) {
    const deletedFiles = [];
    // Delete task file
    const taskPath = path.join(getZAgentRoot(), "tasks", `${taskId}.md`);
    if (fs.existsSync(taskPath)) {
        fs.unlinkSync(taskPath);
        deletedFiles.push(taskPath);
    }
    // Delete task todo directory
    const todoDir = path.join(getZAgentRoot(), taskId);
    if (fs.existsSync(todoDir)) {
        const files = fs.readdirSync(todoDir);
        for (const file of files) {
            const filePath = path.join(todoDir, file);
            fs.unlinkSync(filePath);
            deletedFiles.push(filePath);
        }
        fs.rmdirSync(todoDir);
        deletedFiles.push(todoDir);
    }
    if (deletedFiles.length === 0) {
        return { success: false, message: `Task ${taskId}를 찾을 수 없습니다.`, deletedFiles: [] };
    }
    return { success: true, message: `Task ${taskId} 삭제 완료`, deletedFiles };
}
// Delete a plan
function deletePlan(planId) {
    const planPath = path.join(getZAgentRoot(), "plans", `${planId}.md`);
    if (!fs.existsSync(planPath)) {
        return { success: false, message: `Plan ${planId}를 찾을 수 없습니다.`, deletedFiles: [] };
    }
    fs.unlinkSync(planPath);
    return { success: true, message: `Plan ${planId} 삭제 완료`, deletedFiles: [planPath] };
}
// Delete an answer
function deleteAnswer(answerId) {
    const answerPath = path.join(getZAgentRoot(), "answers", `${answerId}.md`);
    if (!fs.existsSync(answerPath)) {
        return { success: false, message: `Answer ${answerId}를 찾을 수 없습니다.`, deletedFiles: [] };
    }
    fs.unlinkSync(answerPath);
    return { success: true, message: `Answer ${answerId} 삭제 완료`, deletedFiles: [answerPath] };
}
// Delete a lesson
function deleteLesson(lessonId) {
    const lessonPath = path.join(getZAgentRoot(), "lessons", `${lessonId}.md`);
    if (!fs.existsSync(lessonPath)) {
        return { success: false, message: `Lesson ${lessonId}를 찾을 수 없습니다.`, deletedFiles: [] };
    }
    fs.unlinkSync(lessonPath);
    return { success: true, message: `Lesson ${lessonId} 삭제 완료`, deletedFiles: [lessonPath] };
}
// Get tasks by status with detailed info
function getTasksByStatus(status) {
    const tasksDir = path.join(getZAgentRoot(), "tasks");
    if (!fs.existsSync(tasksDir)) {
        return [];
    }
    const files = fs.readdirSync(tasksDir).filter((f) => f.match(/^task-\d+\.md$/));
    const tasks = [];
    for (const file of files) {
        const content = fs.readFileSync(path.join(tasksDir, file), "utf-8").replace(/\r\n/g, "\n");
        const taskId = file.replace(".md", "");
        const statusMatch = content.match(/status:\s*(\w+)/);
        const taskStatus = statusMatch?.[1] || "pending";
        if (status !== "all" && taskStatus !== status)
            continue;
        const taskDescMatch = content.match(/taskDesc:\s*(.+)/);
        const difficultyMatch = content.match(/difficulty:\s*([HML])/);
        // Count TODOs (use alternation for emoji surrogate pairs)
        const todoMatches = content.matchAll(/^(⏳|🔄|✅|❌|🚫)\s*-\s*\d+\./gmu);
        let total = 0, completed = 0, pending = 0;
        for (const match of todoMatches) {
            total++;
            if (match[1] === "✅")
                completed++;
            else
                pending++;
        }
        // Check for linked plan
        const linkedPlanMatch = content.match(/linkedPlan:\s*"?([^"\n]+)"?/);
        tasks.push({
            taskId,
            taskDesc: taskDescMatch?.[1] || "",
            status: taskStatus,
            difficulty: difficultyMatch?.[1] || "M",
            todoStats: { total, completed, pending },
            linkedPlan: linkedPlanMatch?.[1],
        });
    }
    return tasks.sort((a, b) => a.taskId.localeCompare(b.taskId));
}
// Get plans by status with linked task info
function getPlansByStatus(status) {
    const plansDir = path.join(getZAgentRoot(), "plans");
    if (!fs.existsSync(plansDir)) {
        return [];
    }
    const files = fs.readdirSync(plansDir).filter((f) => f.match(/^PLAN-\d+\.md$/));
    const plans = [];
    for (const file of files) {
        const content = fs.readFileSync(path.join(plansDir, file), "utf-8").replace(/\r\n/g, "\n");
        const planId = file.replace(".md", "");
        const statusMatch = content.match(/status:\s*(\w+)/);
        const planStatus = statusMatch?.[1] || "draft";
        if (status !== "all" && planStatus !== status)
            continue;
        const titleMatch = content.match(/title:\s*"(.+?)"/);
        const difficultyMatch = content.match(/difficulty:\s*([HML])/);
        const linkedTasksMatch = content.match(/linkedTasks:\s*\[(.*)\]/);
        const linkedTasks = linkedTasksMatch?.[1]
            ? linkedTasksMatch[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)
            : [];
        // Check which linked tasks are incomplete
        const incompleteTasks = [];
        for (const taskId of linkedTasks) {
            const taskPath = path.join(getZAgentRoot(), "tasks", `${taskId}.md`);
            if (fs.existsSync(taskPath)) {
                const taskContent = fs.readFileSync(taskPath, "utf-8").replace(/\r\n/g, "\n");
                const taskStatusMatch = taskContent.match(/status:\s*(\w+)/);
                if (taskStatusMatch?.[1] !== "completed") {
                    incompleteTasks.push(taskId);
                }
            }
        }
        plans.push({
            planId,
            title: titleMatch?.[1] || "",
            status: planStatus,
            difficulty: difficultyMatch?.[1] || "M",
            linkedTasks,
            incompleteTasks,
        });
    }
    return plans.sort((a, b) => a.planId.localeCompare(b.planId));
}
// Bulk delete completed tasks
function deleteCompletedTasks() {
    const completedTasks = getTasksByStatus("completed");
    const deletedTasks = [];
    const deletedFiles = [];
    for (const task of completedTasks) {
        const result = deleteTask(task.taskId);
        if (result.success) {
            deletedTasks.push(task.taskId);
            deletedFiles.push(...result.deletedFiles);
        }
    }
    return { deletedTasks, deletedFiles };
}
// Delete plan with linked tasks
function deletePlanWithTasks(planId, deleteLinkedTasks) {
    const { plan } = getPlan(planId);
    if (!plan) {
        return {
            success: false,
            message: `Plan ${planId}를 찾을 수 없습니다.`,
            deletedTasks: [],
            deletedFiles: [],
            skippedTasks: [],
        };
    }
    const deletedTasks = [];
    const deletedFiles = [];
    const skippedTasks = [];
    // Delete linked tasks if requested
    if (deleteLinkedTasks && plan.linkedTasks.length > 0) {
        for (const taskId of plan.linkedTasks) {
            const result = deleteTask(taskId);
            if (result.success) {
                deletedTasks.push(taskId);
                deletedFiles.push(...result.deletedFiles);
            }
            else {
                skippedTasks.push(taskId);
            }
        }
    }
    else if (plan.linkedTasks.length > 0) {
        skippedTasks.push(...plan.linkedTasks);
    }
    // Delete the plan
    const planResult = deletePlan(planId);
    if (planResult.success) {
        deletedFiles.push(...planResult.deletedFiles);
    }
    return {
        success: planResult.success,
        message: planResult.success
            ? `Plan ${planId} 삭제 완료 (Tasks: ${deletedTasks.length}개 삭제, ${skippedTasks.length}개 유지)`
            : planResult.message,
        deletedPlan: planResult.success ? planId : undefined,
        deletedTasks,
        deletedFiles,
        skippedTasks,
    };
}
function getAgentPrompt(difficulty, todoDescription) {
    const model = DIFFICULTY_MODEL_MAP[difficulty];
    const prompts = {
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
function saveTodoResult(taskId, todoId, status, summary, details, changedFiles = []) {
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
function writeFile(filePath, content) {
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
    }
    catch (error) {
        return {
            success: false,
            message: `❌ 파일 생성 실패: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
function editFile(filePath, oldString, newString, replaceAll = false) {
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
        // 파일의 줄바꿈 스타일 감지 (CRLF vs LF)
        const fileLineEnding = content.includes("\r\n") ? "\r\n" : "\n";
        // oldString/newString의 줄바꿈을 파일 스타일에 맞게 정규화
        let normalizedOldString = oldString.replace(/\r\n/g, "\n").replace(/\n/g, fileLineEnding);
        let normalizedNewString = newString.replace(/\r\n/g, "\n").replace(/\n/g, fileLineEnding);
        if (!content.includes(normalizedOldString)) {
            // 정규화 후에도 못 찾으면 원본으로 재시도
            if (!content.includes(oldString)) {
                return {
                    success: false,
                    message: `❌ 일치하는 문자열 없음`,
                    replacements: 0,
                };
            }
            // 원본으로 찾은 경우 정규화 안 함
            normalizedOldString = oldString;
            normalizedNewString = newString;
        }
        let replacements = 0;
        if (replaceAll) {
            const regex = new RegExp(normalizedOldString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
            replacements = (content.match(regex) || []).length;
            content = content.replace(regex, normalizedNewString);
        }
        else {
            replacements = 1;
            content = content.replace(normalizedOldString, normalizedNewString);
        }
        fs.writeFileSync(absolutePath, content, "utf-8");
        return {
            success: true,
            message: `✅ ${filePath} 수정됨 (${replacements}개 교체)`,
            replacements,
        };
    }
    catch (error) {
        return {
            success: false,
            message: `❌ 파일 수정 실패: ${error instanceof Error ? error.message : String(error)}`,
            replacements: 0,
        };
    }
}
function readFile(filePath, offset, limit) {
    try {
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
        if (!fs.existsSync(absolutePath)) {
            return {
                success: false,
                message: `❌ 파일 없음: ${filePath}`,
            };
        }
        const content = fs.readFileSync(absolutePath, "utf-8").replace(/\r\n/g, "\n");
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
    }
    catch (error) {
        return {
            success: false,
            message: `❌ 파일 읽기 실패: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
function listDir(dirPath, recursive = false) {
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
        const entries = [];
        const ignoreDirs = ['.git', 'node_modules', '.z-agent', '.claude', '__pycache__', '.venv', 'venv', 'dist', 'build'];
        function scanDir(currentPath, relativeTo) {
            const items = fs.readdirSync(currentPath, { withFileTypes: true });
            for (const item of items) {
                if (ignoreDirs.includes(item.name))
                    continue;
                if (item.name.startsWith('.') && item.name !== '.')
                    continue;
                const fullPath = path.join(currentPath, item.name);
                const relativePath = path.relative(relativeTo, fullPath);
                if (item.isDirectory()) {
                    entries.push(relativePath + '/');
                    if (recursive) {
                        scanDir(fullPath, relativeTo);
                    }
                }
                else {
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
    }
    catch (error) {
        return {
            success: false,
            entries: [],
            message: `❌ 디렉토리 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
function globFiles(pattern, basePath) {
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
        const files = [];
        const ignoreDirs = ['.git', 'node_modules', '.z-agent', '.claude', '__pycache__', '.venv', 'venv'];
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '{{GLOBSTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/{{GLOBSTAR}}/g, '.*')
            .replace(/\?/g, '.');
        const regex = new RegExp(`^${regexPattern}$`);
        function scanDir(currentPath) {
            const items = fs.readdirSync(currentPath, { withFileTypes: true });
            for (const item of items) {
                if (ignoreDirs.includes(item.name))
                    continue;
                const fullPath = path.join(currentPath, item.name);
                const relativePath = path.relative(searchPath, fullPath);
                if (item.isDirectory()) {
                    scanDir(fullPath);
                }
                else {
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
    }
    catch (error) {
        return {
            success: false,
            files: [],
            message: `❌ 파일 검색 실패: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
function generateTaskSummary(taskId) {
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
function listTasks(status) {
    const tasksDir = path.join(getZAgentRoot(), "tasks");
    if (!fs.existsSync(tasksDir)) {
        return [];
    }
    const files = fs.readdirSync(tasksDir).filter((f) => f.match(/^task-\d+\.md$/));
    const tasks = [];
    for (const file of files) {
        const taskId = file.replace(".md", "");
        const { task, todos } = getTaskStatus(taskId);
        if (!task)
            continue;
        if (status && task.status !== status)
            continue;
        const completedCount = todos.filter((t) => t.status === "complete" || t.status === "completed").length;
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
function listAnswers(keyword) {
    const answersDir = path.join(getZAgentRoot(), "answers");
    if (!fs.existsSync(answersDir)) {
        return [];
    }
    const files = fs.readdirSync(answersDir).filter((f) => f.match(/^answer-\d+\.md$/));
    const answers = [];
    for (const file of files) {
        const content = fs.readFileSync(path.join(answersDir, file), "utf-8").replace(/\r\n/g, "\n");
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
function listLessons(category) {
    const lessonsDir = path.join(getZAgentRoot(), "lessons");
    if (!fs.existsSync(lessonsDir)) {
        return [];
    }
    const files = fs.readdirSync(lessonsDir).filter((f) => f.match(/^lesson-\d+\.md$/));
    const lessons = [];
    for (const file of files) {
        const content = fs.readFileSync(path.join(lessonsDir, file), "utf-8").replace(/\r\n/g, "\n");
        const lessonId = file.replace(".md", "");
        const categoryMatch = content.match(/category:\s*(\S+)/);
        const lessonCategory = categoryMatch?.[1] || "unknown";
        if (category && lessonCategory !== category)
            continue;
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
function queryAll(options) {
    const { type = "all", keyword, status, category } = options;
    const result = {
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
            tasks = tasks.filter((t) => t.taskId.toLowerCase().includes(keyword.toLowerCase()) ||
                t.taskDesc.toLowerCase().includes(keyword.toLowerCase()));
        }
        result.tasks = tasks;
        result.summary.taskCount = tasks.length;
        if (type === "all") {
            const allTasks = listTasks();
            result.summary.tasksByStatus = allTasks.reduce((acc, t) => {
                acc[t.status] = (acc[t.status] || 0) + 1;
                return acc;
            }, {});
        }
    }
    // Get plans
    if (type === "all" || type === "plans") {
        let plans = listPlans();
        if (status) {
            plans = plans.filter((p) => p.status === status);
        }
        if (keyword) {
            plans = plans.filter((p) => p.planId.toLowerCase().includes(keyword.toLowerCase()) ||
                p.title.toLowerCase().includes(keyword.toLowerCase()));
        }
        result.plans = plans;
        result.summary.planCount = plans.length;
        if (type === "all") {
            const allPlans = listPlans();
            result.summary.plansByStatus = allPlans.reduce((acc, p) => {
                acc[p.status] = (acc[p.status] || 0) + 1;
                return acc;
            }, {});
        }
    }
    // Get lessons
    if (type === "all" || type === "lessons") {
        let lessons = listLessons(category);
        if (keyword) {
            lessons = lessons.filter((l) => l.lessonId.toLowerCase().includes(keyword.toLowerCase()) ||
                l.summary.toLowerCase().includes(keyword.toLowerCase()) ||
                l.tags.some((t) => t.toLowerCase().includes(keyword.toLowerCase())));
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
const tools = [
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
        description: "새로운 Task를 생성합니다. 자동으로 난이도 분석 및 TODO 목록을 생성합니다. targetFiles와 dependsOn을 지정하면 병렬 처리 분석이 가능합니다.",
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
                            targetFiles: {
                                type: "array",
                                items: { type: "string" },
                                description: "수정 예정 파일 경로 목록 (병렬 처리 분석용)"
                            },
                            dependsOn: {
                                type: "array",
                                items: { type: "number" },
                                description: "의존하는 TODO 인덱스 목록 (1-based)"
                            }
                        },
                    },
                    description: "TODO 항목 목록 (targetFiles, dependsOn으로 병렬 처리 가능)",
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
        name: "z_get_tasks_batch",
        description: "여러 Task의 상태를 한 번에 조회합니다. 각 Task의 TODO 진행 상황도 포함됩니다.",
        inputSchema: {
            type: "object",
            properties: {
                taskIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "조회할 Task ID 목록 (예: [\"task-001\", \"task-002\"])",
                },
            },
            required: ["taskIds"],
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
        description: "질문에 대한 답변을 저장하고 요약만 반환합니다. Context 절약을 위해 answer_file_path를 사용하세요 - Write 툴로 먼저 .z-agent/temp/answer_draft.md에 답변을 저장한 후 파일 경로만 전달하면 됩니다.",
        inputSchema: {
            type: "object",
            properties: {
                question: {
                    type: "string",
                    description: "사용자의 원래 질문",
                },
                answer_file_path: {
                    type: "string",
                    description: "답변이 저장된 파일 경로 (권장). Context 절약을 위해 answer 대신 사용하세요.",
                },
                answer: {
                    type: "string",
                    description: "전체 답변 내용 (비권장 - Context 소모가 큼. answer_file_path 사용 권장)",
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
    {
        name: "z_delete_task",
        description: "특정 Task와 관련 TODO 파일들을 삭제합니다.",
        inputSchema: {
            type: "object",
            properties: {
                taskId: {
                    type: "string",
                    description: "삭제할 Task ID (예: task-001)",
                },
            },
            required: ["taskId"],
        },
    },
    {
        name: "z_delete_plan",
        description: "특정 Plan을 삭제합니다. 연결된 Task도 함께 삭제할 수 있습니다.",
        inputSchema: {
            type: "object",
            properties: {
                planId: {
                    type: "string",
                    description: "삭제할 Plan ID (예: PLAN-001)",
                },
                deleteLinkedTasks: {
                    type: "boolean",
                    description: "연결된 Task도 함께 삭제할지 여부 (기본값: false)",
                },
            },
            required: ["planId"],
        },
    },
    {
        name: "z_delete_answer",
        description: "특정 Answer를 삭제합니다.",
        inputSchema: {
            type: "object",
            properties: {
                answerId: {
                    type: "string",
                    description: "삭제할 Answer ID (예: answer-001)",
                },
            },
            required: ["answerId"],
        },
    },
    {
        name: "z_delete_lesson",
        description: "특정 Lesson을 삭제합니다.",
        inputSchema: {
            type: "object",
            properties: {
                lessonId: {
                    type: "string",
                    description: "삭제할 Lesson ID (예: lesson-001)",
                },
            },
            required: ["lessonId"],
        },
    },
    // ===== Lesson CRUD (추가) =====
    {
        name: "z_get_lesson",
        description: "특정 Lesson의 상세 내용을 조회합니다.",
        inputSchema: {
            type: "object",
            properties: {
                lessonId: {
                    type: "string",
                    description: "조회할 Lesson ID (예: lesson-001)",
                },
            },
            required: ["lessonId"],
        },
    },
    {
        name: "z_update_lesson",
        description: "기존 Lesson을 수정합니다.",
        inputSchema: {
            type: "object",
            properties: {
                lessonId: {
                    type: "string",
                    description: "수정할 Lesson ID (예: lesson-001)",
                },
                category: {
                    type: "string",
                    enum: ["performance", "security", "architecture", "debugging", "best-practice"],
                    description: "Lesson 카테고리 (선택)",
                },
                problem: {
                    type: "string",
                    description: "문제 상황 설명 (선택)",
                },
                solution: {
                    type: "string",
                    description: "해결 방안 (선택)",
                },
                conditions: {
                    type: "string",
                    description: "적용 조건 (선택)",
                },
                warnings: {
                    type: "string",
                    description: "주의 사항 (선택)",
                },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "태그 목록 (선택)",
                },
                relatedTasks: {
                    type: "array",
                    items: { type: "string" },
                    description: "관련 Task ID 목록 (선택)",
                },
            },
            required: ["lessonId"],
        },
    },
    // ===== Memory CRUD =====
    {
        name: "z_add_memory",
        description: "프로젝트 메모리를 추가합니다. /task, /ask, /planning 에서 자동으로 참조됩니다.",
        inputSchema: {
            type: "object",
            properties: {
                content: {
                    type: "string",
                    description: "메모리 내용 (프로젝트 특기사항, 컨벤션, 중요 정보 등)",
                },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "검색용 태그 (선택)",
                },
                priority: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "우선순위 (기본값: medium). high는 항상 참조됨.",
                },
            },
            required: ["content"],
        },
    },
    {
        name: "z_get_memory",
        description: "특정 메모리를 조회합니다.",
        inputSchema: {
            type: "object",
            properties: {
                memoryId: {
                    type: "string",
                    description: "메모리 ID (예: mem-001)",
                },
            },
            required: ["memoryId"],
        },
    },
    {
        name: "z_list_memories",
        description: "모든 메모리를 조회합니다. 우선순위 순으로 정렬됩니다.",
        inputSchema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "z_search_memories",
        description: "키워드로 메모리를 검색합니다.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "검색 키워드",
                },
                limit: {
                    type: "number",
                    description: "최대 결과 수 (기본값: 10)",
                },
            },
            required: ["query"],
        },
    },
    {
        name: "z_update_memory",
        description: "메모리를 수정합니다.",
        inputSchema: {
            type: "object",
            properties: {
                memoryId: {
                    type: "string",
                    description: "수정할 메모리 ID (예: mem-001)",
                },
                content: {
                    type: "string",
                    description: "새 내용 (선택)",
                },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "새 태그 목록 (선택)",
                },
                priority: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "새 우선순위 (선택)",
                },
            },
            required: ["memoryId"],
        },
    },
    {
        name: "z_delete_memory",
        description: "메모리를 삭제합니다.",
        inputSchema: {
            type: "object",
            properties: {
                memoryId: {
                    type: "string",
                    description: "삭제할 메모리 ID (예: mem-001)",
                },
            },
            required: ["memoryId"],
        },
    },
    {
        name: "z_get_tasks_by_status",
        description: "상태별로 Task 목록을 조회합니다. TODO 진행 상황도 함께 표시됩니다.",
        inputSchema: {
            type: "object",
            properties: {
                status: {
                    type: "string",
                    enum: ["all", "pending", "in_progress", "completed", "cancelled", "blocked"],
                    description: "조회할 Task 상태 (기본값: all)",
                },
            },
            required: [],
        },
    },
    {
        name: "z_get_plans_by_status",
        description: "상태별로 Plan 목록을 조회합니다. 연결된 Task의 미완료 상태도 확인합니다.",
        inputSchema: {
            type: "object",
            properties: {
                status: {
                    type: "string",
                    enum: ["all", "draft", "ready", "in_progress", "completed", "cancelled"],
                    description: "조회할 Plan 상태 (기본값: all)",
                },
            },
            required: [],
        },
    },
    {
        name: "z_delete_completed_tasks",
        description: "완료된 모든 Task와 관련 파일들을 일괄 삭제합니다.",
        inputSchema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "z_cleanup_preview",
        description: "정리 대상 항목들을 미리보기합니다. 실제 삭제 전 확인용입니다.",
        inputSchema: {
            type: "object",
            properties: {
                target: {
                    type: "string",
                    enum: ["completed_tasks", "completed_plans", "all_completed"],
                    description: "미리보기 대상",
                },
            },
            required: ["target"],
        },
    },
    {
        name: "z_analyze_parallel_groups",
        description: "Task의 TODO 목록을 분석하여 병렬 처리 가능한 그룹을 반환합니다. targetFiles가 겹치지 않고 dependsOn 의존성이 해결된 TODO들은 병렬 실행 가능합니다.",
        inputSchema: {
            type: "object",
            properties: {
                taskId: {
                    type: "string",
                    description: "분석할 Task ID (예: task-001)",
                },
            },
            required: ["taskId"],
        },
    },
    {
        name: "z_get_parallel_prompt",
        description: "병렬 실행할 TODO 그룹에 대한 Agent 프롬프트 목록을 반환합니다. 각 프롬프트를 개별 Task tool로 동시에 실행하세요.",
        inputSchema: {
            type: "object",
            properties: {
                taskId: {
                    type: "string",
                    description: "Task ID",
                },
                todoIndexes: {
                    type: "array",
                    items: { type: "number" },
                    description: "병렬 실행할 TODO 인덱스 목록",
                },
            },
            required: ["taskId", "todoIndexes"],
        },
    },
];
// Create server
const server = new Server({
    name: "z-agent",
    version: "0.1.0",
}, {
    capabilities: {
        tools: {},
    },
});
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
                const result = analyzeDifficulty(args.input);
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
                const description = args.description;
                const difficultyResult = analyzeDifficulty(description);
                // Search related lessons
                const relatedLessons = searchLessons(description, 3).map(l => l.lessonId);
                // Create TODO list from input or generate default
                let todos = [];
                if (args.todos && Array.isArray(args.todos)) {
                    todos = args.todos.map((t, i) => ({
                        index: i + 1,
                        description: t.description,
                        difficulty: t.difficulty || difficultyResult.difficulty,
                        status: "pending",
                        targetFiles: t.targetFiles || [],
                        dependsOn: t.dependsOn || [],
                    }));
                }
                else {
                    // Default single TODO
                    todos = [{
                            index: 1,
                            description: description,
                            difficulty: difficultyResult.difficulty,
                            status: "pending",
                            targetFiles: [],
                            dependsOn: [],
                        }];
                }
                const taskId = getNextTaskId();
                const filePath = createTaskFile(taskId, description, difficultyResult.difficulty, todos, relatedLessons);
                // 병렬 처리 그룹 분석
                const parallelGroups = analyzeParallelGroups(todos);
                const hasParallelOpportunity = parallelGroups.some(g => g.canRunParallel);
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
                                parallelGroups,
                                hasParallelOpportunity,
                                message: hasParallelOpportunity
                                    ? `Task ${taskId} 생성됨. 병렬 처리 가능한 그룹이 있습니다. z_get_parallel_prompt로 병렬 실행하세요.`
                                    : `Task ${taskId} 생성됨. 난이도: ${difficultyResult.difficulty}, 권장 모델: ${difficultyResult.suggestedModel}`,
                            }, null, 2),
                        },
                    ],
                };
            }
            case "z_update_todo": {
                const success = updateTodoStatus(args.taskId, args.todoIndex, args.status);
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
                const result = getTaskStatus(args.taskId);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case "z_get_tasks_batch": {
                const taskIds = args.taskIds;
                const results = [];
                for (const taskId of taskIds) {
                    const { task, todos } = getTaskStatus(taskId);
                    const completed = todos.filter(t => t.status === "complete" || t.status === "completed").length;
                    const total = todos.length;
                    results.push({
                        taskId,
                        task,
                        todos,
                        todoProgress: `${completed}/${total}`,
                    });
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                count: results.length,
                                tasks: results,
                            }, null, 2),
                        },
                    ],
                };
            }
            case "z_search_lessons": {
                const results = searchLessons(args.query, args.limit || 5);
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
                const lessonId = recordLesson(args.category, args.problem, args.solution, args.tags, args.relatedTasks || []);
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
                const prompt = getAgentPrompt(args.difficulty, args.todoDescription);
                const model = DIFFICULTY_MODEL_MAP[args.difficulty];
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
                const filePath = saveTodoResult(args.taskId, args.todoId, args.status, args.summary, args.details, args.changedFiles || []);
                // Update TODO status
                updateTodoStatus(args.taskId, args.todoId, args.status);
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
                const summary = generateTaskSummary(args.taskId);
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
                const result = writeFile(args.filePath, args.content);
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
                const result = editFile(args.filePath, args.oldString, args.newString, args.replaceAll || false);
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
                const result = readFile(args.filePath, args.offset, args.limit);
                return {
                    content: [
                        {
                            type: "text",
                            text: result.success
                                ? result.content
                                : result.message,
                        },
                    ],
                    isError: !result.success,
                };
            }
            case "z_list_dir": {
                const result = listDir(args.dirPath || ".", args.recursive || false);
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
                const result = globFiles(args.pattern, args.basePath);
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
                const relatedAnswers = args.relatedAnswers || [];
                const result = createPlan(args.title, args.description, relatedAnswers);
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
                const success = updatePlan(args.planId, {
                    status: args.status,
                    todos: args.todos,
                    content: args.content,
                });
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
                const result = getPlan(args.planId);
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
                const success = linkPlanToTask(args.planId, args.taskId);
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
                const tasks = listTasks(args.status);
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
                const lessons = listLessons(args.category);
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
                const answers = listAnswers(args.keyword);
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
                    type: args.type || "all",
                    keyword: args.keyword,
                    status: args.status,
                    category: args.category,
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
                let answerContent;
                if (args.answer_file_path) {
                    try {
                        answerContent = fs.readFileSync(args.answer_file_path, "utf-8");
                    }
                    catch {
                        return {
                            content: [{ type: "text", text: `❌ 파일을 읽을 수 없습니다: ${args.answer_file_path}` }],
                        };
                    }
                }
                else if (args.answer) {
                    answerContent = args.answer;
                }
                else {
                    return {
                        content: [{ type: "text", text: "❌ answer 또는 answer_file_path가 필요합니다." }],
                    };
                }
                const result = saveAnswer(args.question, answerContent, args.summary, args.relatedLessons || [], args.relatedFiles || [], args.relatedPlans || [], args.relatedTasks || []);
                // 임시 파일 삭제
                if (args.answer_file_path) {
                    try {
                        fs.unlinkSync(args.answer_file_path);
                    }
                    catch {
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
                const result = getAnswer(args.answerId);
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
                const related = getRelatedItems("answer", args.answerId);
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
                const success = linkAnswerToPlan(args.answerId, args.planId);
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
                const success = linkAnswerToTask(args.answerId, args.taskId);
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
                const related = getRelatedItems(args.entityType, args.entityId);
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
            case "z_delete_task": {
                const result = deleteTask(args.taskId);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case "z_delete_plan": {
                const result = deletePlanWithTasks(args.planId, args.deleteLinkedTasks || false);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case "z_delete_answer": {
                const result = deleteAnswer(args.answerId);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case "z_delete_lesson": {
                const result = deleteLesson(args.lessonId);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            // ===== Lesson CRUD (추가) =====
            case "z_get_lesson": {
                const result = getLesson(args.lessonId);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case "z_update_lesson": {
                const result = updateLesson(args.lessonId, {
                    category: args.category,
                    problem: args.problem,
                    solution: args.solution,
                    conditions: args.conditions,
                    warnings: args.warnings,
                    tags: args.tags,
                    relatedTasks: args.relatedTasks,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            // ===== Memory CRUD =====
            case "z_add_memory": {
                const result = addMemory(args.content, args.tags || [], args.priority || "medium");
                return {
                    content: [
                        {
                            type: "text",
                            text: `Memory ${result.memoryId} 추가됨`,
                        },
                    ],
                };
            }
            case "z_get_memory": {
                const result = getMemory(args.memoryId);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case "z_list_memories": {
                const memories = getAllMemories();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                count: memories.length,
                                memories: memories.map(m => ({
                                    memoryId: m.memoryId,
                                    priority: m.priority,
                                    tags: m.tags,
                                    contentPreview: m.content.slice(0, 100) + (m.content.length > 100 ? "..." : ""),
                                    updatedAt: m.updatedAt,
                                })),
                            }, null, 2),
                        },
                    ],
                };
            }
            case "z_search_memories": {
                const results = searchMemories(args.query, args.limit || 10);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                query: args.query,
                                count: results.length,
                                memories: results.map(m => ({
                                    memoryId: m.memoryId,
                                    priority: m.priority,
                                    tags: m.tags,
                                    contentPreview: m.content.slice(0, 100) + (m.content.length > 100 ? "..." : ""),
                                })),
                            }, null, 2),
                        },
                    ],
                };
            }
            case "z_update_memory": {
                const result = updateMemory(args.memoryId, {
                    content: args.content,
                    tags: args.tags,
                    priority: args.priority,
                });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case "z_delete_memory": {
                const result = deleteMemory(args.memoryId);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            case "z_get_tasks_by_status": {
                const status = args.status || "all";
                const tasks = getTasksByStatus(status);
                let output = `## Task 목록 (상태: ${status})\n\n`;
                if (tasks.length === 0) {
                    output += "해당하는 Task가 없습니다.\n";
                }
                else {
                    for (const task of tasks) {
                        const emoji = STATUS_EMOJI[task.status] || "⏳";
                        const todoInfo = `[${task.todoStats.completed}/${task.todoStats.total}]`;
                        output += `- ${emoji} **${task.taskId}**: ${task.taskDesc} ${todoInfo}\n`;
                        if (task.linkedPlan) {
                            output += `  └ 연결된 Plan: ${task.linkedPlan}\n`;
                        }
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
            case "z_get_plans_by_status": {
                const status = args.status || "all";
                const plans = getPlansByStatus(status);
                let output = `## Plan 목록 (상태: ${status})\n\n`;
                if (plans.length === 0) {
                    output += "해당하는 Plan이 없습니다.\n";
                }
                else {
                    for (const plan of plans) {
                        const emoji = STATUS_EMOJI[plan.status] || "⏳";
                        output += `- ${emoji} **${plan.planId}**: ${plan.title}\n`;
                        if (plan.linkedTasks.length > 0) {
                            output += `  └ 연결된 Tasks: ${plan.linkedTasks.join(", ")}\n`;
                            if (plan.incompleteTasks.length > 0) {
                                output += `  └ ⚠️ 미완료 Tasks: ${plan.incompleteTasks.join(", ")}\n`;
                            }
                        }
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
            case "z_delete_completed_tasks": {
                const result = deleteCompletedTasks();
                let output = `## 완료된 Task 정리 결과\n\n`;
                output += `삭제된 Tasks: ${result.deletedTasks.length}개\n`;
                if (result.deletedTasks.length > 0) {
                    output += `\n### 삭제된 Task 목록\n`;
                    for (const taskId of result.deletedTasks) {
                        output += `- ✅ ${taskId}\n`;
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
            case "z_cleanup_preview": {
                const target = args.target;
                let output = `## 정리 미리보기: ${target}\n\n`;
                if (target === "completed_tasks" || target === "all_completed") {
                    const completedTasks = getTasksByStatus("completed");
                    output += `### 완료된 Tasks (${completedTasks.length}개)\n`;
                    if (completedTasks.length === 0) {
                        output += "없음\n";
                    }
                    else {
                        for (const task of completedTasks) {
                            output += `- ${task.taskId}: ${task.taskDesc}\n`;
                        }
                    }
                    output += "\n";
                }
                if (target === "completed_plans" || target === "all_completed") {
                    const completedPlans = getPlansByStatus("completed");
                    output += `### 완료된 Plans (${completedPlans.length}개)\n`;
                    if (completedPlans.length === 0) {
                        output += "없음\n";
                    }
                    else {
                        for (const plan of completedPlans) {
                            output += `- ${plan.planId}: ${plan.title}\n`;
                            if (plan.linkedTasks.length > 0) {
                                output += `  └ 연결된 Tasks: ${plan.linkedTasks.join(", ")}\n`;
                            }
                            if (plan.incompleteTasks.length > 0) {
                                output += `  └ ⚠️ 미완료 Tasks: ${plan.incompleteTasks.join(", ")}\n`;
                            }
                        }
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
            case "z_analyze_parallel_groups": {
                const taskId = args.taskId;
                const taskFilePath = path.join(getZAgentRoot(), "tasks", `${taskId}.md`);
                if (!fs.existsSync(taskFilePath)) {
                    return {
                        content: [{
                                type: "text",
                                text: JSON.stringify({ error: `Task ${taskId} not found` }),
                            }],
                        isError: true,
                    };
                }
                // Parse TODO list from task file
                const content = fs.readFileSync(taskFilePath, "utf-8").replace(/\r\n/g, "\n");
                const todoMatch = content.match(/# TODO List\n([\s\S]*?)(?=\n#|$)/);
                if (!todoMatch) {
                    return {
                        content: [{
                                type: "text",
                                text: JSON.stringify({ error: "TODO list not found in task file" }),
                            }],
                        isError: true,
                    };
                }
                // Parse TODO items with targetFiles info from task folder
                const taskFolder = path.join(getZAgentRoot(), taskId);
                const todos = [];
                const todoLines = todoMatch[1].split("\n").filter(l => l.trim());
                for (const line of todoLines) {
                    const match = line.match(/([⏳🔄✅❌🚫]) - (\d+)\. (.+) \(([HML])\)/);
                    if (match) {
                        const [, emoji, indexStr, desc, diff] = match;
                        const index = parseInt(indexStr);
                        // Read targetFiles and dependsOn from TODO template file
                        let targetFiles = [];
                        let dependsOn = [];
                        const todoFileName = `todo-${String(index).padStart(3, "0")}.md`;
                        const todoFilePath = path.join(taskFolder, todoFileName);
                        if (fs.existsSync(todoFilePath)) {
                            const todoContent = fs.readFileSync(todoFilePath, "utf-8").replace(/\r\n/g, "\n");
                            // Parse targetFiles from frontmatter
                            const targetFilesMatch = todoContent.match(/targetFiles:\s*\[(.*?)\]/);
                            if (targetFilesMatch && targetFilesMatch[1].trim()) {
                                targetFiles = targetFilesMatch[1]
                                    .split(",")
                                    .map(f => f.trim().replace(/"/g, ""))
                                    .filter(Boolean);
                            }
                            // Parse dependsOn from frontmatter
                            const dependsOnMatch = todoContent.match(/dependsOn:\s*\[(.*?)\]/);
                            if (dependsOnMatch && dependsOnMatch[1].trim()) {
                                dependsOn = dependsOnMatch[1]
                                    .split(",")
                                    .map(n => parseInt(n.trim()))
                                    .filter(n => !isNaN(n));
                            }
                        }
                        const statusMap = {
                            "⏳": "pending",
                            "🔄": "in_progress",
                            "✅": "complete",
                            "❌": "cancelled",
                            "🚫": "blocked",
                        };
                        todos.push({
                            index,
                            description: desc,
                            difficulty: diff,
                            status: statusMap[emoji] || "pending",
                            targetFiles,
                            dependsOn,
                        });
                    }
                }
                const parallelGroups = analyzeParallelGroups(todos);
                const hasParallelOpportunity = parallelGroups.some(g => g.canRunParallel);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                taskId,
                                todoCount: todos.length,
                                parallelGroups,
                                hasParallelOpportunity,
                                instruction: hasParallelOpportunity
                                    ? "병렬 실행 가능한 그룹이 있습니다. z_get_parallel_prompt를 사용하여 병렬 실행하세요."
                                    : "모든 TODO가 순차 실행이 필요합니다.",
                            }, null, 2),
                        }],
                };
            }
            case "z_get_parallel_prompt": {
                const taskId = args.taskId;
                const todoIndexes = args.todoIndexes;
                const taskFilePath = path.join(getZAgentRoot(), "tasks", `${taskId}.md`);
                if (!fs.existsSync(taskFilePath)) {
                    return {
                        content: [{
                                type: "text",
                                text: JSON.stringify({ error: `Task ${taskId} not found` }),
                            }],
                        isError: true,
                    };
                }
                // Parse TODO list
                const content = fs.readFileSync(taskFilePath, "utf-8").replace(/\r\n/g, "\n");
                const todoMatch = content.match(/# TODO List\n([\s\S]*?)(?=\n#|$)/);
                if (!todoMatch) {
                    return {
                        content: [{
                                type: "text",
                                text: JSON.stringify({ error: "TODO list not found in task file" }),
                            }],
                        isError: true,
                    };
                }
                const todoLines = todoMatch[1].split("\n").filter(l => l.trim());
                const prompts = [];
                for (const line of todoLines) {
                    const match = line.match(/([⏳🔄✅❌🚫]) - (\d+)\. (.+) \(([HML])\)/);
                    if (match) {
                        const [, , indexStr, desc, diff] = match;
                        const index = parseInt(indexStr);
                        if (todoIndexes.includes(index)) {
                            const model = DIFFICULTY_MODEL_MAP[diff] || "sonnet";
                            const prompt = getAgentPrompt(diff, desc);
                            prompts.push({
                                todoIndex: index,
                                description: desc,
                                difficulty: diff,
                                model,
                                prompt,
                            });
                        }
                    }
                }
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                taskId,
                                parallelCount: prompts.length,
                                prompts,
                                instruction: `[필수] 위 ${prompts.length}개의 Task tool 호출을 반드시 하나의 응답에서 동시에 보내세요! 순차 호출 금지!`,
                                warning: "Task tool을 하나씩 순차적으로 호출하면 병렬 실행이 아닙니다. 반드시 하나의 메시지에서 여러 Task tool을 동시에 호출하세요.",
                                howTo: "각 prompt의 model 필드를 참고하여 Task(subagent_type='general-purpose', model=model, prompt=prompt) 형태로 동시 호출하세요.",
                            }, null, 2),
                        }],
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
    }
    catch (error) {
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
//# sourceMappingURL=index.js.map