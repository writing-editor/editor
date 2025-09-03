import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

/**
 * Converts a TipTap JSON object into a .docx file and triggers a download.
 */
export class DocxConverter {
  constructor(tiptapJson, bookTitle) {
    this.json = tiptapJson;
    this.bookTitle = bookTitle || 'Untitled Document';
    this.isArticle = (this.json.chapters || []).length === 1;
  }

  /**
   * Main conversion method. Generates the .docx file and prompts for download.
   */
  async convertAndSave() {
    const doc = this.createDocument();

    // Use the Packer to generate a Blob
    const blob = await Packer.toBlob(doc);

    // Use file-saver to trigger the download
    const filename = `${this.bookTitle.toLowerCase().replace(/\s+/g, '-')}.docx`;
    saveAs(blob, filename);
  }

  /**
   * Creates the docx Document object from the TipTap JSON.
   * @returns {Document} The docx Document object.
   */
  createDocument() {
    const children = []; // This will hold all paragraphs, headings, etc.

    // Add the main title for articles
    if (this.isArticle) {
      children.push(new Paragraph({
        text: this.bookTitle,
        heading: HeadingLevel.TITLE,
      }));
    }

    (this.json.chapters || []).forEach(chapter => {
      // Add a chapter title for multi-chapter books
      if (!this.isArticle) {
        children.push(new Paragraph({
          text: chapter.title || 'Untitled Chapter',
          heading: HeadingLevel.HEADING_1,
        }));
      }

      const contentNodes = chapter.content_json?.content || [];
      this.nodesToDocx(contentNodes, children);
    });

    // Create the document with the assembled children
    const doc = new Document({
      sections: [{
        properties: {},
        children: children,
      }],
      styles: {
        paragraphStyles: [
          // You can define custom styles here if needed later
        ]
      }
    });

    return doc;
  }

  /**
   * Converts an array of TipTap nodes into docx Paragraphs and adds them to the children array.
   * @param {Array} nodes - The TipTap nodes to convert.
   * @param {Array} children - The array to push the resulting docx objects into.
   */
  nodesToDocx(nodes, children) {
    for (const node of nodes) {
      if (node.type === 'heading') {
        const level = node.attrs?.level || 2;
        // Map TipTap heading levels (H2, H3, ...) to docx HeadingLevels
        const headingLevelMap = {
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
          4: HeadingLevel.HEADING_4,
          5: HeadingLevel.HEADING_5,
          6: HeadingLevel.HEADING_6,
        };

        children.push(new Paragraph({
          children: this.renderTextRuns(node.content || []),
          heading: headingLevelMap[level] || HeadingLevel.HEADING_2,
        }));

      } else if (node.type === 'paragraph') {
        // Only add a paragraph if it contains text
        if (node.content && node.content.some(n => n.text)) {
          children.push(new Paragraph({
            children: this.renderTextRuns(node.content || []),
          }));
        }
      }
    }
  }

  /**
   * Converts an array of TipTap text nodes (with marks) into an array of docx TextRuns.
   * @param {Array} contentNodes - The array of TipTap text nodes.
   * @returns {Array<TextRun>} An array of TextRun objects.
   */
  renderTextRuns(contentNodes) {
    if (!contentNodes) return [];

    return contentNodes.map(node => {
      const textRunOptions = {
        text: node.text || "",
      };

      if (node.marks) {
        node.marks.forEach(mark => {
          if (mark.type === 'bold') {
            textRunOptions.bold = true;
          }
          if (mark.type === 'italic') {
            textRunOptions.italics = true;
          }
        });
      }

      return new TextRun(textRunOptions);
    });
  }
}