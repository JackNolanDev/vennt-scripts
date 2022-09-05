const axios = require('axios').default;
const cheerio = require('cheerio');
const fs = require('fs')

const weaponTypes = require("../weapon-parser/weaponTypes.json");
const customUses = require("./customUses.json");

const EQUIPMENT_URL = 'https://vennt.fandom.com/wiki/Equipment';
const CONSUMABLE_URL = 'https://vennt.fandom.com/wiki/Consumables';
const CONTAINER_URL = 'https://vennt.fandom.com/wiki/Item_Containers';
const ADVANCED_WEAPONS_URL = 'https://vennt.fandom.com/wiki/Advanced_weapons';
const ADVANCED_AMMO_URL = 'https://vennt.fandom.com/wiki/Advanced_ammo';
const GRENADES_URL = 'https://vennt.fandom.com/wiki/Grenades';
const ARMOR_URL = 'https://vennt.fandom.com/wiki/Armor';

const specialBulkMap = {
    "Camping Supplies": 5,
    "Tinker's Kit": 5,
    Ornithopter: 5,
    "Fighter Candy": 0,
}

const defaultWeapons = [
    {
        type: "weapon",
        section: "Basic Weapons",
        bulk: 1,
        name: "Melee Blade",
        courses: "",
        cost: "0 sp",
        sp: 0,
        desc: "All Three Rivers Guild adventurers are equipped with a sharp Blade to keep at their side for "
            + "close quarters encounters. You can make a melee attack at adjacent enemies. This weapon uses "
            + "your Dexterity as its weapon Attribute and deals 1d6+3 damage.",
        weaponType: "Melee",
        attr: "dex",
        dmg: "1d6+3",
        range: "1m"
    },
    {
        type: "weapon",
        section: "Basic Weapons",
        bulk: 1,
        name: "Ranged Sidearm",
        courses: "",
        cost: "0 sp",
        sp: 0,
        desc: "All Three Rivers Guild adventurers are equipped with a Sidearm pistol that can shoot at a distance. "
            + "You can make a ranged attack at anything you can see. This weapon uses your Dexterity as its weapon "
            + "Attribute and deals 1d6 damage.",
        weaponType: "Ranged",
        attr: "dex",
        dmg: "1d6",
        range: "15m"
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
            const text = $(el).text().trim();
            switch (idx) {
                case 0:
                    item.name = text;
                    // include data that's hard to automatically parse
                    if (specialBulkMap[text] !== undefined) {
                        item.bulk = specialBulkMap[text];
                    }
                    break;
                case 1:
                    let courseText = text;
                    // '-' sometimes signifies no course required
                    if (text === '-') {
                        courseText = '';
                    }
                    item.courses = courseText;
                    break;
                case 2:
                    item.cost = text;
                    const numVal = parseInt(text);
                    if (text.includes('sp') && !isNaN(numVal)) {
                        item.sp = numVal;
                    }
                    break;
                case 3:
                    item.desc = text;
                    break;
            }
        });
        items.push(item);
    });
    return items;
}

const getContainers = (page) => {
    const $ = cheerio.load(page);
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
            const text = $(el).text().trim();
            switch (idx) {
                case 0:
                    item.name = text;
                    break;
                case 1:
                    item.cost = text;
                    const numVal = parseInt(text);
                    if (text.includes('sp') && !isNaN(numVal)) {
                        item.sp = numVal;
                    }
                    break;
                case 2:
                    let bulk = parseInt(text);
                    if (isNaN(bulk)) {
                        bulk = 0;
                    }
                    item.bulk = bulk;
                    break;
                case 3:
                    item.desc = text;
                    break;
            }
        });
        items.push(item);
    });
    return items;
}

const getAdvancedWeapons = (page) => {
    const weaponSections = {
        Type: "category",
        Cost: "cost",
    };
    const weapons = [];
    const $ = cheerio.load(page);
    const weaponHeadlines = $('h3 .mw-headline');
    weaponHeadlines.each((idx, el) => {
        let weapon = { section: "Advanced Weapons", courses: "Weapons" };
        weapon.name = $(el).text();
        const parent = $(el.parent);
        parent.nextUntil('h3').each((idx, el) => {
            const section = $(el).children('b').first().text();
            if (weaponSections[section] !== undefined) {
                let text = $(el).text().substring(section.length + 2);
                text = text.trim(); // clean up the string
                if (weaponSections[section] === "category") {
                    const weaponTemplate = weaponTypes.find(type => type.category === text);
                    if (weaponTemplate !== undefined) {
                        weapon = Object.assign({ ...weaponTemplate }, weapon);
                    }
                } else if (weaponSections[section] === "cost") {
                    const numVal = parseInt(text);
                    if (text.includes('sp') && !isNaN(numVal)) {
                        weapon.sp = numVal;
                    }
                }
                weapon[weaponSections[section]] = text;
            } else {
                const text = $(el).text().trim();
                if (text.length > 5) {
                    const italicsText = $(el).children('i').first().text();
                    if (text === italicsText) {
                        weapon.desc = italicsText;
                    } else {
                        let newSpecial = text;
                        if (weapon.special) {
                            newSpecial = `${weapon.special}. ${text}`;
                        }
                        if (newSpecial.length > 500) {
                            weapon.special = text;
                        } else {
                            weapon.special = newSpecial;
                        }
                    }
                }
            }
        })
        delete weapon.examples;
        weapons.push(weapon);
    });
    return weapons;
}

