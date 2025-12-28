#!/usr/bin/env python3
"""
Task Manager Script for z-agent
Task 상태 관리를 위한 CLI 스크립트

Usage:
    python task-manager.py <taskId> <todoIndex> <action>
    python task-manager.py task-001 1 complete
    python task-manager.py task-001 2 cancel
    python task-manager.py task-001 3 reset

Actions:
    complete  - 완료 처리 (✅)
    cancel    - 취소 처리 (❌)
    reset     - 대기로 되돌리기 (⏳)
    block     - 차단 상태로 변경 (🚫)
    progress  - 진행 중으로 변경 (🔄)
"""

import argparse
import re
import sys
from datetime import datetime
from pathlib import Path

# 상태 이모지 매핑
STATUS_EMOJI = {
    "pending": "⏳",
    "in_progress": "🔄",
    "complete": "✅",
    "completed": "✅",
    "cancelled": "❌",
    "cancel": "❌",
    "blocked": "🚫",
    "block": "🚫",
    "progress": "🔄",
    "reset": "⏳",
}

# 액션을 상태로 매핑
ACTION_TO_STATUS = {
    "complete": "complete",
    "cancel": "cancelled",
    "reset": "pending",
    "block": "blocked",
    "progress": "in_progress",
}


def get_z_agent_root() -> Path:
    """z-agent 루트 디렉토리 찾기"""
    current = Path.cwd()

    # 현재 디렉토리에서 상위로 올라가며 .z-agent 폴더 찾기
    for parent in [current] + list(current.parents):
        z_agent_path = parent / ".z-agent"
        if z_agent_path.exists():
            return z_agent_path

    # 스크립트 위치 기준으로 찾기
    script_path = Path(__file__).resolve()
    return script_path.parent.parent


def get_task_file(z_agent_root: Path, task_id: str) -> Path:
    """Task 파일 경로 반환"""
    return z_agent_root / "tasks" / f"{task_id}.md"


def parse_todo_line(line: str) -> dict | None:
    """TODO 라인 파싱"""
    # 패턴: 이모지 - N. 설명 (난이도)
    pattern = r'^([⏳🔄✅❌🚫])\s*-\s*(\d+)\.\s*(.+?)\s*\(([HML])\)\s*$'
    match = re.match(pattern, line.strip())

    if match:
        return {
            "emoji": match.group(1),
            "index": int(match.group(2)),
            "description": match.group(3),
            "difficulty": match.group(4),
        }
    return None


def update_todo_status(line: str, todo_index: int, new_status: str) -> str:
    """TODO 라인의 상태 업데이트"""
    parsed = parse_todo_line(line)

    if parsed and parsed["index"] == todo_index:
        new_emoji = STATUS_EMOJI.get(new_status, "⏳")
        return f'{new_emoji} - {parsed["index"]}. {parsed["description"]} ({parsed["difficulty"]})\n'

    return line


def update_task_file(task_file: Path, todo_index: int, action: str) -> bool:
    """Task 파일의 TODO 상태 업데이트"""
    if not task_file.exists():
        print(f"Error: Task file not found: {task_file}", file=sys.stderr)
        return False

    new_status = ACTION_TO_STATUS.get(action)
    if not new_status:
        print(f"Error: Unknown action: {action}", file=sys.stderr)
        return False

    # 파일 읽기
    with open(task_file, "r", encoding="utf-8", newline="") as f:
        lines = f.readlines()

    # TODO 라인 찾아서 업데이트
    updated = False
    in_todo_section = False

    for i, line in enumerate(lines):
        if "# TODO List" in line:
            in_todo_section = True
            continue

        if in_todo_section and line.startswith("#"):
            in_todo_section = False
            continue

        if in_todo_section:
            parsed = parse_todo_line(line)
            if parsed and parsed["index"] == todo_index:
                lines[i] = update_todo_status(line, todo_index, new_status)
                updated = True
                break

    if not updated:
        print(f"Error: TODO #{todo_index} not found in {task_file}", file=sys.stderr)
        return False

    # 파일 쓰기
    with open(task_file, "w", encoding="utf-8", newline="") as f:
        f.writelines(lines)

    print(f"Updated TODO #{todo_index} to {new_status} ({STATUS_EMOJI[new_status]})")
    return True


def check_all_completed(task_file: Path) -> dict:
    """모든 TODO가 완료되었는지 확인"""
    if not task_file.exists():
        return {"completed": False, "total": 0, "done": 0}

    with open(task_file, "r", encoding="utf-8") as f:
        content = f.read()

    # TODO 라인들 찾기
    todo_pattern = r'^([⏳🔄✅❌🚫])\s*-\s*\d+\.'
    todos = re.findall(todo_pattern, content, re.MULTILINE)

    total = len(todos)
    done = sum(1 for emoji in todos if emoji in ["✅", "❌"])

    return {
        "completed": total > 0 and done == total,
        "total": total,
        "done": done,
        "remaining": total - done,
    }


