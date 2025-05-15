import express, { Request, Response } from 'express';
import { config } from '../config/constants';
import path from 'path';
import { existsSync, readFileSync } from 'fs';

const router = express.Router();

// Try to get version from package.json
function getVersion(): string {
    try {
        const packagePath = path.join(process.cwd(), 'package.json');
        if (existsSync(packagePath)) {
            const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
            return packageJson.version || '1.0.0';
        }
    } catch (e) {
        console.error('Error reading package.json:', e);
    }
    return '1.0.0';
}

router.get('/status', (req: Request, res: Response) => {
    res.json({
        version: getVersion(),
        features: {
            imageGeneration: config.ENABLE_IMAGE_GENERATION,
            menuTranslation: config.ENABLE_MENU_TRANSLATION,
            autoUpdate: config.ENABLE_AUTO_UPDATE,
            pdfScraping: config.ENABLE_PDF_SCRAPING,
            updateInterval: `${config.AUTO_UPDATE_INTERVAL_MINUTES} minutes`,
        },
        restaurants: config.RESTAURANTS,
    });
});

export default router;