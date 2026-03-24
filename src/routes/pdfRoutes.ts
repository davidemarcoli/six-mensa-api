import express, { Request, Response } from 'express';
import { existsSync } from 'fs';
import path from 'path';
import { listPdfFiles } from '../services/pdfService';
import { validateRestaurant, getDateComponents } from '../utils/helpers';
import { getScrapedPdfLinks } from '../services/menuService';

const router = express.Router();

router.get('/pdf/:restaurant', (req: Request, res: Response) => {
    try {
        const { restaurant } = req.params;
        const verifiedRestaurant = validateRestaurant(restaurant);
        
        const { year, month, week } = getDateComponents();
        const pdfFileName = `${verifiedRestaurant}_${year}_${month}_week${week}.pdf`;
        const pdfFilePath = path.join(process.cwd(), 'pdfs', pdfFileName);
        
        if (existsSync(pdfFilePath)) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${pdfFileName}"`);
            return res.sendFile(path.resolve(pdfFilePath));
        } else {
            res.status(404).send('PDF not found');
        }
    } catch (error) {
        if (error instanceof Error) {
            res.status(400).send(error.message);
        } else {
            res.status(500).send('An unexpected error occurred');
        }
    }
});

router.get('/pdfs', (req: Request, res: Response) => {
    try {
        const pdfFiles = listPdfFiles();
        res.json(pdfFiles);
    } catch (error) {
        console.error('Error listing PDF files:', error);
        res.status(500).send('Error listing PDF files');
    }
});

router.get('/pdf-links', (req: Request, res: Response) => {
    const scrapedPdfLinks = getScrapedPdfLinks();
    
    if (Object.keys(scrapedPdfLinks).length === 0) {
        res.status(404).send('No pdf links found');
    } else {
        res.json(scrapedPdfLinks);
    }
});

export default router;