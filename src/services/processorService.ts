import { DailyMenu, RestaurantId } from '../types';
import { extractMenusFromPdf } from './aiService';
import { extractMenusFromPdfRegex } from './regexService';
import { config } from '../config/constants';

export type ProcessorType = 'ai' | 'regex' | 'ai-with-fallback';

export async function processMenu(pdfContent: ArrayBuffer, restaurant: RestaurantId): Promise<DailyMenu[]> {
    const processor = config.MENU_PROCESSOR;

    switch (processor) {
        case 'regex':
            console.log(`[${restaurant}] Using regex processor`);
            return extractMenusFromPdfRegex(pdfContent, restaurant);

        case 'ai':
            console.log(`[${restaurant}] Using AI processor`);
            return extractMenusFromPdf(pdfContent);

        case 'ai-with-fallback':
            console.log(`[${restaurant}] Using AI processor with regex fallback`);
            try {
                const result = await extractMenusFromPdf(pdfContent);
                if (result && result.length > 0) return result;
                console.warn(`[${restaurant}] AI returned empty result, falling back to regex`);
                return extractMenusFromPdfRegex(pdfContent, restaurant);
            } catch (error) {
                console.error(`[${restaurant}] AI extraction failed, falling back to regex:`, error);
                return extractMenusFromPdfRegex(pdfContent, restaurant);
            }

        default:
            console.warn(`Unknown processor "${processor}", defaulting to AI`);
            return extractMenusFromPdf(pdfContent);
    }
}
