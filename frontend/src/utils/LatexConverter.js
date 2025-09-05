/**
 * Converts a TipTap JSON object into a LaTeX string.
 * This is a frontend implementation of the original Python logic.
 */
export class LatexConverter {
  constructor(tiptapJson, bookTitle) {
    this.json = tiptapJson;
    this.bookTitle = this.escapeLatex(bookTitle || 'Untitled');
    this.latexString = "";
    // A document is considered an 'article' if it has only one chapter.
    this.isArticle = (this.json.chapters || []).length === 1;
    this.marksMap = {
      'bold': text => `\\textbf{${text}}`,
      'italic': text => `\\textit{${text}}`,
    };
  }

  /**
   * Escapes special LaTeX characters in a string.
   * @param {string} text The text to escape.
   * @returns {string} The escaped text.
   */
  escapeLatex(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/#/g, '\\#')
      .replace(/_/g, '\\_')
      .replace(/{/g, '\\{')
      .replace(/}/g, '\\}')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  }

  /**
   * Main conversion method.
   * @returns {string} The complete LaTeX document as a string.
   */
  convert() {
    this.writePreamble();
    for (const chapter of this.json.chapters || []) {
      this.writeChapter(chapter);
    }
    this.writeDocumentEnd();
    return this.latexString;
  }

  writePreamble() {
    const docClass = this.isArticle ? 'article' : 'report';
    this.latexString += `\\documentclass{${docClass}}\n`;
    this.latexString += `\\title{${this.bookTitle}}\n`;
    this.latexString += `\\author{Editor App}\n`;
    this.latexString += `\\begin{document}\n`;
    this.latexString += `\\maketitle\n\n`;
  }

  writeChapter(chapterJson) {
    const chapterTitle = this.escapeLatex(chapterJson.title || 'Untitled Chapter');
    // In 'article' mode, we don't use the \chapter command.
    if (!this.isArticle) {
      this.latexString += `\\chapter{${chapterTitle}}\n\n`;
    }
    const content = chapterJson.content_json?.content || [];
    this.nodesToLatex(content);
  }

  nodesToLatex(nodes) {
    for (const node of nodes) {
      const nodeType = node.type;
      if (nodeType === 'heading') {
        const level = node.attrs?.level || 2;
        let sectionCmd;
        if (this.isArticle) {
          // In an article, H2 is a section, H3 is a subsection, etc.
          sectionCmd = { 2: 'section', 3: 'subsection', 4: 'subsubsection' }[level] || 'subsection';
        } else {
          // In a report (book), H2 is a chapter (handled above), H3 is a section, etc.
          sectionCmd = { 2: 'section', 3: 'subsection', 4: 'subsubsection' }[level] || 'section';
        }
        const text = this.renderTextContent(node.content || []);
        this.latexString += `\\${sectionCmd}{${text}}\n\n`;
      } else if (nodeType === 'paragraph') {
        const text = this.renderTextContent(node.content || []);
        if (text) { // Don't write empty paragraphs
          this.latexString += text + '\n\n';
        }
      }
    }
  }

  renderTextContent(contentNodes) {
    if (!contentNodes) return "";
    return contentNodes.map(node => {
      let text = this.escapeLatex(node.text || "");
      if (node.marks) {
        for (const mark of node.marks) {
          if (this.marksMap[mark.type]) {
            text = this.marksMap[mark.type](text);
          }
        }
      }
      return text;
    }).join('');
  }

  writeDocumentEnd() {
    this.latexString += '\\end{document}\n';
  }
}