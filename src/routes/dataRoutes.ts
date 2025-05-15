import express, { Request, Response } from 'express';
import { listJsonFiles } from '../services/fileService';
import path from 'path';

const router = express.Router();

router.get('/processed', (req: Request, res: Response) => {
    try {
        const processedDataDir = path.join(process.cwd(), 'processed');
        const jsonFiles = listJsonFiles(processedDataDir);
        res.json(jsonFiles);
    } catch (error) {
        console.error('Error listing processed data files:', error);
        res.status(500).send('Error listing processed data files');
    }
});

export default router;