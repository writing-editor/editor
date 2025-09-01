// frontend/src/services/SearchService.js

import FlexSearch from 'flexsearch';

// Helper to get plain text from TipTap content
function tiptapToText(nodes) {
  let text = '';
  if (!Array.isArray(nodes)) return '';
  for (const node of nodes) {
    if (node.type === 'text' && node.text) {
      text += node.text + ' ';
    }
    if (node.content) {
      text += tiptapToText(node.content);
    }
  }
  return text;
}

export class SearchService {
  constructor() {
    // We create an index that stores rich data
    this.index = new FlexSearch.Document({
      document: {
        id: "id", // Unique ID for each entry
        index: "content", // The field to search in
        store: ["filename", "viewId", "title", "snippet"] // Fields to store and return with results
      },
      tokenize: "forward" // A good balance of speed and accuracy
    });
    this.isIndexed = false;
  }

  /**
   * Builds the search index from all available book data.
   * This should be run in the background when the app loads.
   * @param {Array} bookFiles - An array of {id: string, content: object} from StorageService.
   */
  async buildIndex(bookFiles) {
    console.log("Building search index...");
    this.index.clear(); // Clear any previous index
    let entryId = 0;

    for (const bookFile of bookFiles) {
      const filename = bookFile.id.replace('.book', '');
      const bookData = bookFile.content;
      const bookTitle = bookData.metadata?.title || filename;

      for (const chapter of bookData.chapters || []) {
        const chapterTitle = chapter.title || "Untitled Chapter";
        const contentNodes = chapter.content_json?.content || [];

        // We index content paragraph by paragraph to get better snippets
        for (const [i, node] of contentNodes.entries()) {
          const nodeText = tiptapToText(node.content);
          if (nodeText.trim().length < 10) continue; // Skip very short nodes

          const viewId = `${chapter.id}_sec${i}`;
          
          this.index.add({
            id: entryId++,
            content: nodeText,
            filename: filename,
            viewId: viewId,
            title: `${bookTitle} / ${chapterTitle}`,
            snippet: nodeText.substring(0, 150) + (nodeText.length > 150 ? '...' : '')
          });
        }
      }
    }
    this.isIndexed = true;
    console.log(`Search index built with ${entryId} entries.`);
  }

  /**
   * Performs a search against the index.
   * @param {string} query - The user's search query.
   * @returns {Array} A list of search result objects.
   */
  search(query) {
    if (!this.isIndexed || !query) {
      return [];
    }
    // FlexSearch returns results for each field. We are only interested in 'content'.
    const results = this.index.search(query, { enrich: true });
    if (!results || results.length === 0) return [];
    
    // Flatten and deduplicate the results
    const uniqueDocs = new Map();
    results.forEach(fieldResult => {
      fieldResult.result.forEach(doc => {
        if (!uniqueDocs.has(doc.id)) {
          uniqueDocs.set(doc.id, doc.doc);
        }
      });
    });

    return Array.from(uniqueDocs.values());
  }
}