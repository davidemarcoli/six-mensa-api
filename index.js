const https = require('https');
const pdf = require('pdf-parse');

const DAY_REGEX = /(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s*\d{1,2}\.\s*[A-Za-z]+\s*([\s\S]*?)(?=(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|$))/g;
const PRICE_REGEX = /Intern\s*(\d+\.\d+)\s*\/\s*Extern\s*(\d+\.\d+)/g;
// const meatFishRegex = /Fleisch:.*|Fisch:.*|Meeresfrüchte:.*$/g;
const ORIGIN_REGEX = /(Fleisch|Fisch|Meeresfrüchte):\s*([^,\n]+)(?:,\s*([^,\n]+))?(\n(Fleisch|Fisch|Meeresfrüchte):\s*([^,\n]+)(?:,\s*([^,\n]+))?)*\s*/;

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

        let menu = {day: match[1]};

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
                items[itemIndex + 1] = items[itemIndex + 1].replace(ORIGIN_REGEX, '').trim();
            }

            const cleanItem = cleanMenu(item);

            if (cleanItem) {
                menu[category] = {
                    ...cleanItem,
                    price: prices[itemIndex] ? {intern: prices[itemIndex * 2], extern: prices[itemIndex * 2 + 1]} : undefined,
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
const ht201MenuCategories = ['Local', 'Global', 'Vegi', 'Pizza & Pasta'];
// Use like this: extractMenu(pdfText, weekdayIndex, ht201MenuCategories)

// function cleanMenu(menu) {
//   if (!menu || menu === 'Geschlossen' || menu.includes('Für Fragen zu den einzelnen Gerichten')) {
//       return undefined;
//   }
//   menu = menu.replace(/(\r\n|\n|\r)/gm, ', ').replace(/ ,/g, ',').replace(/&,/g, '&');
//   return menu.replace(/\s+/g, ' ');
// }

function cleanMenu(menu) {
    if (!menu || menu === 'Geschlossen' || menu.includes('Für Fragen zu den einzelnen Gerichten')) {
        return undefined;
    }

    let splitMenu = menu.split('\n'); // Split the menu into two parts at the first newline
    const title = splitMenu[0].replace(/\s+/g, ' ').trim(); // Clean and trim the title
    splitMenu = splitMenu.splice(1)
    let description = splitMenu.length > 0 ? splitMenu.join('\n').replace(/(\r\n|\n|\r)/gm, ', ').replace(/ ,/g, ',').replace(/&,/g, '&').replace(/,,/g, ',').replace(/\s+/g, ' ').trim() : '';

    return {title, description};
}


const express = require('express');
const {log} = require('console');
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

// Update route handlers to use the new function
app.get('/:restaurant/:weekdayIndex', (req, res) => {
    const {restaurant, weekdayIndex} = req.params;
    console.log("Restaurant:", restaurant, "Weekday:", weekdayIndex);

    // Determine the URL based on the restaurant
    const pdfUrl = restaurant === 'htp'
        ? "https://www.betriebsrestaurants-migros.ch/media/k5dnh0sd/landingpage_menueplan_htp.pdf"
        : "https://www.betriebsrestaurants-migros.ch/media/x4vjg4pd/menueplan_six-ht201.pdf";

    https.get(pdfUrl, function (pdfRes) {
        const data = [];

        pdfRes.on('data', function (chunk) {
            data.push(chunk);
        }).on('end', function () {
            const buffer = Buffer.concat(data);
            pdf(buffer).then(function (data) {
                res.send(extractMenus(restaurant, data.text, weekdayIndex));
            });
        });
    });
});

/*httpsServer*/
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})

