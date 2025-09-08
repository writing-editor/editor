import { LatexConverter } from '../utils/LatexConverter.js';
import { DocxConverter } from '../utils/DocxConverter.js';

export class ExportService {
    constructor(controller) {
        this.controller = controller;
    }

    downloadFile(filename, content) {
        const element = document.createElement('a');
        const file = new Blob([content], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = filename;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    async exportBookAsLatex(filename) {
        const indicatorId = this.controller.showIndicator('Converting to LaTeX...');
        try {
            const bookRecord = await this.controller.storageService.getFile(`${filename}.book`);
            const bookData = bookRecord ? bookRecord.content : null;
            if (!bookData) throw new Error('Could not find book data to export.');

            const converter = new LatexConverter(bookData, bookData.metadata.title);
            const latexContent = converter.convert();
            const downloadFilename = filename.endsWith('.tex') ? filename : `${filename}.tex`;
            this.downloadFile(downloadFilename, latexContent);
        } catch (error) {
            console.error("LaTeX export failed:", error);
            this.controller.showIndicator(`Export failed: ${error.message}`, { isError: true, duration: 4000 });
        } finally {
            this.controller.hideIndicator(indicatorId);
        }
    }

    async exportBookAsDocx(filename) {
        const indicatorId = this.controller.showIndicator('Converting to .docx...');
        try {
            const bookRecord = await this.controller.storageService.getFile(`${filename}.book`);
            const bookData = bookRecord ? bookRecord.content : null;
            if (!bookData) throw new Error('Could not find book data to export.');

            const converter = new DocxConverter(bookData, bookData.metadata.title);
            await converter.convertAndSave();
        } catch (error) {
            console.error("DOCX export failed:", error);
            this.controller.showIndicator(`Export failed: ${error.message}`, { isError: true, duration: 4000 });
        } finally {
            this.controller.hideIndicator(indicatorId);
        }
    }
}