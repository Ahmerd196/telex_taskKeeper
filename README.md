1️⃣ README.md
# TaskKeeper Agent for Telex

**Version:** 0.1.0  
**Type:** A2A (Agent-to-Agent)  

TaskKeeper is a lightweight task management agent designed for Telex. It allows users to create, assign, and track tasks directly within Telex channels using natural language commands.

---

## Features

- Create tasks via natural language:
  - `Remind me to file PR tomorrow at 5pm`
  - `Add task: Prepare meeting slides`
- Track task summaries:
  - `/tasks summary` or `/tasks list`
- Assign tasks to team members:
  - Action buttons or `/tasks assign`
- Mark tasks as done:
  - Action button or `/tasks done`
- Displays due dates and assignees
- Fully compatible with Telex A2A workflow
- Health check and discovery endpoint for Telex integration

---

## Installation

```bash
git clone <repo-url>
cd taskkeeper-agent
npm install


Set environment variables:

export PORT=4000
export TELEX_SECRET=<your-telex-secret>
export BASE_URL=<your-public-url> # e.g., ngrok or production URL


Run the server:

npm run dev

API Endpoints

POST /api/a2a/taskAgent
Handles incoming messages from Telex, creates tasks, or responds with summaries.

POST /api/a2a/taskAgent/action
Handles task actions like marking done or assigning.

GET /tasks
Returns all tasks (for testing/debugging).

GET /health
Returns { ok: true }.

GET /.well-known/telex.json
Telex discovery endpoint.

Usage

Invite the agent to a channel.

Use natural language commands to create tasks.

Use /tasks summary to see all pending tasks.

Use action buttons to assign or mark tasks as done.

License

MIT License