// PURE module: zero GJS/GObject imports, unit-tested under plain Node.
// Named screen arrangements ("configurations") are stored as JSON in the
// saved-arrangements GSettings key; this module validates, saves, removes
// and serializes them. Never import gi:// or resource:/// here (see AGENTS.md).

function isValidScreen(screen) {
    if (screen === null || typeof screen !== 'object')
        return false;
    if (!Number.isInteger(screen.x) || !Number.isInteger(screen.y))
        return false;
    if (screen.width !== undefined &&
        !(Number.isInteger(screen.width) && screen.width > 0))
        return false;
    if (screen.height !== undefined &&
        !(Number.isInteger(screen.height) && screen.height > 0))
        return false;
    if (screen.scale !== undefined &&
        !(typeof screen.scale === 'number' && screen.scale > 0))
        return false;
    if (screen.connector !== undefined && typeof screen.connector !== 'string')
        return false;
    return true;
}

function isValidArrangement(arrangement) {
    return arrangement !== null && typeof arrangement === 'object' &&
        typeof arrangement.name === 'string' && arrangement.name.length > 0 &&
        Array.isArray(arrangement.screens) &&
        arrangement.screens.every(isValidScreen);
}

export function parseArrangements(json) {
    try {
        const data = JSON.parse(json);
        if (!Array.isArray(data))
            return [];
        return data.filter(isValidArrangement);
    } catch {
        return [];
    }
}

export function saveArrangement(list, name, screens) {
    const cleanName = name.trim();
    if (cleanName.length === 0)
        throw new Error('Arrangement name must not be empty');
    if (!screens.every(isValidScreen))
        throw new Error('Invalid screen geometry');
    const entry = {
        name: cleanName,
        screens: screens.map(s => {
            const screen = {x: s.x, y: s.y, isPrimary: Boolean(s.isPrimary)};
            if (typeof s.connector === 'string')
                screen.connector = s.connector;
            if (Number.isInteger(s.width))
                screen.width = s.width;
            if (Number.isInteger(s.height))
                screen.height = s.height;
            if (typeof s.scale === 'number' && s.scale > 0)
                screen.scale = s.scale;
            return screen;
        }),
    };
    return [...list.filter(a => a.name !== cleanName), entry];
}

export function removeArrangement(list, name) {
    return list.filter(a => a.name !== name);
}

export function serializeArrangements(list) {
    return JSON.stringify(list);
}
