import axios from 'axios';
import * as cheerio from 'cheerio';

interface ScrapePattern {
    name: string;
    pattern: string;
}

export async function scrapeForPDF(url: string, patterns: ScrapePattern[]): Promise<Record<string, string | undefined>> {
    try {
        const response = await axios.get(url, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });

        const $ = cheerio.load(response.data);
        
        const results: Record<string, string | undefined> = {};
        
        // Initialize all patterns with undefined
        patterns.forEach(pattern => {
            results[pattern.name] = undefined;
        });
        
        // Find all links on the page
        $('a').each((_, element) => {
            const href = $(element).attr('href');
            
            if (!href) return;
            
            // Check against each pattern
            patterns.forEach(pattern => {
                const regex = new RegExp(pattern.pattern);
                if (regex.test(href)) {
                    results[pattern.name] = href;
                }
            });
        });
        
        return results;
    } catch (error) {
        console.error('Error scraping PDF links:', error);
        return {};
    }
}