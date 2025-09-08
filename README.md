Of course! Based on the comprehensive codebase you've provided, here is a detailed README.md file that covers the application's purpose, features, architecture, and setup instructions.

---

# Editor App - An AI-Enhanced Writing Studio
<img src="frontend/public/feather-pen.png" alt="Logo" style="width:100px;height:auto;">

Editor App is a distraction-free, local-first writing environment designed for authors, researchers, and anyone working on long-form, structured content. It combines a minimalist text editor with a powerful suite of integrated AI tools, a personal knowledge base, and robust data management features, including cloud sync and various export formats.

The application is built as a Progressive Web App (PWA), ensuring it works seamlessly offline while offering the benefits of cloud synchronization when connected.

## ✨ Key Features

### ✍️ Core Writing Experience
*   **Structured Documents:** Organize your work into Books, Chapters, and Sections. The intuitive navigator makes it easy to manage complex projects.
*   **Distraction-Free Editor:** A clean, minimalist writing pane powered by Tiptap, with a floating bubble menu for essential formatting (Bold, Italic, Headings).
*   **Word & Character Count:** A subtle, non-intrusive counter keeps you informed of your progress.

### 🤖 AI-Powered Assistance
*   **Multi-Provider Support:** Configure the app to use your own API keys for either **Google Gemini** or **Anthropic Claude** models.
*   **Direct AI Actions:**
    *   **Analyze:** Select text and get an AI-powered critique, which appears as a suggestion in the Assistant Pane.
    *   **Rewrite:** Get instant proofreading and suggestions for improving selected text. Accept or reject changes with a single click.
*   **AI Workbench:** Open a dedicated modal to make complex, open-ended requests to the AI based on the context of your current document or selection (e.g., "Suggest three alternative titles for this chapter," "Expand on this paragraph," "Check for inconsistencies").
*   **Customizable Prompts:** A dedicated "Manage Prompts" section allows power users to edit the underlying system prompts for every AI agent, tailoring the AI's personality and output to their exact needs.

### 🧠 Integrated Knowledge Management
*   **Notebook:** A separate, dedicated space for capturing thoughts, research notes, and fleeting ideas.
*   **Advanced Note Search:**
    *   **Local Search:** Instantly search your notes with a high-performance, local full-text search engine (FlexSearch).
    *   **AI "Deep" Search:** Perform semantic, concept-based searches on your notes using the AI model for more relevant results.
*   **Automatic Tagging:** The app can intelligently analyze your untagged notes in the background and suggest relevant conceptual tags to keep your knowledge base organized.

### 💾 Data Management & Portability
*   **Local-First Storage:** All data is stored securely and reliably in your browser's IndexedDB, making the entire application fully functional offline.
*   **Google Drive Sync & Collaboration:** Sign in with a Google account to sync your work across multiple devices. The system is designed for a single user but now supports near-live updates, making multi-device workflows much smoother. Deletions are also synced instantly.
*   **Intelligent Conflict Resolution:** The sync engine protects your data. Simple, non-overlapping changes are merged automatically in the background. If a complex conflict is detected (e.g., the same paragraph is edited on two devices), a clear side-by-side comparison appears, allowing you to choose the correct version. **Your work is never silently overwritten or lost.**
*   > **Best Practices for a Smooth Sync:**
    > *   **Stay Online:** A stable internet connection provides the best experience.
    > *   **Check the Sync Status:** Before closing the app or switching devices, ensure the cloud icon in the bottom-left is not spinning. This guarantees your latest changes are saved to the cloud.
*   **Backup & Restore:** Export your entire local database to a single `.json` file for backup, or import a backup file to restore your work on any machine.
*   **Multiple Export Formats:** Export individual documents to standard academic and professional formats, including **LaTeX (.tex)** and **Microsoft Word (.docx)**.

### 🎨 Customization
*   **Theming:** Choose from a variety of light and dark themes (including Nord, Solarized Dark, Monokai, and more) to suit your preference.
*   **Editor Fonts:** Customize the editor's font family (Serif, Sans-Serif, Monospace) and font size for a comfortable reading and writing experience.

## 🚀 Getting Started

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18 or later recommended)
*   [npm](https://www.npmjs.com/), [yarn](https://yarnpkg.com/), or [pnpm](https://pnpm.io/)

### Local Development Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-folder>/frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    This application uses Google APIs for authentication and cloud sync. You will need to create a project in the [Google Cloud Console](https://console.cloud.google.com/) and enable the "Google Drive API".

    Create a file named `.env.local` in the `frontend/` directory and add your credentials:
    ```.env
    # Get this from your Google Cloud Console project
    VITE_GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY

    # Get this from the "OAuth 2.0 Client IDs" section of your credentials
    VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
    ```
    > **Note:** The AI provider API keys (for Gemini or Claude) are **not** set here. They are configured within the application's settings UI after it is running.

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173`.

### Building for Production
To create a production-ready build of the app:
```bash
npm run build
```
The output will be in the `frontend/dist` directory. You can serve these static files with any web server.

## 🏛️ Architecture & Project Structure

The application is built with modern, vanilla JavaScript (ES Modules) and follows a clear, decoupled architecture.

*   **Controller Pattern:** `src/App.js` acts as the central orchestrator. It initializes all services and UI components, and it passes a `controller` object to them. This object serves as a public API for components to interact with the rest of the application, avoiding tight coupling.
*   **Service-Oriented:** Core logic is encapsulated in services (`BookService`, `StorageService`, `SyncService`, `LlmOrchestrator`).
*   **Agent-Based AI:** AI logic is modularized into `Agent` classes (`AnalystAgent`, `RewriteAgent`, etc.), each responsible for a specific task. This makes it easy to modify or add new AI capabilities.
*   **Local-First:** `StorageService` provides a simple async wrapper around IndexedDB, ensuring the application is always responsive and works offline. `SyncService` builds on top of this to provide optional cloud backup.
*   **Component-Based UI:** The UI is broken down into components (`Navigator`, `Editor`, `SettingsPalette`, etc.), each managing its own piece of the DOM and logic.

### Project Directory
```
frontend/
├── public/
│   ├── html-templates/   # HTML snippets loaded dynamically
│   └── feather-pen.png   # App icon
├── src/
│   ├── agents/           # Self-contained AI logic modules (Analyst, Rewrite, etc.)
│   ├── components/       # UI components (JS, CSS)
│   ├── llm/              # API clients for different LLM providers (Gemini, Anthropic)
│   ├── services/         # Core application logic (Data, Sync, AI Orchestration)
│   ├── ui/               # UI helper modules (e.g., status indicators)
│   ├── utils/            # Reusable helper functions (debounce, converters, etc.)
│   ├── App.js            # Main application controller/orchestrator
│   ├── main.js           # Application entry point
│   └── main.css          # Global styles and theming
├── .env.local            # (You create this) Local environment variables
├── index.html            # Main HTML entry file
├── package.json          # Project dependencies and scripts
└── vite.config.js        # Vite build and PWA configuration
```

## 🛠️ Tech Stack

*   **Build Tool:** [Vite](https://vitejs.dev/)
*   **Editor:** [Tiptap](https://tiptap.dev/)
*   **Local Storage:** [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
*   **Local Search:** [FlexSearch](https://github.com/nextapps-de/flexsearch)
*   **Styling:** Plain CSS with CSS Variables for robust theming
*   **PWA:** [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
*   **.docx Export:** [docx](https://docx.js.org/)
*   **.json Export/Import:** [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.