def update_task_status(task_file: Path, new_status: str) -> bool:
    """Task 파일의 status 필드 업데이트"""
    if not task_file.exists():
        return False

    with open(task_file, "r", encoding="utf-8", newline="") as f:
        content = f.read()

    # YAML frontmatter의 status 업데이트
    pattern = r'(status:\s*)(\w+)'
    replacement = f'\\1{new_status}'

    new_content = re.sub(pattern, replacement, content)

    with open(task_file, "w", encoding="utf-8", newline="") as f:
        f.write(new_content)

    return True


def list_tasks(z_agent_root: Path) -> None:
    """모든 Task 목록 출력"""
    tasks_dir = z_agent_root / "tasks"

    if not tasks_dir.exists():
        print("No tasks directory found.")
        return

    task_files = sorted(tasks_dir.glob("task-*.md"))

    if not task_files:
        print("No tasks found.")
        return

    print("Tasks:")
    print("-" * 60)

    for task_file in task_files:
        with open(task_file, "r", encoding="utf-8") as f:
            content = f.read()

        # Task ID와 상태 추출
        task_id = task_file.stem
        status_match = re.search(r'status:\s*(\w+)', content)
        desc_match = re.search(r'taskDesc:\s*(.+)', content)

        status = status_match.group(1) if status_match else "unknown"
        desc = desc_match.group(1) if desc_match else "No description"

        # TODO 상태 확인
        check = check_all_completed(task_file)

        status_emoji = STATUS_EMOJI.get(status, "❓")
        print(f"{status_emoji} {task_id}: {desc[:40]}...")
        print(f"   Progress: {check['done']}/{check['total']} completed")
        print()


def create_task(z_agent_root: Path, description: str, difficulty: str = "M") -> str:
    """새 Task 생성"""
    tasks_dir = z_agent_root / "tasks"
    tasks_dir.mkdir(parents=True, exist_ok=True)

    # 다음 Task ID 결정
    existing = list(tasks_dir.glob("task-*.md"))
    if existing:
        last_num = max(int(f.stem.split("-")[1]) for f in existing)
        next_num = last_num + 1
    else:
        next_num = 1

    task_id = f"task-{next_num:03d}"
    task_file = tasks_dir / f"{task_id}.md"

    # Task 파일 생성
    now = datetime.now().isoformat()
    content = f"""---
taskId: {task_id}
taskDesc: {description}
createdAt: {now}
difficulty: {difficulty}
status: pending
---
# TODO List

# Footnote
"""

    with open(task_file, "w", encoding="utf-8", newline="") as f:
        f.write(content)

    print(f"Created task: {task_id}")
    return task_id


def main():
    parser = argparse.ArgumentParser(
        description="z-agent Task Manager",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # update 명령어
    update_parser = subparsers.add_parser("update", help="Update TODO status")
    update_parser.add_argument("task_id", help="Task ID (e.g., task-001)")
    update_parser.add_argument("todo_index", type=int, help="TODO index (1-based)")
    update_parser.add_argument(
        "action",
        choices=["complete", "cancel", "reset", "block", "progress"],
        help="Action to perform"
    )

    # list 명령어
    subparsers.add_parser("list", help="List all tasks")

    # create 명령어
    create_parser = subparsers.add_parser("create", help="Create new task")
    create_parser.add_argument("description", help="Task description")
    create_parser.add_argument(
        "-d", "--difficulty",
        choices=["H", "M", "L"],
        default="M",
        help="Task difficulty"
    )

    # check 명령어
    check_parser = subparsers.add_parser("check", help="Check task completion status")
    check_parser.add_argument("task_id", help="Task ID (e.g., task-001)")

    # 레거시 지원: 위치 인자로 직접 사용
    parser.add_argument("legacy_args", nargs="*", help=argparse.SUPPRESS)

    args = parser.parse_args()

    z_agent_root = get_z_agent_root()

    # 레거시 명령어 지원: python task-manager.py task-001 1 complete
    if args.legacy_args and len(args.legacy_args) == 3 and not args.command:
        task_id, todo_index, action = args.legacy_args
        task_file = get_task_file(z_agent_root, task_id)
        success = update_task_file(task_file, int(todo_index), action)

        if success:
            # 모든 TODO 완료 확인
            check = check_all_completed(task_file)
            if check["completed"]:
                update_task_status(task_file, "completed")
                print(f"All TODOs completed! Task status updated to 'completed'")

        sys.exit(0 if success else 1)

    if args.command == "update":
        task_file = get_task_file(z_agent_root, args.task_id)
        success = update_task_file(task_file, args.todo_index, args.action)

        if success:
            check = check_all_completed(task_file)
            if check["completed"]:
                update_task_status(task_file, "completed")
                print(f"All TODOs completed! Task status updated to 'completed'")

        sys.exit(0 if success else 1)

    elif args.command == "list":
        list_tasks(z_agent_root)

    elif args.command == "create":
        create_task(z_agent_root, args.description, args.difficulty)

    elif args.command == "check":
        task_file = get_task_file(z_agent_root, args.task_id)
        check = check_all_completed(task_file)
        print(f"Task: {args.task_id}")
        print(f"Progress: {check['done']}/{check['total']}")
        print(f"Remaining: {check['remaining']}")
        print(f"Completed: {'Yes' if check['completed'] else 'No'}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
