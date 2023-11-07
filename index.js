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

function extractHTPMenus(text, weekdayIndex) {
  const weekdayName = indexToGermanWeekday(+weekdayIndex)
  const dayRegex = /(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s*\d{1,2}\.\s*[A-Za-z]+\s*([\s\S]*?)(?=(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|$))/g;
  let match;
  let menus = [];

  while ((match = dayRegex.exec(text)) !== null) {
      const dayMenu = match[2];
      const items = splitByPrice(dayMenu);

      // Check if third menu is a single word (Buffet)
      if (items[2] && items[2].split(' ').length === 1) {
          items.splice(2, 0, null); // Insert null for Globetrotter
      }

      menus.push({
          day: match[1],
          Local: cleanMenu(items[0]),
          Vegi: cleanMenu(items[1]),
          Globetrotter: cleanMenu(items[2]),
          Buffet: cleanMenu(items[3])
      });
  }

  if (weekdayName && weekdayIndex >= 0) {
    menus = menus.filter(menu => menu.day == weekdayName)[0]
  }

  return menus;
}

function extractHT201Menus(text, weekdayIndex) {
  const weekdayName = indexToGermanWeekday(+weekdayIndex)
  const dayRegex = /(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s*\d{1,2}\.\s*[A-Za-z]+\s*([\s\S]*?)(?=(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|$))/g;
  let match;
  let menus = [];

  while ((match = dayRegex.exec(text)) !== null) {
      const dayMenu = match[2];
      const items = splitByPrice(dayMenu);

      // Check if third menu is a single word (Buffet)
      if (items[2] && items[2].split(' ').length === 1) {
          items.splice(2, 0, null); // Insert null for Globetrotter
      }

      menus.push({
          day: match[1],
          Local: cleanMenu(items[0]),
          Global: cleanMenu(items[1]),
          Vegi: cleanMenu(items[2]),
          "Pizza & Pasta": cleanMenu(items[3])
      });
  }

  if (weekdayName && weekdayIndex >= 0) {
    menus = menus.filter(menu => menu.day == weekdayName)[0]
  }

  return menus;
}

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

app.get('/htp/:weekdayIndex', (req, res) => {
  console.log("Weekday", req.params.weekdayIndex)

  https.get("https://www.betriebsrestaurants-migros.ch/media/k5dnh0sd/landingpage_menueplan_htp.pdf", function(pdfRes) {
    var data = [];

    pdfRes.on('data', function(chunk) {
        data.push(chunk);
    }).on('end', function() {
        //at this point data is an array of Buffers
        //so Buffer.concat() can make us a new Buffer
        //of all of them together
        var buffer = Buffer.concat(data);
        pdf(buffer).then(function(data) {
 
          // number of pages
          // console.log(data.numpages);
          // number of rendered pages
          // console.log(data.numrender);
          // PDF info
          // console.log(data.info);
          // PDF metadata
          // console.log(data.metadata); 
          // PDF.js version
          // check https://mozilla.github.io/pdf.js/getting_started/
          // console.log(data.version);
          // PDF text
          // console.log(data.text);   

          //console.log(extractMenus(data.text))
          res.send(extractHTPMenus(data.text, req.params.weekdayIndex))
      });
        //console.log(buffer.toString('base64'));
    });
})});

app.get('/ht201/:weekdayIndex', (req, res) => {
  console.log("Weekday", req.params.weekdayIndex)

  https.get("https://www.betriebsrestaurants-migros.ch/media/x4vjg4pd/menueplan_six-ht201.pdf", function(pdfRes) {
    var data = [];

    pdfRes.on('data', function(chunk) {
        data.push(chunk);
    }).on('end', function() {
        //at this point data is an array of Buffers
        //so Buffer.concat() can make us a new Buffer
        //of all of them together
        var buffer = Buffer.concat(data);
        pdf(buffer).then(function(data) {
          //console.log(extractMenus(data.text))
          res.send(extractHT201Menus(data.text, req.params.weekdayIndex))
      });
    });
})});

/*httpsServer*/app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

