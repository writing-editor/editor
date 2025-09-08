import { BaseAgent } from './BaseAgent.js';

export class DevelopmentAgent extends BaseAgent {
    async run(payload) {
        const { user_request, context, book_structure, current_book_filename } = payload;
        const viewContent = context.view_content;

        const promptFile = await this.controller.storageService.getFile('DEVELOP.txt');
        const prompt_template = promptFile ? promptFile.content : null;

        let context_summary = `The user is working on the document "${current_book_filename}".\n`;
        if (typeof book_structure === 'object') {
            context_summary += `The overall book structure is:\n${JSON.stringify(book_structure, null, 2)}\n\n`;
        } else {
            context_summary += `The overall book structure is: ${book_structure}\n\n`;
        }
        context_summary += `The content of the current view they are editing is:\n---\n${viewContent}\n---\n`;

        let final_prompt = prompt_template.replace('{context_summary}', context_summary);
        final_prompt = final_prompt.replace('{user_request}', user_request);

        const indicatorId = this.controller.showIndicator('Developing...');
        try {
            return await this.orchestrator.execute(final_prompt);
        } finally {
            this.controller.hideIndicator(indicatorId);
        }
    }
}