import express, { Request, Response } from 'express';
import path from 'path';
import { generateImage, getMenuImageById } from '../services/imageService';
import { getProcessedMenus, getTranslatedMenus } from '../services/menuService';
import { MenuItem } from '../types';
import { config } from '../config/constants';

const router = express.Router();

interface GenerateImageRequest {
    day: string;
    menu: MenuItem;
}

router.post('/generate-image', express.json(), async (req: Request, res: Response) => {
    if (!config.ENABLE_IMAGE_GENERATION) {
        res.status(403).json({
            success: false,
            message: 'Image generation is disabled on this server',
        });
    }

    try {
        const { day, menu } = req.body as GenerateImageRequest;
        const result = await generateImage(day, menu);
        
        if (result) {
            res.json({
                success: true,
                message: result.exists ? 'Image already exists' : 'Image generated successfully',
                image: {
                    id: result.id,
                    url: `/image/${result.id}`
                }
            });
        } else {
            res.status(500).send('Failed to generate image');
        }
    } catch (error) {
        console.error('Error generating image:', error);
        res.status(500).send(`Error generating image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});

router.get('/image/:imageId', (req: Request, res: Response) => {
    const { imageId } = req.params;
    const processedMenus = getProcessedMenus();
    const translatedMenus = getTranslatedMenus();

    // Find the correct image ID
    const dayIndex = Object.values(processedMenus).flat().findIndex((menu) => {
        return menu.menues.some((menuItem: MenuItem) => {
            return menuItem.imagePath?.split("/")[1].toLowerCase() === imageId.toLowerCase();
        });
    });

    const menuIndex = dayIndex === -1 ? -1 : Object.values(processedMenus).flat()[dayIndex]?.menues.findIndex((menuItem: MenuItem) => {
        return menuItem.imagePath?.split("/")[1].toLowerCase() === imageId.toLowerCase();
    });

    const correctImageId = menuIndex === -1 ? 
        imageId : 
        Object.values(translatedMenus).flat()[dayIndex]?.menues[menuIndex]?.imagePath?.split("/")[1].toLowerCase() || imageId;

    const image = getMenuImageById(correctImageId);
    
    if (image) {
        res.set('Content-Type', image.mimeType);
        return res.sendFile(path.resolve(image.path));
    }
    
    res.status(404).send('Image not found');
});

export default router;