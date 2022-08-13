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

const defaultWeapons = [
    {
        type: "weapon",
        section: "Weapons",
        bulk: 1,
        name: "Melee Blade",
        courses: "",
        cost: "0 sp",
        sp: 0,
        desc: "All Three Rivers Guild adventurers are equipped with a sharp Blade to keep at their side for "
            + "close quarters encounters. You can make a melee attack at adjacent enemies. This weapon uses "
            + "your Dexterity as its weapon Attribute and deals 1d6+3 damage.",
        attr: "dex",
        dmg: "1d6+3",
        range: 1
    },
    {
        type: "weapon",
        section: "Weapons",
        bulk: 1,
        name: "Ranged Sidearm",
        courses: "",
        cost: "0 sp",
        sp: 0,
        desc: "All Three Rivers Guild adventurers are equipped with a Sidearm pistol that can shoot at a distance. "
            + "You can make a ranged attack at anything you can see. This weapon uses your Dexterity as its weapon "
            + "Attribute and deals 1d6 damage.",
        attr: "dex",
        dmg: "1d6",
        range: 15
    },
];

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
    const items = equipment.concat(consumables, containers, defaultWeapons);
    const itemStr = JSON.stringify(items);
    // write to file
    fs.writeFileSync('items.json', itemStr);
};

runScript();
