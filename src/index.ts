
const express = require('express');
const { scrapeForPDF } = require('./scrape-links');
import { GoogleGenAI, Schema, Type } from "@google/genai";
import { writeFile, existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from "fs";
const path = require('path');
import mime from 'mime';
const crypto = require('crypto');

const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
const SIX_MENSA_BASE_URL = "https://www.betriebsrestaurants-migros.ch"

const imagesDir = path.join(__dirname, 'images');
if (!existsSync(imagesDir)) {
  mkdirSync(imagesDir, { recursive: true });
}

const pdfsDir = path.join(__dirname, 'pdfs');
if (!existsSync(pdfsDir)) {
  mkdirSync(pdfsDir, { recursive: true });
}

const processedDataDir = path.join(__dirname, 'processed');
if (!existsSync(processedDataDir)) {
  mkdirSync(processedDataDir, { recursive: true });
}

const menuItemSchema: Schema = {
    type: Type.OBJECT,
    description: "Information about a menu",
    properties: {
        title: {
            type: Type.STRING,
            description: "The title of the menu"
        },
        description: {
            type: Type.STRING,
            description: "The description of the menu"
        },
        type: {
            type: Type.STRING,
            description: "The type of the menu (e.g. Local, Vegi, Globetrotter, Buffet, Global, Pizza & Pasta)",
            example: ["Local", "Vegi", "Globetrotter", "Buffet", "Global", "Pizza & Pasta"]
        },
        dietaryType: {
            type: Type.STRING,
            description: "Indicates if the menu is meat-based, vegetarian, or vegan",
            enum: ["meat", "vegetarian", "vegan"],
            example: "meat"
        },
        price: {
            type: Type.OBJECT,
            description: "The price of the menu",
            properties: {
                intern: {
                    type: Type.NUMBER,
                    description: "The price for employees",
                    example: 7.40
                },
                extern: {
                    type: Type.NUMBER,
                    description: "The price for guests",
                    example: 12.40
                }
            },
            required: ["intern", "extern"]
        },
        origin: {
            type: Type.STRING,
            description: "The origin of the menu",
            example: ["Fleisch: Schwein; Schweiz", "Fleisch: Schweiz", "Fisch: Norwegen"],
        },
        allergens: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING,
                description: "The allergens present in the menu",
                example: ["Gluten", "Fisch", "Sesam"]
            }
        }
    },
    required: ["title", "description", "type", "dietaryType", "price", "origin", "allergens"]
}

