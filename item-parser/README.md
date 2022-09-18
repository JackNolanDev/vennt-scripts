# Shape of `customUses.json`:

```json
{
    "Item name": {
        "roll": {
            "dice": "3d6 <-- dice roll (can include math)",
            "attr": "mp <-- character stat we should increase"
        },
        "heal": {
            "attr": {
                "hp": 1,
                "mp": 3,
            }
        },
        "adjust": {
            "time": "turn|encounter|rest|permanent",
            "attr": {
                "armor": 3,
                "burden": 1
            }
        },
        "check": {
            "bonus": "+3 <-- math equation",
            "attr": "dex <-- attribute we should use as base value"
        }
    }
}
```

- `roll` section generates a dice rolling mechanic on the website. The attr is the attribute which is increased by the use of this item.
- `heal` section allows the item to be consumed to increase any attributes in the object by the given amounts.
- `adjust` section allows the item to be consumed / used for a bonus for a specific amount of time. The values temporarily increased are specified in the `attr` field. If the value of a field is a string equation, e.g. `"str*2"` or `"(agi/2)+armor"` then it will be executed after basic adjustments. After the event specified by the `time` field, the item is removed / deactivated and all benefits are removed.
- `check` section allows the item to be used to improve a check by a given amount.
