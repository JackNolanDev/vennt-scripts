const axios = require('axios').default;
const cheerio = require('cheerio');
const fs = require('fs')

const EQUIPMENT_URL = 'https://vennt.fandom.com/wiki/Equipment';
const CONSUMABLE_URL = 'https://vennt.fandom.com/wiki/Consumables';
const CONTAINER_URL = 'https://vennt.fandom.com/wiki/Item_Containers';

const specialBulkMap = {
    "Camping Supplies": 5,
    "Tinker's Kit": 5,
    Ornithopter: 5,
    "Fighter Candy": 0,
}

const parseTable = ($, selector, type, section) => {
    const items = [];
    // Adventuring Gear table
    const table = $(selector);
    const tableElements = table.children('tr');
    tableElements.each((idx, row) => {
        if (idx === 0) {
            // first row for wiki tables is header
            return;
        }
        const item = { type, section, bulk: 1 };
        const rowElements = $(row).children('td');
        rowElements.each((idx, el) => {
            const text = $(el).text();
            const cleanedText = text.replace(/\n/gm, '');
            switch (idx) {
                case 0:
                    item.name = cleanedText;
                    // include data that's hard to automatically parse
                    if (specialBulkMap[cleanedText] !== undefined) {
                        item.bulk = specialBulkMap[cleanedText];
                    }
                    break;
                case 1:
                    let courseText = cleanedText;
                    // '-' sometimes signifies no course required
                    if (cleanedText === '-') {
                        courseText = '';
                    }
                    item.courses = courseText;
                    break;
                case 2:
                    item.cost = cleanedText;
                    const numVal = parseInt(cleanedText);
                    if (cleanedText.includes('sp') && !isNaN(numVal)) {
                        item.sp = numVal;
                    }
                    break;
                case 3:
                    item.desc = cleanedText;
                    break;
            }
        });
        items.push(item);
    });
    return items;
}

const runScript = async () => {
    const equipment = await axios.get(EQUIPMENT_URL).then((response) => {
        const $ = cheerio.load(response.data);
        // Adventuring Gear table
        const gear = parseTable($, '#mw-content-text > div > table:nth-child(6) > tbody', 'equipment', 'Adventuring Gear');
        // Unusual Devices table
        const devices = parseTable($, '#mw-content-text > div > table:nth-child(10) > tbody', 'equipment', 'Unusual Devices');
        return gear.concat(devices);
    });
    const consumables = await axios.get(CONSUMABLE_URL).then((response) => {
        const $ = cheerio.load(response.data);
        // Mundane Consumables table
        const mundane = parseTable($, '#mw-content-text > div > table:nth-child(7) > tbody', 'consumable', 'Mundane Consumables');
        // Unusual Consumables table
        const unusual = parseTable($, '#mw-content-text > div > table:nth-child(11) > tbody', 'consumable', 'Unusual Consumables');
        return mundane.concat(unusual);
    });
    const containers = await axios.get(CONTAINER_URL).then((response) => {
        const $ = cheerio.load(response.data);

        const items = [];
        const table = $('#mw-content-text > div > table > tbody');
        const tableElements = table.children('tr');
        tableElements.each((idx, row) => {
            if (idx === 0) {
                // first row for wiki tables is header
                return;
            }
            const item = { type: "container", section: "Item Containers", courses: "" };
            const rowElements = $(row).children('td');
            rowElements.each((idx, el) => {
                const text = $(el).text();
                const cleanedText = text.replace(/\n/gm, '');
                switch (idx) {
                    case 0:
                        item.name = cleanedText;
                        break;
                    case 1:
                        item.cost = cleanedText;
                        const numVal = parseInt(cleanedText);
                        if (cleanedText.includes('sp') && !isNaN(numVal)) {
                            item.sp = numVal;
                        }
                        break;
                    case 2:
                        let bulk = parseInt(cleanedText);
                        if (isNaN(bulk)) {
                            bulk = 0;
                        }
                        item.bulk = bulk;
                        break;
                    case 3:
                        item.desc = cleanedText;
                        break;
                }
            });
            items.push(item);
        });
        return items;
    })
    const items = equipment.concat(consumables, containers);
    const itemStr = JSON.stringify(items);
    // write to file
    fs.writeFileSync('items.json', itemStr);
};

runScript();