const menuSchema: Schema = {
    type: Type.ARRAY,
    description: "Array of daily menus, with exactly one object per day",
    items: {
        type: Type.OBJECT,
        description: "All the menus of a specific day (only if there is at least one menu)",
        properties: {
            day: {
                type: Type.STRING,
                example: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"],
                description: "The day of the week"
            },
            date: {
                type: Type.STRING,
                description: "The date of the menu",
                example: ["14. April", "15. September"]
            },
            menues: {
                type: Type.ARRAY,
                items: menuItemSchema,
                description: "Array of menues available for that day",
            }
        },
        required: ["day", "date", "menues"]
    }
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const aiModel = "gemini-2.0-flash";


async function getMenusOfPdf(pdf: ArrayBuffer) {
    const contents = [
        { 
            text: `I want to extract the menu from the PDF file. For each day of the week, return EXACTLY ONE object with all the menus of that day.
            Make sure to include all menues that are available for that day! Don't forget one, that is important!
            
            IMPORTANT: Each day should appear only once in the array, with all menu types (Local, Vegi, Globetrotter, Pizza & Pasta, etc.) as properties of that single day object.
            
            For example, if Monday has Local, Vegi, Globetrotter, and Pizza & Pasta menus, there should be only ONE object for Monday with all these menu types as properties.

            If there are no menus for a specific day, do not include that day in the array. 
            If there is text like "Geschlossen", "Feiertag", and so on a menu, it means that this menu is not available for that day. 
            If that is the case for all menu in a day, do not include that day in the array.

            There is not always a menu of each type for each day, so the properties of the object may be empty.

            For the origin of the menu, please use the format "<Fleisch, Fisch, ....>: <specific-type (optional)> <origin>".
            For example: "Fleisch: Schwein; Schweiz" or "Fleisch: Schweiz" or "Fisch: Norwegen".
            Don't show any numbers at the end of the origin property, only the real origin.
            Only include the origin if it is explicitly mentioned in the menu.
            Don't add stuff like "Vegi: ... " or "Vegi: Schweiz" to the origin property.

            The allergens are listed at the end of each menu item (behind where the origin is in the pdf), please include them in the allergens property.
            Format of it in the pdf: <origin> <allergen1>, <allergen2>, <allergen3>, ...
            Use the mappings found in the pdf file to get the correct allergens as text from the numbers.
            DON'T add them to the origin property. There shouldn't be any comma separated numbers at the end of the origin property.
            
            Always extract the dietary type of the menu (meat, vegetarian, vegan) and add it to the property dietaryType.
            You can determine the dietary type by looking at the type, title, and description of the menu.
            Sometimes there is also an icon next to the menu, which indicates the that is vegan.

            The menu is in German.`
        },
        {
            inlineData: {
                mimeType: 'application/pdf',
                data: Buffer.from(pdf).toString("base64")
            }
        }
    ];
    
    const response = await ai.models.generateContent({
        model: aiModel,
        contents: contents,
        config: {
            temperature: 0.1,  // Reduced temperature for more deterministic results
            responseMimeType: "application/json",
            responseSchema: menuSchema
        }
    });

    if (!response.text) {
        console.error("No response text received");
        return;
    }

    // console.log(response.text)
    // console.log("------------------------------------");

    // Then after getting the response:
    const menuData = JSON.parse(response.text);
    const mergedMenuData = mergeMenusByDay(menuData).map((menu: any) => {
        menu.menues = menu.menues.map((menuItem: any) => {
            menuItem.imagePath = "image/" + createImageId(menuItem.title, menuItem.description);
            return menuItem;
        });
        return menu;
    });
    // console.log(JSON.stringify(mergedMenuData, null, 2));

    return mergedMenuData;
}

async function translateToEnglish(menu: any) {
    const response = await ai.models.generateContent({
        model: aiModel,
        contents: [
            {
                text: `Translate the following menu from German to English. 
                Don't add any additional information, just return the menu with all property values translated to English.
                Don't forget anything, that is important!`
            },
            {
                text: JSON.stringify(menu)
            }
        ],
        config: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: menuSchema
        }
    });

    if (!response.text) {
        console.error("No response text received");
        return;
    }

    const translatedMenuData = JSON.parse(response.text).map((translatedMenu: any, menuIndex: number) => {
        translatedMenu.menues = translatedMenu.menues.map((menuItem: any, menuItemIndex: number) => {
            // menuItem.image = menu[menuIndex].menues[menuItemIndex].imagePath;
            menuItem.imagePath = "image/" + createImageId(menuItem.title, menuItem.description);
            return menuItem;
        });
        return translatedMenu;
    });
    return translatedMenuData;
}

async function generateImage(day: string, menu: any) {
    // Create a unique identifier for this menu item
    const menuTitle = menu.title;
    const menuType = menu.type;
    const imageId = createImageId(menuTitle, menu.description);
    
    // Check if the image already exists
    if (imageExists(menuTitle, menu.description)) {
        console.log(`Image for ${menuTitle} already exists, skipping generation`);
        return {
        id: imageId,
        // @ts-ignore
        path: menuImages[imageId].path,
        exists: true
        };
    }

    console.log(`Generating image for ${menuTitle}`);

    const response = await ai.models.generateContentStream({
      model: 'gemini-2.0-flash-preview-image-generation',
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
        responseModalities: [
          'image',
          'text',
        ],
        responseMimeType: 'text/plain',
      }
    });
  
    for await (const chunk of response) {
      if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
        continue;
      }
      if (chunk.candidates[0].content.parts[0].inlineData) {
        const inlineData = chunk.candidates[0].content.parts[0].inlineData;
        let fileExtension = mime.getExtension(inlineData.mimeType || '');
        let buffer = Buffer.from(inlineData.data || '', 'base64');
        const fileName = `${imageId}.${fileExtension}`;
        const filePath = path.join(imagesDir, fileName);
        
        // Save file to disk
        await saveBinaryFile(filePath, buffer);
        
        // Store reference in our menu images object
        if (!menuImages) {
          menuImages = {};
        }
        
        // @ts-ignore
        menuImages[imageId] = {
          path: filePath,
          mimeType: inlineData.mimeType,
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
      else {
        console.log(chunk.text);
      }
    }
    
    return null;
  }

  // Create a function to generate a consistent image ID
