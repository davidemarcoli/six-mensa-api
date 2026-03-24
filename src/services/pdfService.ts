import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { scrapeForPDF } from '../utils/scraper';
import { getDateComponents } from '../utils/helpers';
import { config } from '../config/constants';
import { RestaurantId, FileInfo, PdfLinks } from '../types';

export async function fetchPdfLinks(): Promise<PdfLinks> {
    const pdfLinks = await scrapeForPDF("https://www.betriebsrestaurants-migros.ch/landingpages/six/info-menuplan", [
        { name: "HTP", pattern: "/media/[a-zA-Z0-9]+/.*menueplan.+htp.+pdf$" },
        { name: "HT201", pattern: "/media/[a-zA-Z0-9]+/.*menueplan.+ht201.+pdf$" }
    ]);

    if (!pdfLinks) {
        throw new Error("Failed to fetch pdf links");
    }

    // Add base URL to each PDF link and filter out undefined values
    const filteredLinks: PdfLinks = Object.fromEntries(
        Object.entries(pdfLinks)
            .filter(([_, value]) => typeof value === 'string' && value !== undefined)
            .map(([key, value]) => [key, `${config.SIX_MENSA_BASE_URL}${value}`])
    ) as PdfLinks;

    return filteredLinks;
}

export async function getUpdatedPdfContent(pdfLink: string, restaurantId: RestaurantId): Promise<ArrayBuffer | undefined> {
    const { year, month, week } = getDateComponents();
    const pdfFileName = `${restaurantId}_${year}_${month}_week${week}.pdf`;
    const pdfFilePath = path.join(process.cwd(), 'pdfs', pdfFileName);
    
    // Check if we have a locally stored version
    let localContentExists = existsSync(pdfFilePath);
    let localContent: ArrayBuffer | undefined;
    
    if (localContentExists) {
        try {
            const fileBuffer = readFileSync(pdfFilePath);
            localContent = fileBuffer.buffer;
            console.log(`Found existing PDF for ${restaurantId}`);
        } catch (error) {
            console.error(`Error reading local PDF for ${restaurantId}:`, error);
            localContentExists = false;
        }
    }
    
    // Fetch the current PDF from the network
    try {
        const response = await fetch(pdfLink, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });

        const newPdfContent = await response.arrayBuffer();
        
        // Compare content if we have a local version and the parsed menu is saved
        if (localContentExists && localContent && doesProcessedAndTranslatedExist(restaurantId)) {
            const a = new Uint8Array(localContent);
            const b = new Uint8Array(newPdfContent);
            
            const areEqual = a.length === b.length && 
                a.every((val, index) => val === b[index]);
            
            if (areEqual) {
                console.log(`PDF for ${restaurantId} is unchanged, using cached version`);
                return undefined; // No change detected
            }
        }
        
        // If we reach here, either the PDF has changed or we didn't have it before
        console.log(`New or changed PDF detected for ${restaurantId}, saving to disk`);
        
        // Save the new PDF
        writeFileSync(pdfFilePath, Buffer.from(newPdfContent));
        
        // Return the new content for processing
        return newPdfContent;
    } catch (error) {
        console.error(`Error fetching or saving PDF for ${restaurantId}:`, error);
        
        // If fetch failed but we have a local version, return that
        if (localContent) {
            console.log(`Using cached PDF for ${restaurantId} due to fetch error`);
            return localContent;
        }
        
        return undefined;
    }
}

export function doesProcessedAndTranslatedExist(restaurant: RestaurantId): boolean {
    const { year, month, week } = getDateComponents();
    
    const fileName = `${restaurant}_${year}_${month}_week${week}_parsed.json`;
    const filePath = path.join(process.cwd(), 'processed', fileName);
    
    if (!existsSync(filePath)) {
        console.log(`No saved ${restaurant} menu data found`);
        return false;
    }

    const translatedFileName = `${restaurant}_${year}_${month}_week${week}_translated.json`;
    const translatedFilePath = path.join(process.cwd(), 'processed', translatedFileName);

    if (!existsSync(translatedFilePath)) {
        console.log(`No saved ${restaurant} translated menu data found`);
        return false;
    }
    
    return true;
}

export function listPdfFiles(): FileInfo[] {
    const pdfsDir = path.join(process.cwd(), 'pdfs');
    try {
        const files = readdirSync(pdfsDir);
        return files.filter(file => file.endsWith('.pdf'))
            .map(file => {
                const stats = statSync(path.join(pdfsDir, file));
                return {
                    name: file,
                    size: stats.size,
                    lastModified: stats.mtime,
                    url: `/pdf/${file.split('_')[0]}`
                };
            });
    } catch (error) {
        console.error('Error listing PDF files:', error);
        throw error;
    }
}