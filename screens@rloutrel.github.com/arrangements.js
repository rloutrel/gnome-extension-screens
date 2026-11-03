// PURE module: zero GJS/GObject imports, unit-tested under plain Node.
// Named screen arrangements ("configurations") are stored as JSON in the
// saved-arrangements GSettings key; this module validates, saves, removes
// and serializes them. Never import gi:// or resource:/// here (see AGENTS.md).

function isValidScreen(screen) {
    return screen !== null && typeof screen === 'object' &&
        Number.isInteger(screen.x) && Number.isInteger(screen.y) &&
        Number.isInteger(screen.width) && screen.width > 0 &&
        Number.isInteger(screen.height) && screen.height > 0;
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
        screens: screens.map(s => ({
            x: s.x,
            y: s.y,
            width: s.width,
            height: s.height,
            isPrimary: Boolean(s.isPrimary),
        })),
    };
    return [...list.filter(a => a.name !== cleanName), entry];
}

export function removeArrangement(list, name) {
    return list.filter(a => a.name !== name);
}

export function serializeArrangements(list) {
    return JSON.stringify(list);
}
