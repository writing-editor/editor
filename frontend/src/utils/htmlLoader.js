/**
 * A simple utility to fetch and cache HTML content from files.
 * This prevents multiple network requests for the same template.
 */

const htmlCache = new Map();
const BASE_URL = import.meta.env.BASE_URL;

export async function loadHTML(relativePath) {
    // Construct the full, correct path using the base URL
    const fullPath = `${BASE_URL}${relativePath.startsWith('/') ? relativePath.substring(1) : relativePath}`;

    if (htmlCache.has(fullPath)) {
        return htmlCache.get(fullPath);
    }

    try {
        const response = await fetch(fullPath);
        if (!response.ok) {
            throw new Error(`Failed to load HTML template: ${response.statusText} for path ${fullPath}`);
        }
        const html = await response.text();
        htmlCache.set(fullPath, html);
        return html;
    } catch (error) {
        console.error(`Error loading HTML from ${fullPath}:`, error);
        return `<p>Error: Could not load UI component.</p>`;
    }
}