const getGrenades = (page) => {
    const $ = cheerio.load(page);
    const grenades = [];
    const template = weaponTypes.find(type => type.category === "Grenade");
    const table = $('#mw-content-text > div > table > tbody');
    const tableElements = table.children('tr');
    tableElements.each((idx, row) => {
        if (idx === 0) {
            // first row for wiki tables is header
            return;
        }
        const grenade = { ...template, section: "Grenades" };
        const rowElements = $(row).children('td');
        let specialDmg = "";
        rowElements.each((idx, el) => {
            const text = $(el).text().trim();
            switch (idx) {
                case 0:
                    grenade.name = text;
                    break;
                case 1:
                    let courseText = text;
                    // '-' sometimes signifies no course required
                    if (text === '-') {
                        courseText = '';
                    }
                    grenade.courses = courseText;
                    break;
                case 2:
                    grenade.dmg = text;
                    break;
                case 3:
                    specialDmg = `Blast Damage: ${text}`;
                    break;
                case 4:
                    if (specialDmg.length > 0) {
                        specialDmg = `${specialDmg}, Blast Radius: ${text}.`;
                    }
                    break;
                case 5:
                    grenade.cost = text;
                    const numVal = parseInt(text);
                    if (text.includes('sp') && !isNaN(numVal)) {
                        grenade.sp = numVal;
                    }
                    break;
                case 6:
                    // swap desc and special fields of the base grenade
                    grenade.desc = grenade.special;
                    grenade.special = `${specialDmg} ${text}`;
                    break;
            }
        });
        delete grenade.examples;
        grenades.push(grenade);
    });
    return grenades;
}

const getAdvancedAmmo = (page) => {
    const $ = cheerio.load(page);
    const items = [];
    const table = $('#mw-content-text > div > table > tbody');
    const tableElements = table.children('tr');
    tableElements.each((idx, row) => {
        if (idx === 0) {
            // first row for wiki tables is header
            return;
        }
        const item = { type: "consumable", section: "Advanced Ammo", courses: "weapons", bulk: 0 };
        const rowElements = $(row).children('td');
        rowElements.each((idx, el) => {
            const text = $(el).text().trim();
            switch (idx) {
                case 0:
                    item.name = `${text} Ammo`;
                    break;
                case 1:
                    item.cost = text;
                    const numVal = parseInt(text);
                    if (text.includes('sp') && !isNaN(numVal)) {
                        item.sp = numVal;
                    } else if (text.includes('cp')) {
                        // basically 0
                        item.sp = 0;
                    }
                    break;
                case 2:
                    item.desc = text;
                    break;
            }
        });
        items.push(item);
    });
    return items;
}

getArmor = (page) => {
    const $ = cheerio.load(page);
    const items = [];
    const tables = $('.wikitable');
    tables.each((idx, table) => {
        switch (idx) {
            case 0:
                const armorElements = $(table).children().first().children('tr');
                armorElements.each((idx, row) => {
                    if (idx === 0) {
                        // first row for wiki tables is header
                        return;
                    }
                    const item = { type: "armor", section: "Armor" };
                    const rowElements = $(row).children('td');
                    let armorValue = ''
                    rowElements.each((idx, el) => {
                        const text = $(el).text().trim();
                        switch (idx) {
                            case 0:
                                item.name = text;
                                break;
                            case 1:
                                armorValue = `Armor Value: ${text}`;
                                break;
                            case 2:
                                item.desc = `${armorValue}, Burden: ${text}`
                                break;
                            case 3:
                                let bulk = parseInt(text);
                                if (isNaN(bulk)) {
                                    bulk = 0;
                                }
                                item.bulk = bulk;
                                break;
                            case 4:
                                item.cost = text;
                                const numVal = parseInt(text);
                                if (text.includes('sp') && !isNaN(numVal)) {
                                    item.sp = numVal;
                                }
                                break;
                        }
                    });
                    items.push(item);
                });
                break;
            case 1:
                const shieldElements = $(table).children().first().children('tr');
                shieldElements.each((idx, row) => {
                    if (idx === 0) {
                        // first row for wiki tables is header
                        return;
                    }
                    const item = { type: "shield", section: "Shields" };
                    const rowElements = $(row).children('td');
                    let shieldBonus = ''
                    rowElements.each((idx, el) => {
                        const text = $(el).text().trim();
                        switch (idx) {
                            case 0:
                                item.name = text;
                                break;
                            case 1:
                                shieldBonus = `Shield Bonus: ${text}`;
                                break;
                            case 2:
                                item.special = `Hands Required to Equip: ${text}`;
                                break;
                            case 3:
                                item.desc = `${shieldBonus}, Burden: ${text}`
                                break;
                            case 4:
                                let bulk = parseInt(text);
                                if (isNaN(bulk)) {
                                    bulk = 0;
                                }
                                item.bulk = bulk;
                                break;
                            case 5:
                                item.cost = text;
                                const numVal = parseInt(text);
                                if (text.includes('sp') && !isNaN(numVal)) {
                                    item.sp = numVal;
                                }
                                break;
                        }
                    });
                    items.push(item);
                });
                break;
        }
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
        return getContainers(response.data);
    });
    const advancedWeapons = await axios.get(ADVANCED_WEAPONS_URL).then((response) => {
        return getAdvancedWeapons(response.data);
    });
    const grenades = await axios.get(GRENADES_URL).then((response) => {
        return getGrenades(response.data);
    });
    const advancedAmmo = await axios.get(ADVANCED_AMMO_URL).then((response) => {
        return getAdvancedAmmo(response.data);
    });
    const armor = await axios.get(ARMOR_URL).then((response) => {
        return getArmor(response.data);
    });
    const items = equipment.concat(consumables, advancedAmmo, containers, defaultWeapons, grenades, advancedWeapons, armor);

    // add custom uses
    items.forEach((item) => {
        if (customUses[item.name]) {
            item.uses = customUses[item.name]
        }
    })

    const itemStr = JSON.stringify(items);
    // write to file
    fs.writeFileSync('items.json', itemStr);
};

runScript();