function createImageId(menuTitle: string, menuDescription?: string) {
    return crypto.createHash('md5').update(menuTitle + menuDescription).digest('hex').slice(0, 8);
  }
  
  // Helper function to check if an image already exists
  function imageExists(menuTitle: string, menuDescription?: string) {
    const imageId = createImageId(menuTitle, menuDescription);
    // console.log(`Checking if image exists for ${menuTitle} with ID ${imageId}`);
    // console.log(`${menuType.replace(/\s+/g, '-')}_${menuTitle.replace(/\s+/g, '_')}`.replace(/[^a-zA-Z0-9_-]/g, "_"));

    if (menuImages && menuImages[imageId]) {
      const imagePath = menuImages[imageId].path;
      // Also verify the file exists on disk
      return existsSync(imagePath);
    }
    
    return false;
  }
  

function saveBinaryFile(filePath: string, content: Buffer<ArrayBuffer>) {
    // Ensure directory exists
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

  async function generateAllMenuImages(menus: any[]) {
    console.log(`Starting image generation for menus...`);
    
    // Delay between image generation requests (in milliseconds)
    const IMAGE_GENERATION_DELAY = 20000; // 20 seconds
    
    // Process each day's menu
    for (const dayMenu of menus) {
      const day = dayMenu.day;
      
      // Process each menu item for this day
      for (const menu of dayMenu.menues.filter((menu: any) => !imageExists(menu.title, menu.description))) {
        try {
          console.log(`Generating image for ${menu.title}`);
          await generateImage(day, menu);
          
          // Wait before processing the next item
          await new Promise(resolve => setTimeout(resolve, IMAGE_GENERATION_DELAY));
        } catch (error) {
          console.error(`Error generating image for ${menu.title}:`, error);
          if (error instanceof Error && error.message.includes("rate limit exceeded")) {
            // Handle rate limit exceeded error
            console.warn(`Rate limit exceeded for ${menu.title}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, IMAGE_GENERATION_DELAY * 2));
          }
        }
      }
    }
    
    console.log(`Completed image generation for menus`);
  }
  
  // Load existing images from disk on startup
  function loadExistingImages() {
    if (!existsSync(imagesDir)) {
      mkdirSync(imagesDir, { recursive: true });
      return;
    }
    
    // Reset the menuImages
    menuImages = {};
    
    try {
      // Scan the images directory
      const files = readdirSync(imagesDir);
      
      for (const file of files) {
        const filePath = path.join(imagesDir, file);
        const stat = statSync(filePath);
        
        // Skip directories
        if (stat.isDirectory()) continue;
        
        // Parse the filename to extract metadata
        // Expected format: restaurant_day_menuType_menuTitle.extension
        const fileNameWithoutExt = path.basename(file, path.extname(file));
        const parts = fileNameWithoutExt.split('_');
        
        if (parts.length >= 2) {          
            const menuType = parts[0];
            const menuTitle = parts.slice(1).join('_');
            const imageId = fileNameWithoutExt;
            
            // Add to the menuImages object
            if (!menuImages) {
                menuImages = {};
            }
            
            // @ts-ignore
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
  

function mergeMenusByDay(menus: any[]): any[] {
    const mergedMenus: { [key: string]: any } = {};
    
    for (const menu of menus) {
        const key = `${menu.date}_${menu.day}`;
        
        // Initialize the merged menu if it doesn't exist
        if (!mergedMenus[key]) {
            mergedMenus[key] = {
                date: menu.date,
                day: menu.day,
                menues: []
            };
        }
        
        // Add menus from the current object's "menues" array (if it exists)
        if (menu.menues && Array.isArray(menu.menues)) {
            mergedMenus[key].menues = [
                ...mergedMenus[key].menues,
                ...menu.menues
            ];
        }
    }
    
    return Object.values(mergedMenus);
}

async function getOptionalChangedContent(pdfLink: string, restaurantId: 'htp' | 'ht201') {
    // Generate a filename based on restaurant ID and current date
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const week = Math.ceil(date.getDate() / 7);
    
    // Create a unique filename for the PDF
    const pdfFileName = `${restaurantId}_${year}_${month}_week${week}.pdf`;
    const pdfFilePath = path.join(pdfsDir, pdfFileName);
    
    // Check if we have a locally stored version
    let localContentExists = existsSync(pdfFilePath);
    let localContent: ArrayBuffer | undefined;
    
    if (localContentExists) {
        try {
            // Read the existing file
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
        const response = await fetch(pdfLink);
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

// Function to save processed menu data
function saveProcessedMenu(restaurant: 'htp' | 'ht201', data: any[], isTranslated = false) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const week = Math.ceil(date.getDate() / 7);
    
    // Create a filename for the processed data
    const suffix = isTranslated ? 'translated' : 'parsed';
    const fileName = `${restaurant}_${year}_${month}_week${week}_${suffix}.json`;
    const filePath = path.join(processedDataDir, fileName);
    
    try {
      writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`Saved ${isTranslated ? 'translated' : 'parsed'} menu data for ${restaurant} to ${filePath}`);
      return true;
    } catch (error) {
      console.error(`Error saving ${isTranslated ? 'translated' : 'parsed'} menu data for ${restaurant}:`, error);
      return false;
    }
  }
  
  // Function to load processed menu data
  function loadProcessedMenu(restaurant: 'htp' | 'ht201', isTranslated = false) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const week = Math.ceil(date.getDate() / 7);
    
    // Create a filename for the processed data
    const suffix = isTranslated ? 'translated' : 'parsed';
    const fileName = `${restaurant}_${year}_${month}_week${week}_${suffix}.json`;
    const filePath = path.join(processedDataDir, fileName);
    
    if (!existsSync(filePath)) {
      console.log(`No saved ${isTranslated ? 'translated' : 'parsed'} menu data found for ${restaurant}`);
      return null;
    }
    
    try {
      const data = readFileSync(filePath, 'utf8');
      const parsedData = JSON.parse(data);
      console.log(`Loaded ${isTranslated ? 'translated' : 'parsed'} menu data for ${restaurant} from ${filePath}`);
      return parsedData;
    } catch (error) {
      console.error(`Error loading ${isTranslated ? 'translated' : 'parsed'} menu data for ${restaurant}:`, error);
      return null;
    }
  }

  function doesProcessedAndTranslatedExist(restaurant: 'htp' | 'ht201') {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const week = Math.ceil(date.getDate() / 7);
    
    // Create a filename for the processed data
    const fileName = `${restaurant}_${year}_${month}_week${week}_parsed.json`;
    const filePath = path.join(processedDataDir, fileName);
    
    if (!existsSync(filePath)) {
      console.log(`No saved ${restaurant} menu data found`);
      return false;
    }

    // Check if the translated file exists
    const translatedFileName = `${restaurant}_${year}_${month}_week${week}_translated.json`;
    const translatedFilePath = path.join(processedDataDir, translatedFileName);

    if (!existsSync(translatedFilePath)) {
        console.log(`No saved ${restaurant} translated menu data found`);
        return false;
        }
    
    return true;
  }
  

const app = express()
const port = process.env.port || 3000;

let pdfContent: {
    htp?: ArrayBuffer,
    ht201?: ArrayBuffer
} = {
    htp: undefined,
    ht201: undefined
}

let processedMenu: {
    htp: any[],
    ht201: any[]
} = {
    htp: [],
    ht201: []
};

let translatedMenus: {
    htp: any[],
    ht201: any[]
} = {
    htp: [],
    ht201: []
};

let menuImages: {
    [key: string]: any
} = {};

let scrapedPdfLinks = {}

async function updateMenus() {
    console.log('Updating menus...');
    const pdfLinks = await scrapeForPDF("https://www.betriebsrestaurants-migros.ch/landingpages/six/info-menuplan", [
        { name: "HTP", pattern: "/media/[a-zA-Z0-9]+/.*menueplan.+htp.+pdf$" },
        { name: "HT201", pattern: "/media/[a-zA-Z0-9]+/.*menueplan.+ht201.+pdf$" }
    ]);

    if (!pdfLinks) {
        console.warn("Failed to fetch pdf links")
        return
    }

    // Add base URL to each PDF link
    for (const key in pdfLinks) {
        if (pdfLinks[key]) {
            pdfLinks[key] = `${SIX_MENSA_BASE_URL}${pdfLinks[key]}`;
        }
    }

    scrapedPdfLinks = pdfLinks

    if (pdfLinks.HTP) {
        const optionalContent = await getOptionalChangedContent(pdfLinks.HTP, 'htp');
        if (optionalContent) {
            pdfContent.htp = optionalContent;
            processedMenu.htp = await getMenusOfPdf(optionalContent) || [];
            saveProcessedMenu('htp', processedMenu.htp);
            translatedMenus.htp = await translateToEnglish(processedMenu.htp) || [];
            saveProcessedMenu('htp', translatedMenus.htp, true);
        } else {
            console.debug("No changes detected in the PDF content for HTP");
            // Try to load saved data
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
        const optionalContent = await getOptionalChangedContent(pdfLinks.HT201, 'ht201');
        if (optionalContent) {
            pdfContent.ht201 = optionalContent;
            processedMenu.ht201 = await getMenusOfPdf(optionalContent) || [];
            saveProcessedMenu('ht201', processedMenu.ht201);
            translatedMenus.ht201 = await translateToEnglish(processedMenu.ht201) || [];
            saveProcessedMenu('ht201', translatedMenus.ht201, true);
        } else {
            console.debug("No changes detected in the PDF content for HT201");
            // Try to load saved data
            const loadedHt201Menu = loadProcessedMenu('ht201');
            const loadedHt201Translated = loadProcessedMenu('ht201', true);
            
            if (loadedHt201Menu && loadedHt201Translated) {
                processedMenu.ht201 = loadedHt201Menu;
                translatedMenus.ht201 = loadedHt201Translated;
                console.log('Using cached menu data for HT201');
            }
        }
    }

    generateAllMenuImages(Object.values(translatedMenus).flat())

    console.log('Menus updated successfully');
}

// function tryLoadSavedData() {
//     console.log('Trying to load saved menu data...');
//     let dataLoaded = false;
    
//     // Try to load HTP data
//     const loadedHtpMenu = loadProcessedMenu('htp');
//     const loadedHtpTranslated = loadProcessedMenu('htp', true);
    
//     if (loadedHtpMenu && loadedHtpTranslated) {
//         processedMenu.htp = loadedHtpMenu;
//         translatedMenus.htp = loadedHtpTranslated;
//         dataLoaded = true;
//         console.log('Loaded saved menu data for HTP');
//     }
    
//     // Try to load HT201 data
//     const loadedHt201Menu = loadProcessedMenu('ht201');
//     const loadedHt201Translated = loadProcessedMenu('ht201', true);
    
//     if (loadedHt201Menu && loadedHt201Translated) {
//         processedMenu.ht201 = loadedHt201Menu;
//         translatedMenus.ht201 = loadedHt201Translated;
//         dataLoaded = true;
//         console.log('Loaded saved menu data for HT201');
//     }
    
//     return dataLoaded;
// }

// Initialize the application
async function initialize() {
    console.log('Initializing application...');
    
    // First load existing images
    loadExistingImages();
    
    // // Try to load saved menu data
    // tryLoadSavedData();
    
    // Update menus to check for new data
    await updateMenus();
    
    // Set up periodic updates
    setInterval(updateMenus, REFRESH_INTERVAL);
}

app.use(express.json()); // Add middleware to parse JSON bodies

// Endpoint to trigger image generation for a specific menu
app.post('/generate-image', async (req, res) => {
  const { day, menu } = req.body;

  try {
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
    res.status(500).send('Error generating image: ' + error.message);
  }
});

app.get('/image/:imageId', (req, res) => {
    const { imageId } = req.params;

    const dayIndex = Object.values(processedMenu).flat().findIndex((menu) => {
        return menu.menues.some((menuItem: any) => {
          return menuItem.imagePath.split("/")[1].toLowerCase() === imageId.toLowerCase();
        });
      });

      const menuIndex = dayIndex === -1 ? -1 : Object.values(processedMenu).flat()[dayIndex]?.menues.findIndex((menuItem: any) => {
        return menuItem.imagePath.split("/")[1].toLowerCase() === imageId.toLowerCase();
      });

      console.log(menuIndex)
  
      const correctImageId = menuIndex === -1 ? imageId : Object.values(translatedMenus).flat()[dayIndex]?.menues[menuIndex].imagePath.split("/")[1].toLowerCase();

      console.log(correctImageId)
        
    // Check if the image exists
    const image = Object.entries(menuImages).map(([id, image]) => {
        return {
            id,
            ...image
        };
    }).find(image => {
        return image.id == correctImageId;
    });

    // @ts-ignore
    if (image) {
      // If we have a file path, send the file
      if (image.path && existsSync(image.path)) {
        res.set('Content-Type', image.mimeType);
        return res.sendFile(path.resolve(image.path));
      }
    }
    
    res.status(404).send('Image not found');
  });
  

  app.get('/pdf/:restaurant', (req, res) => {
    const { restaurant } = req.params;
    
    if (restaurant !== 'htp' && restaurant !== 'ht201') {
        return res.status(400).send('Invalid restaurant');
    }
    
    // Get the current date info
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const week = Math.ceil(date.getDate() / 7);
    
    // Find the PDF file
    const pdfFileName = `${restaurant}_${year}_${month}_week${week}.pdf`;
    const pdfFilePath = path.join(pdfsDir, pdfFileName);
    
    if (existsSync(pdfFilePath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${pdfFileName}"`);
        return res.sendFile(path.resolve(pdfFilePath));
    } else {
        res.status(404).send('PDF not found');
    }
});

// Add an endpoint to list all available PDFs
app.get('/pdfs', (req, res) => {
    try {
        const files = readdirSync(pdfsDir);
        const pdfFiles = files.filter(file => file.endsWith('.pdf'))
            .map(file => {
                const stats = statSync(path.join(pdfsDir, file));
                return {
                    name: file,
                    size: stats.size,
                    lastModified: stats.mtime,
                    url: `/pdf/${file.split('_')[0]}`
                };
            });
            
        res.json(pdfFiles);
    } catch (error) {
        console.error('Error listing PDF files:', error);
        res.status(500).send('Error listing PDF files');
    }
});

app.get('/processed', (req, res) => {
    try {
        const files = readdirSync(processedDataDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'))
            .map(file => {
                const stats = statSync(path.join(processedDataDir, file));
                return {
                    name: file,
                    size: stats.size,
                    lastModified: stats.mtime
                };
            });
            
        res.json(jsonFiles);
    } catch (error) {
        console.error('Error listing processed data files:', error);
        res.status(500).send('Error listing processed data files');
    }
});

app.get('/:restaurant/:weekdayIndex', (req, res) => {
    const { restaurant, weekdayIndex } = req.params;
    const { language } = req.query;

    if (restaurant !== 'htp' && restaurant !== 'ht201') {
        return res.status(400).send('Invalid restaurant');
    }
    const verifiedRestaurant = restaurant as 'htp' | 'ht201';

    const restaurantMenues = language == 'en' ? translatedMenus[verifiedRestaurant] : processedMenu[verifiedRestaurant];
    const retrievedMenues = weekdayIndex == -1 ? restaurantMenues : restaurantMenues[weekdayIndex];
    if (retrievedMenues) {
        res.json(retrievedMenues);
    } else {
        res.status(404).send('Menu not found');
    }
});

app.get("/pdf-links", (req, res) => {
    if (Object.keys(scrapedPdfLinks).length === 0) {
        res.status(404).send('No pdf links found')
    }

    res.json(scrapedPdfLinks)
})

/*httpsServer*/
app.listen(port, () => {
    console.log(`SIX Mensa API listening on port ${port}`)
})

initialize()
    .catch(err => {
        console.error('Error during initialization:', err);
        process.exit(1);
    });