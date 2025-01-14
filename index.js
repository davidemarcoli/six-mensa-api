const https = require('https');
const pdf = require('pdf-parse');
const axios = require('axios');
const express = require('express');
const { scrapeForPDF } = require('./scrape-links');

const DAY_REGEX = /(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s*\d{1,2}\.\s*[A-Za-z]+\s*([\s\S]*?)(?=(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|$))/g;
const PRICE_REGEX = /(?:\d+\.\d+\s*Intern|Intern\s*(\d+\.\d+))\s*\/\s*(?:\d+\.\d+\s*Extern|Extern\s*(\d+\.\d+))/g;
// const meatFishRegex = /Fleisch:.*|Fisch:.*|Meeresfrüchte:.*$/g;
// const ORIGIN_REGEX = /((F:)|(Fleisch|Fisch|Meeresfrüchte|Geflügel):?)\s*([^,\n]+)(?:,\s*([^,\n]+))?(\n((F:)|(Fleisch|Fisch|Meeresfrüchte|Geflügel):?)\s*([^,\n]+)(?:,\s*([^,\n]+))?)*\s*/;
const ORIGIN_REGEX = /((F:)|(?:Fleisch|Fisch|Meeresfrüchte|Geflügel)(?:\b|(?!\w)):?)\s*([^,\n]+)(?:,\s*([^,\n]+))?(\n((F:)|(?:Fleisch|Fisch|Meeresfrüchte|Geflügel)(?:\b|(?!\w)):?)\s*([^,\n]+)(?:,\s*([^,\n]+))?)*\s*/;

function indexToGermanWeekday(weekdayIndex) {
    switch (weekdayIndex) {
        case 0:
            return 'Montag';
        case 1:
            return 'Dienstag';
        case 2:
            return 'Mittwoch';
        case 3:
            return 'Donnerstag';
        case 4:
            return 'Freitag';
        case 5:
            return 'Samstag';
        case 6:
            return 'Sonntag';
        default:
            return undefined;
        //throw new Error('Invalid German weekday');
    }
}

function extractMenu(text, weekdayIndex, menuCategories) {
    const weekdayName = indexToGermanWeekday(+weekdayIndex);
    let match;
    let menus = [];

    while ((match = DAY_REGEX.exec(text)) !== null) {
        const dayMenu = match[2];
        let splitItems = dayMenu.split(PRICE_REGEX);
        let items = [];
        let prices = [];

        // Process each item and separate prices and menu items
        for (let i = 0; i < splitItems.length; i++) {
            if (i % 3 === 0) { // Menu item
                items.push(splitItems[i]);
            } else { // Price
                prices.push(splitItems[i]);
            }
        }

        let menu = { day: match[1], date: match[0].split("\n")[1].trim() };

        let itemIndex = 0;
        menuCategories.forEach((category, index) => {
            // if (match[1] === 'Montag') {
            //     console.log(category)
            //     console.log(index)
            //     console.log(items.length)
            //     console.log("---------")
            //     console.log(index === menuCategories.length - 2)
            //     console.log(!items[index + 1])
            //     console.log(items.length < 4)
            // }

            if (index === menuCategories.length - 2 && !items[index + 1] && items.length < 4) {
                return;
            }

            // if (index === menuCategories.length - 2 && items.length < 4) {
            //     return;
            // }

            let item = items[itemIndex] ? items[itemIndex].trim() : '';
            let origin = undefined;

            // Check if the next item is the origin
            if (itemIndex < items.length - 1 && ORIGIN_REGEX.test(items[itemIndex + 1])) {
                const match = ORIGIN_REGEX.exec(items[itemIndex + 1]);
                origin = match ? match[0].trim() : undefined;
                if (origin.startsWith('Für Fragen zu den einzelnen Gerichten')) {
                    origin = undefined;
                } else {
                    // if there is a comma separated list of numbers at the end of the origin, remove it
                    origin = origin.replace(/(\d+[,;]?\s?)+$/, '').trim();
                    // if there is a /, comma or ; at the end of the origin, remove it
                    origin = origin.replace(/([\/,;]\s?)+$/, '').trim();
                    items[itemIndex + 1] = items[itemIndex + 1].replace(ORIGIN_REGEX, '').trim();
                }
            }

            // Check if next item is comma separated list of numbers (alergies)
            if (itemIndex < items.length - 1 && items[itemIndex + 1].match(/(\d+[,;]?)+/)) {
                // Skip the alergies
                items[itemIndex + 1] = items[itemIndex + 1].replace(/(\d+[,;]?\s?)+/, '').trim();
            }

            const cleanItem = cleanMenu(item);

            if (cleanItem) {
                menu[category] = {
                    ...cleanItem,
                    price: prices[itemIndex] ? { intern: prices[itemIndex * 2], extern: prices[itemIndex * 2 + 1] } : undefined,
                    origin: origin
                };
            }

            itemIndex++;
        });

        menus.push(menu);
    }

    if (weekdayName && weekdayIndex >= 0) {
        menus = menus.filter(menu => menu.day === weekdayName)[0];
    }

    return menus;
}

// Example usage for HTP menu
const htpMenuCategories = ['Local', 'Vegi', 'Globetrotter', 'Buffet'];
// Use like this: extractMenu(pdfText, weekdayIndex, htpMenuCategories)

// Example usage for HT201 menu
const ht201MenuCategories = ['Local', 'Vegi', 'Global', 'Pizza & Pasta'];
// Use like this: extractMenu(pdfText, weekdayIndex, ht201MenuCategories)

// function cleanMenu(menu) {
//   if (!menu || menu === 'Geschlossen' || menu.includes('Für Fragen zu den einzelnen Gerichten')) {
//       return undefined;
//   }
//   menu = menu.replace(/(\r\n|\n|\r)/gm, ', ').replace(/ ,/g, ',').replace(/&,/g, '&');
//   return menu.replace(/\s+/g, ' ');
// }

function cleanMenu(menu) {
    if (!menu || menu.startsWith("Geschlossen") || menu.includes('Für Fragen zu den einzelnen Gerichten')) {
        return undefined;
    }

    // if there is a comma separated list of numbers at the start of the menu, remove it
    console.log(menu)
    menu = menu.replace(/^(\d*[,;]?\s?)+/, '').trim();
    let splitMenu = menu.split('\n'); // Split the menu into two parts at the first newline
    const title = splitMenu[0].replace(/\s+/g, ' ').trim(); // Clean and trim the title
    if (!title) {
        return undefined;
    }
    splitMenu = splitMenu.splice(1).map(item => item.trim()); // Remove the title from the menu and clean the rest
    let description = splitMenu.length > 0 ? splitMenu.join('\n').replace(/(\r\n|\n|\r)/gm, ', ').replace(/ ,/g, ',').replace(/&,/g, '&').replace(/,\s?,/g, ',').replace(/\s+/g, ' ').trim() : '';

    return { title, description };
}


const app = express()
const port = process.env.port || 3000;

//const privateKey  = fs.readFileSync('/etc/letsencrypt/live/server.davidemarcoli.dev/privkey.pem', 'utf8');
//const certificate = fs.readFileSync('/etc/letsencrypt/live/server.davidemarcoli.dev/cert.pem', 'utf8');

//const credentials = {key: privateKey, cert: certificate};
//const httpsServer = https.createServer(credentials, app);

function extractMenus(restaurant, text, weekdayIndex) {
    // Determine which restaurant's menu to extract
    switch (restaurant) {
        case 'htp':
            return extractMenu(text, weekdayIndex, htpMenuCategories);
        case 'ht201':
            return extractMenu(text, weekdayIndex, ht201MenuCategories);
        default:
            throw new Error('Invalid restaurant');
    }
}

let parsedMenus = {
    htp: {},
    ht201: {}
};

let scrapedPdfLinks = {}

const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
const SIX_MENSA_BASE_URL = "https://www.betriebsrestaurants-migros.ch"

async function fetchAndParsePDF(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const data = await pdf(buffer);
        return data.text;
    } catch (error) {
        console.error(`Error fetching or parsing PDF from ${url}:`, error);
        return null;
    }
}

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
        const htpText = await fetchAndParsePDF(pdfLinks.HTP);
        if (htpText) {
            parsedMenus.htp = extractMenu(htpText, -1, htpMenuCategories)
        }
    }

    if (pdfLinks.HT201) {
        const ht201Text = await fetchAndParsePDF(pdfLinks.HT201);
        if (ht201Text) {
            parsedMenus.ht201 = extractMenu(ht201Text, -1, ht201MenuCategories);
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

    if (restaurant !== 'htp' && restaurant !== 'ht201') {
        return res.status(400).send('Invalid restaurant');
    }

    const menu = weekdayIndex == -1 ? parsedMenus[restaurant] : parsedMenus[restaurant][weekdayIndex];
    if (menu) {
        res.json(menu);
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

