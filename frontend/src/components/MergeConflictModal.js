// frontend/src/components/MergeConflictModal.js
import { diff_match_patch } from "diff-match-patch";
// --- MODIFIED: Import the new smart extractor ---
import { extractTextForDiff } from "../utils/tiptapToText.js";

export class MergeConflictModal {
  constructor() {
    this.container = document.getElementById("merge-conflict-modal-container");
    this.localEl = document.getElementById("conflict-local-text");
    this.remoteEl = document.getElementById("conflict-remote-text");
    this.messageEl = document.getElementById("merge-conflict-message");
    this.keepLocalBtn = document.getElementById("conflict-btn-keep-local");
    this.useRemoteBtn = document.getElementById("conflict-btn-use-remote");

    this._resolve = null;

    this.keepLocalBtn.addEventListener("click", () => this._finish("local"));
    this.useRemoteBtn.addEventListener("click", () => this._finish("remote"));
  }

  /**
   * Show modal with conflict highlighting
   * @param {Object} payload { fileId, localContent, remoteContent }
   * @returns {Promise<"local"|"remote">}
   */
  async show({ fileId, localContent, remoteContent }) {
    // --- REVISED: Use the new smart text extractor ---
    let parsedRemoteContent;
    try {
      // Ensure remote content is always parsed from string to object first
      parsedRemoteContent = typeof remoteContent === 'string' ? JSON.parse(remoteContent) : remoteContent;
    } catch (e) {
      console.warn("Could not parse remote content for diff.", e);
      // Create a fallback object if parsing fails, so the app doesn't crash
      parsedRemoteContent = { error: "Could not parse remote content", raw: remoteContent };
    }

    // Use the smart extractor on both local (already an object) and parsed remote content
    const localText = extractTextForDiff(fileId, localContent);
    const remoteText = extractTextForDiff(fileId, parsedRemoteContent);

    this.messageEl.textContent = `File "${fileId}" has conflicting changes. Choose which version to keep:`;

    this.localEl.innerHTML = this._highlightDiff(localText, remoteText, "local");
    this.remoteEl.innerHTML = this._highlightDiff(localText, remoteText, "remote");

    this.container.classList.remove("hidden");

    return new Promise((resolve) => {
      this._resolve = resolve;
    });
  }


  hide() {
    this.container.classList.add("hidden");
  }

  _finish(choice) {
    this.hide();
    if (this._resolve) {
      this._resolve(choice);
      this._resolve = null;
    }
  }

  /**
   * Generate highlighted diff between local & remote
   * @param {string} local
   * @param {string} remote
   * @param {"local"|"remote"} side
   */
  _highlightDiff(local, remote, side) {
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(local, remote);
    dmp.diff_cleanupSemantic(diffs);

    return diffs.map(([op, text]) => {
      if (op === 0) {
        return `<span class="diff-equal">${this._escape(text)}</span>`;
      }
      if (op === -1 && side === "local") {
        return `<span class="diff-removed">${this._escape(text)}</span>`;
      }
      if (op === 1 && side === "remote") {
        return `<span class="diff-added">${this._escape(text)}</span>`;
      }
      return ""; // hide irrelevant changes
    }).join("");
  }

  _escape(str) {
    return str.replace(/[&<>]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])
    );
  }
}