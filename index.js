const https = require('https');
const pdf = require('pdf-parse');

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
    const dayRegex = /(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s*\d{1,2}\.\s*[A-Za-z]+\s*([\s\S]*?)(?=(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|$))/g;
    let match;
    let menus = [];

    while ((match = dayRegex.exec(text)) !== null) {
        const dayMenu = match[2];
        const items = splitByPrice(dayMenu);

        // Check for special case like 'Buffet' being a single word
        if (menuCategories.includes('Buffet') && items[2] && items[2].split(' ').length === 1) {
            items.splice(2, 0, null); // Insert null for Buffet
        }

        let menu = { day: match[1] };
        menuCategories.forEach((category, index) => {
            menu[category] = cleanMenu(items[index]);
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

function splitByPrice(menu) {
  const priceRegex = /Intern\s*\d+\.\d+\s*\/\s*Extern\s*\d+\.\d+/g;
  const meatFishRegex = /Fleisch.*|Fisch.*|Meeresfrüchte.*|\s*$/g;
  const items = menu.split(priceRegex).map(item => item.trim()).filter(item => item);
  return items.map(item => item.replace(meatFishRegex, '').trim());
}

function cleanMenu(menu) {
  if (!menu || menu === 'Geschlossen' || menu.includes('Für Fragen zu den einzelnen Gerichten')) {
      return undefined;
  }
  return menu.replace(/\s+/g, ' ');
}

const express = require('express');
const { log } = require('console');
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
    const { restaurant, weekdayIndex } = req.params;
    console.log("Restaurant:", restaurant, "Weekday:", weekdayIndex);

    // Determine the URL based on the restaurant
    const pdfUrl = restaurant === 'htp'
        ? "https://www.betriebsrestaurants-migros.ch/media/k5dnh0sd/landingpage_menueplan_htp.pdf"
        : "https://www.betriebsrestaurants-migros.ch/media/x4vjg4pd/menueplan_six-ht201.pdf";

    https.get(pdfUrl, function(pdfRes) {
        const data = [];

        pdfRes.on('data', function(chunk) {
            data.push(chunk);
        }).on('end', function() {
            const buffer = Buffer.concat(data);
            pdf(buffer).then(function(data) {
                res.send(extractMenus(restaurant, data.text, weekdayIndex));
            });
        });
    });
});

/*httpsServer*/app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

