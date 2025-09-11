import { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink, ShadingType, FootnoteReferenceRun } from 'docx';
import { saveAs } from 'file-saver';

export class DocxConverter {
  constructor(bookData, bookTitle) {
    this.bookData = bookData;
    this.bookTitle = bookTitle || 'Untitled Document';
  }

  async convertAndSave() {
    const doc = this.createDocument();
    const blob = await Packer.toBlob(doc);
    const filename = `${this.bookTitle.toLowerCase().replace(/\s+/g, '-')}.docx`;
    saveAs(blob, filename);
  }

  createDocument() {
    const children = [];
    const footnotes = {};

    const footnotesNode = this.bookData.footnotes;
    if (footnotesNode && footnotesNode.content) {
      footnotesNode.content.forEach((footnoteItem, index) => {
        const id = footnoteItem.attrs['data-id'];
        const number = index + 1; // Numbering is based on order, which is fine.
        footnotes[id] = {
          number: number,
          children: this.nodesToDocx(footnoteItem.content, [], 0, true)
        };
      });
    }

    children.push(new Paragraph({ text: this.bookTitle, heading: HeadingLevel.TITLE }));
    (this.bookData.chapters || []).forEach(chapter => {
      children.push(new Paragraph({ text: chapter.title || 'Untitled Chapter', heading: HeadingLevel.HEADING_1 }));
      this.nodesToDocx(chapter.content_json?.content || [], children);
      (chapter.sections || []).forEach(section => {
        children.push(new Paragraph({ text: section.title || 'Untitled Section', heading: HeadingLevel.HEADING_2 }));
        this.nodesToDocx(section.content_json?.content || [], children);
      });
    });

    return new Document({
      footnotes: footnotes,
      numbering: {
        config: [
          { reference: "default-bullet-list", levels: [{ level: 0, format: "bullet", text: "•", alignment: "left", indent: { left: 720 } }] },
          { reference: "default-number-list", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: "left", indent: { left: 720 } }] },
        ],
      },
      styles: {
        paragraphStyles: [
          { id: "Quote", name: "Quote", basedOn: "Normal", next: "Normal", run: { color: "555555", italics: true }, paragraph: { indent: { left: 720 }, spacing: { before: 120, after: 120 } } },
          { id: "SourceCode", name: "Source Code", basedOn: "Normal", next: "Normal", run: { font: "Courier New", size: 20 }, paragraph: { indent: { left: 720 }, spacing: { before: 120, after: 120 } } },
        ]
      },
      sections: [{ properties: {}, children }],
    });
  }

  nodesToDocx(nodes, children, listLevel = 0, isFootnoteContent = false) {
    nodes.forEach(node => {
      if (node.type === 'footnotes') return;
      switch (node.type) {
        case 'heading':
          children.push(new Paragraph({
            children: this.renderTextRuns(node.content || []),
            heading: { 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 }[node.attrs.level] || HeadingLevel.HEADING_4,
          }));
          break;
        case 'paragraph':
          if (node.content && node.content.length > 0) {
            children.push(new Paragraph({ children: this.renderTextRuns(node.content || []) }));
          }
          break;
        case 'bulletList':
        case 'orderedList':
          (node.content || []).forEach(listItem => this.renderListItem(listItem, node.type, children, listLevel));
          break;
        case 'blockquote':
          (node.content || []).forEach(innerNode => {
            if (innerNode.type === 'paragraph') {
              children.push(new Paragraph({ children: this.renderTextRuns(innerNode.content || []), style: "Quote" }));
            }
          });
          break;
        case 'codeBlock':
          children.push(new Paragraph({ text: (node.content || []).map(n => n.text).join('\n'), style: "SourceCode", shading: { type: ShadingType.CLEAR, fill: "F1F1F1" } }));
          break;
        case 'horizontalRule':
          children.push(new Paragraph({
            border: { bottom: { color: "auto", space: 1, style: "single", size: 6 } },
          }));
          break;
      }
    });
    return children;
  }

  renderListItem(listItemNode, listType, children, listLevel) {
    (listItemNode.content || []).forEach(childNode => {
      if (childNode.type === 'paragraph') {
        children.push(new Paragraph({
          children: this.renderTextRuns(childNode.content || []),
          numbering: {
            reference: listType === 'bulletList' ? 'default-bullet-list' : 'default-number-list',
            level: listLevel,
          },
        }));
      }
      if (['bulletList', 'orderedList'].includes(childNode.type)) {
        (childNode.content || []).forEach(nestedItem => this.renderListItem(nestedItem, childNode.type, children, listLevel + 1));
      }
    });
  }

  renderTextRuns(contentNodes) {
    return (contentNodes || []).flatMap(node => {
      if (node.type === 'footnoteReference') {
        return new FootnoteReferenceRun(node.attrs['data-id']);
      }
      const linkMark = node.marks?.find(m => m.type === 'link');
      if (linkMark) {
        return new ExternalHyperlink({
          children: [new TextRun({ text: node.text || "", style: "Hyperlink" })],
          link: linkMark.attrs.href,
        });
      }
      const opts = { text: node.text || "" };
      (node.marks || []).forEach(m => {
        if (m.type === 'bold') opts.bold = true;
        if (m.type === 'italic') opts.italics = true;
      });
      return new TextRun(opts);
    });
  }
}