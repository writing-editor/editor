import { diff_match_patch } from "diff-match-patch";
import { extractTextForDiff } from "../utils/tiptapToText.js";

export class MergeConflictModal {
  constructor() {
    this.container = document.getElementById("merge-conflict-modal-container");
    this.box = document.getElementById("merge-conflict-box");
    this.localEl = document.getElementById("conflict-local-text");
    this.remoteEl = document.getElementById("conflict-remote-text");
    this.messageEl = document.getElementById("merge-conflict-message");
    this.keepLocalBtn = document.getElementById("conflict-btn-keep-local");
    this.useRemoteBtn = document.getElementById("conflict-btn-use-remote");
    this._resolve = null;

    this.keepLocalBtn.addEventListener("click", () => this._finish("local"));
    this.useRemoteBtn.addEventListener("click", () => this._finish("remote"));
  }

  async show({ fileId, localContent, remoteContent }) {
    let parsedRemoteContent;
    try {
      parsedRemoteContent = typeof remoteContent === 'string' ? JSON.parse(remoteContent) : remoteContent;
    } catch (e) {
      parsedRemoteContent = { error: "Could not parse remote content", raw: remoteContent };
    }
    const localText = extractTextForDiff(fileId, localContent);
    const remoteText = extractTextForDiff(fileId, parsedRemoteContent);

    this.messageEl.textContent = `File "${fileId}" has conflicting changes. Choose which version to keep:`;
    this.localEl.innerHTML = this._highlightDiff(localText, remoteText, "local");
    this.remoteEl.innerHTML = this._highlightDiff(localText, remoteText, "remote");

    this.container.classList.remove("hidden");
    this.box.scrollTop = 0; // Always scroll to the top when opening

    return new Promise((resolve) => { this._resolve = resolve; });
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

  _highlightDiff(localText, remoteText, side) {
    const dmp = new diff_match_patch();
    const CONTEXT_LINES = 2;

    // Always use local as text1 and remote as text2 for a stable comparison
    const { chars1, chars2, lineArray } = dmp.diff_linesToChars_(localText, remoteText);
    const diffs = dmp.diff_main(chars1, chars2, false);
    dmp.diff_charsToLines_(diffs, lineArray);

    const processedHtml = [];
    for (let i = 0; i < diffs.length; i++) {
      const [op, text] = diffs[i];

      if (op === -1 && side === 'local') { // -1 means "in local, not remote"
        processedHtml.push(`<span class="diff-removed">${this._escape(text)}</span>`);
      } else if (op === 1 && side === 'remote') { // 1 means "in remote, not local"
        processedHtml.push(`<span class="diff-added">${this._escape(text)}</span>`);
      } else if (op === 0) { // Unchanged text
        const lines = text.split('\n');
        const prevDiff = diffs[i - 1];
        const nextDiff = diffs[i + 1];

        if (!prevDiff) { // Start of file
          processedHtml.push(this._escape(lines.slice(-CONTEXT_LINES).join('\n')));
          if (lines.length > CONTEXT_LINES) processedHtml.push('<span class="diff-gap">...</span>');
        } else if (!nextDiff) { // End of file
          if (lines.length > CONTEXT_LINES) processedHtml.push('<span class="diff-gap">...</span>');
          processedHtml.push(this._escape(lines.slice(0, CONTEXT_LINES).join('\n')));
        } else if (lines.length > CONTEXT_LINES * 2) { // Between changes
          processedHtml.push(this._escape(lines.slice(0, CONTEXT_LINES).join('\n')));
          processedHtml.push('<span class="diff-gap">...</span>');
          processedHtml.push(this._escape(lines.slice(-CONTEXT_LINES).join('\n')));
        } else { // Short unchanged block
          processedHtml.push(this._escape(text));
        }
      }
    }
    return processedHtml.join('');
  }

  _escape(str) {
    return String(str).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }
}