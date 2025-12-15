# CodeView - Online Coding Interview Platform

A real-time collaborative coding interview platform with syntax highlighting and in-browser code execution.

## Features

- 🔗 **Create & Share Links** - Generate unique session links to share with candidates
- ✏️ **Real-time Collaboration** - All participants see code changes instantly via WebSocket
- 🎨 **Syntax Highlighting** - Support for JavaScript, TypeScript, Python, Java, C++, Rust, and Go
- ▶️ **In-browser Execution** - Run JavaScript/TypeScript in a Web Worker sandbox, and Python via Pyodide (WebAssembly)
- 🐍 **Python Support** - Full Python 3.12 execution in the browser using Pyodide
- 👥 **Participant Tracking** - See how many people are connected to the session
- 🐳 **Docker Support** - Easy deployment with Docker

## Tech Stack

### Backend
- **Hono** - Fast, lightweight web framework
- **WebSocket** - Real-time bidirectional communication
- **TypeScript** - Type-safe code

### Frontend
- **SvelteKit** - Modern web framework with file-based routing
- **Svelte 5** - Reactive UI with runes
- **CodeMirror 6** - Powerful code editor with syntax highlighting
- **Vite** - Fast build tool
- **TypeScript** - Type-safe code

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

1. Clone the repository and navigate to the project:

```bash
cd homework2
```

2. Install backend dependencies:

```bash
cd backend
npm install
```

3. Install frontend dependencies:

```bash
cd ../frontend
npm install
```

### Running the Application

1. Start the backend server (from the `backend` directory):

```bash
npm run dev
```

The backend will start on `http://localhost:3001`

2. In a new terminal, start the frontend (from the `frontend` directory):

```bash
npm run dev
```

The frontend will start on `http://localhost:5173`

3. Open `http://localhost:5173` in your browser

### Usage

1. **Create a Session**: Click "Create Session" on the landing page
2. **Share the Link**: Copy the session link to share with candidates
3. **Collaborate**: All participants can edit code in real-time
4. **Run Code**: Click "Run Code" to execute JavaScript/TypeScript in the browser
5. **Change Language**: Use the dropdown to switch syntax highlighting

## Project Structure

```
homework2/
├── backend/
│   ├── src/
│   │   └── index.ts          # Hono server with WebSocket
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── components/
│   │   │   │   ├── CodeEditor.svelte
│   │   │   │   └── OutputPanel.svelte
│   │   │   ├── stores/
│   │   │   │   └── websocket.ts
│   │   │   └── utils/
│   │   │       └── codeRunner.ts
│   │   ├── routes/
│   │   │   ├── +layout.svelte
│   │   │   ├── +page.svelte
│   │   │   └── room/[id]/
│   │   │       ├── +page.svelte
│   │   │       └── +page.ts
│   │   ├── app.css
│   │   ├── app.html
│   │   └── app.d.ts
│   ├── package.json
│   ├── svelte.config.js
│   ├── vite.config.ts
│   └── tsconfig.json
└── README.md
```

## API Endpoints

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sessions` | Create a new session |
| GET | `/api/sessions/:id` | Get session details |
| GET | `/api/sessions` | List all active sessions |

### WebSocket Messages

| Type | Direction | Description |
|------|-----------|-------------|
| `join` | Client → Server | Join a session |
| `init` | Server → Client | Initial session state |
| `code_update` | Both | Code content changed |
| `language_change` | Both | Language selection changed |
| `user_joined` | Server → Client | New participant joined |
| `user_left` | Server → Client | Participant left |

## Docker Deployment

The application runs on a **single port** (3001), with the backend serving both the API and the static frontend files.

### Build the Docker Image

```bash
docker build -t codeview .
```

### Run the Container

```bash
docker run -p 3001:3001 codeview
```

The application will be available at: **http://localhost:3001**

### Run in Background (Detached Mode)

```bash
docker run -d -p 3001:3001 --name codeview codeview
```

### Useful Docker Commands

| Command | Description |
|---------|-------------|
| `docker logs codeview` | View container logs |
| `docker logs -f codeview` | Follow logs in real-time |
| `docker stop codeview` | Stop the container |
| `docker start codeview` | Start a stopped container |
| `docker rm codeview` | Remove the container |
| `docker rmi codeview` | Remove the image |

### Deploy to Cloud Platforms

The single-port architecture makes deployment simple on platforms like:
- **Railway** - `railway up`
- **Fly.io** - `fly launch && fly deploy`
- **Render** - Connect GitHub repo and deploy
- **Google Cloud Run** - `gcloud run deploy`

## Security Notes

- JavaScript/TypeScript execution is sandboxed in a Web Worker with a 5-second timeout
- Python execution runs via Pyodide (WebAssembly) in the browser with a 10-second timeout
- Sessions are stored in memory (cleared on server restart)
- For production, consider adding authentication and persistent storage

