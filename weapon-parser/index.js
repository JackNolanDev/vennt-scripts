const axios = require('axios').default;
const cheerio = require('cheerio');
const fs = require('fs')

const WEAPONS_URL = 'https://vennt.fandom.com/wiki/Weapons';

const sectionMap = {
    Type: "type",
    Range: "range",
    Bulk: "bulk",
    Attribute: "attr",
    "Common Examples": "examples",
    Cost: "cost",
    Damage: "dmg",
    Special: "special"
}

const attrMap = {
    Agility: "agi",
    Dexterity: "dex",
    Charisma: "cha",
    Intelligence: "int",
    Perception: "per",
    Spirit: "spi",
    Strength: "str",
    Technology: "tek",
    Wisdom: "wis",
}

const getWeaponTypes = (page) => {
    const weapons = [];
    const $ = cheerio.load(page);
    const weaponHeadlines = $('h3 .mw-headline');
    weaponHeadlines.each((idx, el) => {
        const weapon = {};
        weapon.category = $(el).text();
        const parent = $(el.parent);
        parent.nextUntil('h3').each((idx, el) => {
            const section = $(el).children('b').first().text();
            if (sectionMap[section] !== undefined) {
                let text = $(el).text().substring(section.length + 2);
                text = text.trim(); // clean up the string
                if (sectionMap[section] === "attr") {
                    for (const [old, rep] of Object.entries(attrMap)) {
                        text = text.replace(old, rep); // rewrite attributes
                    }
                } else if (sectionMap[section] === "bulk") {
                    let bulk = parseInt(text);
                    if (isNaN(bulk)) {
                        bulk = 0;
                    }
                    text = bulk;
                } else if (sectionMap[section] === "cost") {
                    const numVal = parseInt(text);
                    if (text.includes('sp') && !isNaN(numVal)) {
                        weapon.sp = numVal;
                    }
                }
                weapon[sectionMap[section]] = text;
            } else {
                const text = $(el).text().trim();
                if (text.length > 5) {
                    weapon.desc = text;
                }
            }
        })
        weapons.push(weapon);
    })
    return weapons;
}

const runScript = async () => {
    const weapons = await axios.get(WEAPONS_URL).then((response) => {
        return getWeaponTypes(response.data);
    });

    //console.log(weapons)
    const weaponsStr = JSON.stringify(weapons);
    fs.writeFileSync('weaponTypes.json', weaponsStr);
};

runScript();
