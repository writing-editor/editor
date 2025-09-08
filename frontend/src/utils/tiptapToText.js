// frontend/src/utils/tiptapToText.js
export function tiptapToText(tiptapJson) {
  let text = "";
  if (!tiptapJson || !tiptapJson.content) return "";

  function traverse(nodes) {
    for (const node of nodes) {
      if (node.type === 'text' && node.text) {
        text += node.text;
      }
      if (node.content) {
        traverse(node.content);
      }
      // Add a newline after paragraphs and headings to simulate block separation for better diffing.
      if (['paragraph', 'heading'].includes(node.type)) {
        text += '\n';
      }
    }
  }

  traverse(tiptapJson.content);
  return text.trim();
}


// --- NEW: Smart text extractor for diffing ---
export function extractTextForDiff(fileId, contentObject) {
  if (!contentObject || typeof contentObject !== 'object') {
    return String(contentObject || '');
  }

  // Handle .book files
  if (fileId.endsWith('.book')) {
    let fullText = "";
    if (contentObject.chapters && Array.isArray(contentObject.chapters)) {
      for (const chapter of contentObject.chapters) {
        fullText += `${chapter.title || ''}\n\n`;
        if (chapter.content_json) {
          fullText += tiptapToText(chapter.content_json) + '\n\n';
        }
        if (chapter.sections && Array.isArray(chapter.sections)) {
          for (const section of chapter.sections) {
            fullText += `  ${section.title || ''}\n\n`;
            if (section.content_json) {
              fullText += tiptapToText(section.content_json) + '\n\n';
            }
          }
        }
      }
    }
    return fullText.trim();
  }

  // Handle .note files
  if (fileId.endsWith('.note')) {
    return tiptapToText(contentObject.content_json);
  }

  // Fallback for other file types (e.g., settings, prompts)
  return JSON.stringify(contentObject, null, 2);
}