# Editor App - An AI-Enhanced Writing Studio
<img src="frontend/public/feather-pen.png" alt="Logo" style="width:15px;height:auto;">
    
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<a href="https://writing-editor.github.io/editor/" target="_blank">
  <img src="https://img.shields.io/badge/Live_Demo-Try_it_Now!-28a745?style=for-the-badge" alt="Live Demo Button"/>
</a>



Editor App is a distraction-free, local-first writing environment for authors and researchers. It combines a minimalist text editor with a powerful suite of integrated AI agents, a personal knowledge base, and robust data management features.

Built as both a **Progressive Web App (PWA)** for seamless offline browser use and a **cross-platform Desktop App** via Electron, it ensures your work is always available, secure, and under your control.

<!-- A GIF of the app in action would be perfect here -->

## ✨ Key Features

### ✍️ Core Writing Experience
*   **📚 Interactive Document Outline:** Organize your work into Books, Chapters, and Sections. The Navigator pane provides a live, clickable table of contents—just like a PDF reader—allowing you to see your document's structure at a glance and navigate complex projects effortlessly.
*   **Distraction-Free Editor:** A clean, minimalist writing pane powered by Tiptap, with a bubble menu for essential formatting and Markdown-like slash commands.
*   **Contextual Scrollbar:** A unique scrollbar that shows your document's structure and allows for quick navigation between sections.

### 🤖 AI-Powered Assistance
*   **Multi-Provider Support:** Configure the app with your own API keys for **Google Gemini**, **Anthropic Claude**, or a **Local LLM (Ollama)**.
*   **Agent-Based System:** The AI is powered by "Agents"—reusable, task-specific prompts.
    *   **Core Agents:** Comes with built-in agents for rewriting, analysis, brainstorming, and more.
    *   **Agent Manager:** Edit, disable, or **create your own AI agents** directly from the settings UI. Customize their prompts, triggers (e.g., show in bubble menu), and output handlers (e.g., replace text, create a new note).

### 🧠 Integrated Knowledge Management
*   **Notebook:** A dedicated space for capturing thoughts, research notes, and fleeting ideas, separate from your main documents.
*   **Advanced Note Search:**
    *   **Local Search:** Instantly search your notes with a high-performance, local full-text search engine.
    *   **AI "Deep" Search:** Perform semantic, concept-based searches on your notes using the `core.find_notes` agent.
*   **Automatic Tagging:** An optional background agent (`core.autotag`) can intelligently analyze your untagged notes and suggest relevant conceptual tags.

### 💾 Data Management & Portability
*   **Local-First Storage:** All data is stored reliably in your browser's IndexedDB, making the entire application fully functional offline.
*   **Google Drive Sync:** Optionally sign in with a Google account to sync your work across devices. The system is designed to be robust and protect your data.
*   **Intelligent Conflict Resolution:** The sync engine protects your work.
    *   Non-overlapping changes are merged automatically in the background.
    *   If a complex conflict is detected, a clean, **line-by-line contextual diff** appears, allowing you to choose which version to keep. **Your work is never silently overwritten or lost.**
*   **Backup & Restore:** Export your entire local database to a single `.json` file, or import a backup to restore your work on any machine.
*   **Multiple Export Formats:** Export individual documents to standard formats, including **LaTeX (.tex)** and **Microsoft Word (.docx)**.

### 🎨 Customization
*   **Theming:** Choose between clean light and dark themes.
*   **Editor Fonts:** Customize the editor's font family (Serif, Sans-Serif, Mono) and font size for a comfortable writing experience.

## 🚀 Getting Started

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18 or later recommended)
*   [npm](https://www.npmjs.com/) (or yarn/pnpm)

### Development Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd editor-app
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    This application uses Google APIs for authentication and cloud sync. You will need to create a project in the [Google Cloud Console](https://console.cloud.google.com/).

    Create a file named `.env` in the project root and add your credentials:
    ```.env
    # Get from your Google Cloud Console project
    VITE_GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"

    # Get from the "OAuth 2.0 Client IDs" section (Web client)
    VITE_GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
    ```
    > **Note:** The AI provider API keys (for Gemini or Claude) are **not** set here. They are configured within the application's settings UI after it is running.

4.  **Run the App:**

    *   **For the Web App (PWA):**
        ```bash
        npm run dev
        ```
        The application will be available at `http://localhost:5173`.

    *   **For the Desktop App (Electron):**
        ```bash
        npm run electron:dev
        ```
        This will launch Vite and Electron concurrently, with hot-reloading for the UI.

## 🤝 Contributing

Contributions are welcome! This project is a great place to work with modern web technologies, AI integration, and local-first application architecture.

### How to Contribute
1.  **Fork the repository.**
2.  **Create a new branch:** `git checkout -b feature/your-feature-name`
3.  **Make your changes.**
4.  **Commit your changes:** `git commit -m "feat: Describe your new feature"`
5.  **Push to the branch:** `git push origin feature/your-feature-name`
6.  **Open a Pull Request.**

### Areas to Contribute
*   **Bug Fixes:** Check the [Issues tab](https://github.com/writing-editor/editor/issues) for any reported bugs.
*   **New AI Agents:** Have a great idea for a new AI tool? Create a new agent definition in `default-config.json`.
*   **More Themes:** Add new color schemes to `main.css`.
*   **Improve Export Formats:** Enhance the LaTeX or Docx converters with more features.
*   **Documentation:** Improve this README or add more detailed guides.

## 🏛️ Architecture

The application is built with **vanilla JavaScript (ES Modules)**, prioritizing simplicity, performance, and a clear, decoupled architecture.

*   **Controller Pattern:** `src/App.js` acts as the central orchestrator, initializing services and UI components. It passes a `controller` object to them, which serves as a public API for decoupled communication.
*   **Service-Oriented:** Core logic is encapsulated in services (`BookService`, `StorageService`, `SyncService`, `AgentService`).
*   **Local-First:** `StorageService` provides a robust wrapper around IndexedDB, ensuring the application is always responsive and works offline. `SyncService` builds on top of this to provide optional cloud backup.
*   **Component-Based UI:** The UI is broken down into plain JavaScript components, each managing its own piece of the DOM and logic without a heavy framework dependency.

## 🛠️ Tech Stack

*   **Desktop Wrapper:** [Electron](https://www.electronjs.org/)
*   **Build Tool:** [Vite](https://vitejs.dev/)
*   **Editor:** [Tiptap](https://tiptap.dev/)
*   **Local Storage:** [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
*   **Local Search:** [FlexSearch](https://github.com/nextapps-de/flexsearch)
*   **Styling:** Plain CSS with CSS Variables
*   **PWA:** [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
*   **.docx Export:** [docx](https://docx.js.org/)

## A Note on Development

This app was developed through vibecoding and with the extensive use of LLMs as a pair-programming partner, exploring a modern, AI-assisted development workflow.