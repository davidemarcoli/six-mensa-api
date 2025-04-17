
const express = require('express');
const { scrapeForPDF } = require('./scrape-links');
import { GoogleGenAI, Schema, Type } from "@google/genai";

const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
const SIX_MENSA_BASE_URL = "https://www.betriebsrestaurants-migros.ch"

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
                enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
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
    const mergedMenuData = mergeMenusByDay(menuData);
    console.log(JSON.stringify(mergedMenuData, null, 2));

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

    const translatedMenu = JSON.parse(response.text);
    return translatedMenu;
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

function getOptionalChangedContent(pdfLink: string, oldPdfContent: ArrayBuffer | undefined) {
    return fetch(pdfLink)
        .then((response) => response.arrayBuffer())
        .then((newPdfContent) => {

            const a = oldPdfContent ? new Uint8Array(oldPdfContent, 0) : undefined;
            const b = new Uint8Array(newPdfContent, 0);

            const areEqual = a?.length === b.length && a?.every((val, index) => val === b[index]);

            if (!areEqual) {
                return newPdfContent;
            }
            return undefined;
        })
        .catch((error) => {
            console.error("Error fetching PDF:", error);
            return undefined;
        });
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
        const optionalContent = await getOptionalChangedContent(pdfLinks.HTP, pdfContent.htp);
        if (optionalContent) {
            pdfContent.htp = optionalContent;
            processedMenu.htp = await getMenusOfPdf(optionalContent) || [];
            translatedMenus.htp = await translateToEnglish(processedMenu.htp) || [];
        } else {
            console.debug("No changes detected in the PDF content for HTP");
        }
    }

    if (pdfLinks.HT201) {
        const optionalContent = await getOptionalChangedContent(pdfLinks.HT201, pdfContent.ht201);
        if (optionalContent) {
            pdfContent.ht201 = optionalContent;
            processedMenu.ht201 = await getMenusOfPdf(optionalContent) || [];
            translatedMenus.ht201 = await translateToEnglish(processedMenu.ht201) || [];
        } else {
            console.debug("No changes detected in the PDF content for HT201");
        }
    }

    console.log('Menus updated successfully');
}

// Initialize menus on startup
updateMenus();

// Set up periodic updates
setInterval(updateMenus, REFRESH_INTERVAL);

app.get('/:restaurant/:weekdayIndex', (req, res) => {
    const { restaurant, weekdayIndex } = req.params;
    const { language } = req.query;

    if (restaurant !== 'htp' && restaurant !== 'ht201') {
        return res.status(400).send('Invalid restaurant');
    }

    const restaurantMenues = language == 'en' ? translatedMenus[restaurant] : processedMenu[restaurant];
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