import { 
    getUpdatedPdfContent, 
    fetchPdfLinks, 
    doesProcessedAndTranslatedExist 
} from './pdfService';
import { extractMenusFromPdf, translateToEnglish } from './aiService';
import { saveProcessedMenu, loadProcessedMenu } from './fileService';
import { generateAllMenuImages } from './imageService';
import { DailyMenu, RestaurantData, PdfLinks } from '../types';
import { config } from '../config/constants';

let processedMenu: RestaurantData = {
    htp: [],
    ht201: []
};

let translatedMenus: RestaurantData = {
    htp: [],
    ht201: []
};

let scrapedPdfLinks: PdfLinks = {};

export async function updateMenus(): Promise<void> {
    console.log('Updating menus...');

    if (!config.ENABLE_PDF_SCRAPING) {
        console.log('PDF scraping is disabled via ENABLE_PDF_SCRAPING=false');
        // Try to load saved data instead
        tryLoadSavedData();
        return;
    }

    const pdfLinks = await fetchPdfLinks();
    scrapedPdfLinks = pdfLinks;

    if (pdfLinks.HTP) {
        const optionalContent = await getUpdatedPdfContent(pdfLinks.HTP, 'htp');
        if (optionalContent) {
            processedMenu.htp = await extractMenusFromPdf(optionalContent) || [];
            saveProcessedMenu('htp', processedMenu.htp);
            translatedMenus.htp = await translateToEnglish(processedMenu.htp) || [];
            saveProcessedMenu('htp', translatedMenus.htp, true);
        } else {
            console.debug("No changes detected in the PDF content for HTP");
            const loadedHtpMenu = loadProcessedMenu('htp');
            const loadedHtpTranslated = loadProcessedMenu('htp', true);
            
            if (loadedHtpMenu && loadedHtpTranslated) {
                processedMenu.htp = loadedHtpMenu;
                translatedMenus.htp = loadedHtpTranslated;
                console.log('Using cached menu data for HTP');
            }
        }
    }

    if (pdfLinks.HT201) {
        const optionalContent = await getUpdatedPdfContent(pdfLinks.HT201, 'ht201');
        if (optionalContent) {
            processedMenu.ht201 = await extractMenusFromPdf(optionalContent) || [];
            saveProcessedMenu('ht201', processedMenu.ht201);
            translatedMenus.ht201 = await translateToEnglish(processedMenu.ht201) || [];
            saveProcessedMenu('ht201', translatedMenus.ht201, true);
        } else {
            console.debug("No changes detected in the PDF content for HT201");
            const loadedHt201Menu = loadProcessedMenu('ht201');
            const loadedHt201Translated = loadProcessedMenu('ht201', true);
            
            if (loadedHt201Menu && loadedHt201Translated) {
                processedMenu.ht201 = loadedHt201Menu;
                translatedMenus.ht201 = loadedHt201Translated;
                console.log('Using cached menu data for HT201');
            }
        }
    }

    generateAllMenuImages(Object.values(translatedMenus).flat());
    console.log('Menus updated successfully');
}

function tryLoadSavedData(): boolean {
    console.log('Trying to load saved menu data...');
    let dataLoaded = false;
    
    // Try to load HTP data
    const loadedHtpMenu = loadProcessedMenu('htp');
    const loadedHtpTranslated = config.ENABLE_MENU_TRANSLATION ? loadProcessedMenu('htp', true) : null;
    
    if (loadedHtpMenu) {
        processedMenu.htp = loadedHtpMenu;
        translatedMenus.htp = loadedHtpTranslated || loadedHtpMenu;
        dataLoaded = true;
        console.log('Loaded saved menu data for HTP');
    }
    
    // Try to load HT201 data
    const loadedHt201Menu = loadProcessedMenu('ht201');
    const loadedHt201Translated = config.ENABLE_MENU_TRANSLATION ? loadProcessedMenu('ht201', true) : null;
    
    if (loadedHt201Menu) {
        processedMenu.ht201 = loadedHt201Menu;
        translatedMenus.ht201 = loadedHt201Translated || loadedHt201Menu;
        dataLoaded = true;
        console.log('Loaded saved menu data for HT201');
    }
    
    return dataLoaded;
}

export function getProcessedMenus(): RestaurantData {
    return processedMenu;
}

export function getTranslatedMenus(): RestaurantData {
    return translatedMenus;
}

export function getScrapedPdfLinks(): PdfLinks {
    return scrapedPdfLinks;
}