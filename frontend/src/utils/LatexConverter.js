export class LatexConverter {
  constructor(tiptapJson, bookTitle) {
    this.json = tiptapJson;
    this.bookTitle = this.escapeLatex(bookTitle || 'Untitled');
    this.latexString = "";
    this.isArticle = (this.json.chapters || []).length === 1;
    this.marksMap = {
      'bold': text => `\\textbf{${text}}`,
      'italic': text => `\\textit{${text}}`,
    };
    this.footnoteContentMap = new Map();
  }

  escapeLatex(text) {
    if (typeof text !== 'string') return '';
    let escaped = text.replace(/\\/g, '\\textbackslash{}').replace(/[&%$#_{}]/g, '\\$&').replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}');
    let result = '';
    let doubleOpen = true;
    for (const ch of escaped) {
      if (ch === '"') {
        result += doubleOpen ? '``' : "''";
        doubleOpen = !doubleOpen;
      } else {
        result += ch;
      }
    }
    return result;
  }

  convert() {
    this.preProcessFootnotes();
    this.writePreamble();
    for (const chapter of this.json.chapters || []) {
      this.writeChapter(chapter);
    }
    this.writeDocumentEnd();
    return this.latexString;
  }

  preProcessFootnotes() {
    const footnotesNode = this.json.footnotes;
    if (footnotesNode && footnotesNode.content) {
      footnotesNode.content.forEach(footnoteItem => {
        // --- FIX: Use the correct 'data-id' attribute ---
        const id = footnoteItem.attrs['data-id'];
        const contentLatex = this.renderTextContent(footnoteItem.content[0]?.content || []);
        this.footnoteContentMap.set(id, contentLatex);
      });
    }
  }

  writePreamble() {
    const docClass = this.isArticle ? 'article' : 'report';
    this.latexString += `\\documentclass{${docClass}}\n`;
    this.latexString += `\\usepackage{hyperref}\n`;
    this.latexString += `\\hypersetup{colorlinks=true, urlcolor=blue}\n`;
    this.latexString += `\\title{${this.bookTitle}}\n`;
    this.latexString += `\\author{Editor App}\n`;
    this.latexString += `\\begin{document}\n`;
    this.latexString += `\\maketitle\n\n`;
  }

  writeChapter(chapterJson) {
    const chapterTitle = this.escapeLatex(chapterJson.title || 'Untitled Chapter');
    if (!this.isArticle) {
      this.latexString += `\\chapter{${chapterTitle}}\n\n`;
    }
    this.nodesToLatex(chapterJson.content_json?.content || []);
    (chapterJson.sections || []).forEach(section => {
      const sectionTitle = this.escapeLatex(section.title || 'Untitled Section');
      this.latexString += `\\section{${sectionTitle}}\n\n`;
      this.nodesToLatex(section.content_json?.content || []);
    });
  }

  nodesToLatex(nodes) {
    for (const node of nodes) {
      if (node.type === 'footnotes') continue;

      switch (node.type) {
        case 'heading': {
          const level = node.attrs?.level || 2;
          const cmd = { 2: 'section', 3: 'subsection' }[level] || 'subsubsection';
          const text = this.renderTextContent(node.content || []);
          this.latexString += `\\${cmd}{${text}}\n\n`;
          break;
        }
        case 'paragraph': {
          const text = this.renderTextContent(node.content || []);
          if (text) this.latexString += text + '\n\n';
          break;
        }
        case 'bulletList':
          this.latexString += '\\begin{itemize}\n';
          this.nodesToLatex(node.content || []);
          this.latexString += '\\end{itemize}\n\n';
          break;
        case 'orderedList':
          this.latexString += '\\begin{enumerate}\n';
          this.nodesToLatex(node.content || []);
          this.latexString += '\\end{enumerate}\n\n';
          break;
        case 'listItem': {
          const itemContent = (node.content || []).map(childNode => this.renderTextContent(childNode.content || [])).join('').trim();
          this.latexString += `  \\item ${itemContent}\n`;
          break;
        }
        case 'blockquote':
          this.latexString += '\\begin{quote}\n';
          this.nodesToLatex(node.content || []);
          this.latexString += '\\end{quote}\n\n';
          break;
        case 'codeBlock': {
          const code = node.content?.[0]?.text || '';
          this.latexString += `\\begin{verbatim}\n${code}\n\\end{verbatim}\n\n`;
          break;
        }
        case 'horizontalRule':
          this.latexString += '\\hrule\n\n';
          break;
      }
    }
  }

  renderTextContent(contentNodes) {
    if (!contentNodes) return "";
    return contentNodes.map(node => {
      if (node.type === 'footnoteReference') {
        const footnoteContent = this.footnoteContentMap.get(node.attrs['data-id']) || '';
        return `\\footnote{${footnoteContent}}`;
      }

      let text = this.escapeLatex(node.text || "");
      if (node.marks) {
        for (const mark of node.marks) {
          if (this.marksMap[mark.type]) {
            text = this.marksMap[mark.type](text);
          } else if (mark.type === 'link') {
            const url = this.escapeLatex(mark.attrs.href);
            text = `\\href{${url}}{${text}}`;
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