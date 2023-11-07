const fs = require('fs');
const https = require('https');
const { PdfDataReader } = require("pdf-data-parser");

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
      throw new Error('Invalid German weekday');
  }
}

function extractMenus(data, weekdayIndex) {
  const selectedWeekday = weekdayIndex != -1 ? indexToGermanWeekday(+weekdayIndex) : undefined

  let menus = {};
  let currentDay = null;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    // Check if the row contains a day of the week (e.g., "Montag", "Dienstag", etc.)
    if (((selectedWeekday && row[0] == selectedWeekday) || (!selectedWeekday && row[0].match(/Montag|Dienstag|Mittwoch|Donnerstag|Freitag/))) && row[0].length < 10) {
      console.log("Row", row)
      console.log("Data", data[i + 1])
      currentDay = row[0];
      menus[currentDay] = {
        date: data[i + 1][0],
        local: {
          dish: row[1],
          details: data[i + 1][1],
          sideDishes: []
        },
        vegi: {
          dish: row[2],
          details: data[i + 1][2],
          sideDishes: []
        },
        globetrotter: (row[3] && data[i + 1].length == 4) ? {
          dish: row[3],
          details: data[i + 1][3] || null,
          sideDishes: []
        } : null,
        buffet: (row[3]) ? {
          dish: data[i + 1].length == 3 ? row[3] : row[4],
          details: data[i + 1].length == 3 ? data[i + 1][3] : data[i + 1][4] || null
        } : null
      };

      // Collect side dishes until we hit a price or another day
      let j = i + 2;
      while (!data[j][0].match(/Intern|Montag|Dienstag|Mittwoch|Donnerstag|Freitag/) && j < data.length) {
        console.log("push side dish", data[j][1])
        menus[currentDay].local.sideDishes.push(data[j][0]);
        menus[currentDay].vegi.sideDishes.push(data[j][1]);
        if (menus[currentDay].globetrotter) {
          menus[currentDay].globetrotter.sideDishes.push(data[j][2] || null);
        }
        j++;
      }

      // Assuming the next row after side dishes contains the prices
      menus[currentDay].local.price = data[j][0];
      menus[currentDay].vegi.price = data[j][1];
      if (menus[currentDay].globetrotter) {
        menus[currentDay].globetrotter.price = data[j][2];
      }
    }
  }

  if (selectedWeekday) {
    menus = menus[selectedWeekday]
  }

  return menus;
}

const express = require('express')
const app = express()
const port = process.env.port || 3000;

//const privateKey  = fs.readFileSync('/etc/letsencrypt/live/server.davidemarcoli.dev/privkey.pem', 'utf8');
//const certificate = fs.readFileSync('/etc/letsencrypt/live/server.davidemarcoli.dev/cert.pem', 'utf8');

//const credentials = {key: privateKey, cert: certificate};
//const httpsServer = https.createServer(credentials, app);

app.get('/:weekdayIndex', (req, res) => {
  console.log("Weekday", req.params.weekdayIndex)
  let reader = new PdfDataReader({ url: "https://www.betriebsrestaurants-migros.ch/media/k5dnh0sd/landingpage_menueplan_htp.pdf" });
  var rows = [];
  reader.on('data', (row) => {
    rows.push(row)
  });

  reader.on('end', () => {
    // do something with the rows
    console.log("ROWWSSSS")
    console.log(rows)
    const menus = extractMenus(rows, req.params.weekdayIndex);
    console.log(menus);
    res.send(menus)
  });

  reader.on('error', (err) => {
    // log error
  })
  //res.send('Hello World!')
})


/*httpsServer*/app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
