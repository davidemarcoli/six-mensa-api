import { GoogleGenAI } from "@google/genai";
import { writeFile, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import path from 'path';
import mime from 'mime';
import crypto from 'crypto';
import { config } from '../config/constants';
import { MenuItem, MenuImagesMap, GenerateImageResult, DailyMenu } from '../types';

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
let menuImages: MenuImagesMap = {};

export function createImageId(menuTitle: string, menuDescription: string = ''): string {
    return crypto.createHash('md5').update(menuTitle + menuDescription).digest('hex').slice(0, 8);
}

export function imageExists(menuTitle: string, menuDescription: string = ''): boolean {
    const imageId = createImageId(menuTitle, menuDescription);
    
    if (menuImages && menuImages[imageId]) {
        const imagePath = menuImages[imageId].path;
        return existsSync(imagePath);
    }
    
    return false;
}

export async function generateImage(day: string, menu: MenuItem): Promise<GenerateImageResult | null> {
    if (!config.ENABLE_IMAGE_GENERATION) {
        console.log(`Image generation is disabled via ENABLE_IMAGE_GENERATION=false`);
        return null;
    }

    const menuTitle = menu.title;
    const menuType = menu.type;
    const imageId = createImageId(menuTitle, menu.description);
    
    // Check if the image already exists
    if (imageExists(menuTitle, menu.description)) {
        console.log(`Image for ${menuTitle} already exists, skipping generation`);
        return {
            id: imageId,
            path: menuImages[imageId].path,
            exists: true
        };
    }

    console.log(`Generating image for ${menuTitle}`);

    const response = await ai.models.generateContentStream({
        model: config.IMAGE_AI_MODEL,
        contents: [
            {
                role: "user",
                text: `Create a high-quality, realistic photograph of "${menuTitle}". 
                The dish should be presented on an appropriate serving vessel. 
                Use bright, natural lighting to highlight the texture, colors, and details of the food. 
                The background should be simple and neutral with a shallow depth of field that keeps the focus on the dish. 
                The perspective should be slightly angled from above to showcase all components clearly. 
                The image should look appetizing and professional, like it belongs in a high-end restaurant menu or food magazine.
                Include details from the description: "${menu.description}"`
            },
        ],
        config: {
            responseModalities: ['image', 'text'],
            responseMimeType: 'text/plain',
        }
    });

    const imagesDir = path.join(process.cwd(), 'images');
    
    for await (const chunk of response) {
        if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
            continue;
        }
        if (chunk.candidates[0].content.parts[0].inlineData) {
            const inlineData = chunk.candidates[0].content.parts[0].inlineData;
            let fileExtension = mime.getExtension(inlineData.mimeType || '') || 'jpg';
            let buffer = Buffer.from(inlineData.data || '', 'base64');
            const fileName = `${imageId}.${fileExtension}`;
            const filePath = path.join(imagesDir, fileName);
            
            // Save file to disk
            await saveBinaryFile(filePath, buffer);
            
            // Store reference in our menu images object
            if (!menuImages) {
                menuImages = {};
            }
            
            menuImages[imageId] = {
                path: filePath,
                mimeType: inlineData.mimeType || 'image/jpeg',
                menuTitle,
                menuType,
                day
            };
            
            return {
                id: imageId,
                path: filePath,
                generated: true
            };
        }
    }
    
    return null;
}

export function loadExistingImages(): void {
    const imagesDir = path.join(process.cwd(), 'images');
    
    if (!existsSync(imagesDir)) {
        mkdirSync(imagesDir, { recursive: true });
        return;
    }
    
    // Reset the menuImages
    menuImages = {};
    
    try {
        const files = readdirSync(imagesDir);
        
        for (const file of files) {
            const filePath = path.join(imagesDir, file);
            const stat = statSync(filePath);
            
            // Skip directories
            if (stat.isDirectory()) continue;
            
            const fileNameWithoutExt = path.basename(file, path.extname(file));
            const parts = fileNameWithoutExt.split('_');
            
            if (parts.length >= 2) {          
                const menuType = parts[0];
                const menuTitle = parts.slice(1).join('_');
                const imageId = fileNameWithoutExt;
                
                if (!menuImages) {
                    menuImages = {};
                }
                
                menuImages[imageId] = {
                    path: filePath,
                    mimeType: mime.getType(filePath) || 'application/octet-stream',
                    menuType,
                    menuTitle
                };
            }
        }
        
        console.log('Loaded existing menu images from disk');
    } catch (error) {
        console.error('Error loading existing images:', error);
    }
}

function saveBinaryFile(filePath: string, content: Buffer): Promise<string> {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    
    return new Promise((resolve, reject) => {
        writeFile(filePath, content, (err) => {
            if (err) {
                console.error(`Error writing file ${filePath}:`, err);
                reject(err);
                return;
            }
            console.log(`File ${filePath} saved to file system.`);
            resolve(filePath);
        });
    });
}

export async function generateAllMenuImages(menus: DailyMenu[]): Promise<void> {
    if (!config.ENABLE_IMAGE_GENERATION) {
        console.log(`Image generation is disabled via ENABLE_IMAGE_GENERATION=false`);
        return;
    }

    console.log(`Starting image generation for menus...`);
    
    for (const dayMenu of menus) {
        const day = dayMenu.day;
        
        for (const menu of dayMenu.menues.filter(menu => !imageExists(menu.title, menu.description))) {
            try {
                console.log(`Generating image for ${menu.title}`);
                await generateImage(day, menu);
                
                // Wait before processing the next item
                await new Promise(resolve => setTimeout(resolve, config.IMAGE_GENERATION_DELAY));
            } catch (error) {
                console.error(`Error generating image for ${menu.title}:`, error);
                if (error instanceof Error && error.message.includes("rate limit exceeded")) {
                    console.warn(`Rate limit exceeded for ${menu.title}, retrying...`);
                    await new Promise(resolve => setTimeout(resolve, config.IMAGE_GENERATION_DELAY * 2));
                }
            }
        }
    }
    
    console.log(`Completed image generation for menus`);
}

export function getMenuImageById(imageId: string): { id: string, path: string, mimeType: string } | null {
    const image = Object.entries(menuImages).map(([id, image]) => {
        return { id, ...image };
    }).find(image => image.id === imageId);
    
    if (image && image.path && existsSync(image.path)) {
        return {
            id: image.id,
            path: image.path,
            mimeType: image.mimeType
        };
    }
    
    return null;
}