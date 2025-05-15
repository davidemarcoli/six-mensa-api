import { GoogleGenAI } from "@google/genai";
import { menuSchema } from '../schemas/menuSchema';
import { config } from '../config/constants';
import { addImagePaths } from '../utils/imageUtils';
import { DailyMenu } from '../types';

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

export async function extractMenusFromPdf(pdf: ArrayBuffer): Promise<DailyMenu[]> {
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
        model: config.AI_MODEL,
        contents: contents,
        config: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: menuSchema
        }
    });

    if (!response.text) {
        throw new Error("No response text received from AI");
    }

    const menuData = JSON.parse(response.text) as DailyMenu[];
    return addImagePaths(mergeMenusByDay(menuData));
}

export async function translateToEnglish(menu: DailyMenu[]): Promise<DailyMenu[]> {
    const response = await ai.models.generateContent({
        model: config.AI_MODEL,
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
        throw new Error("No response text received from AI");
    }

    const translatedMenuData = JSON.parse(response.text) as DailyMenu[];
    return addImagePaths(translatedMenuData);
}

function mergeMenusByDay(menus: DailyMenu[]): DailyMenu[] {
    const mergedMenus: Record<string, DailyMenu> = {};
    
    for (const menu of menus) {
        const key = `${menu.date}_${menu.day}`;
        
        if (!mergedMenus[key]) {
            mergedMenus[key] = {
                date: menu.date,
                day: menu.day,
                menues: []
            };
        }
        
        if (menu.menues && Array.isArray(menu.menues)) {
            mergedMenus[key].menues = [
                ...mergedMenus[key].menues,
                ...menu.menues
            ];
        }
    }
    
    return Object.values(mergedMenus);
}