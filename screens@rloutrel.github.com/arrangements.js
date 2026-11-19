// PURE module: zero GJS/GObject imports, unit-tested under plain Node.
// Named screen arrangements ("configurations") are stored as JSON in the
// saved-arrangements GSettings key; this module validates, saves, removes
// and serializes them. Never import gi:// or resource:/// here (see AGENTS.md).

function isPositiveInt(value) {
    return Number.isInteger(value) && value > 0;
}

function isValidSpec(spec) {
    return spec !== null && typeof spec === 'object' &&
        typeof spec.connector === 'string';
}

function isValidMode(mode) {
    return mode !== null && typeof mode === 'object' &&
        isPositiveInt(mode.width) && isPositiveInt(mode.height) &&
        typeof mode.rate === 'number' && mode.rate > 0;
}

function isValidScreen(screen) {
    if (screen === null || typeof screen !== 'object')
        return false;
    if (!Number.isInteger(screen.x) || !Number.isInteger(screen.y))
        return false;
    if (screen.width !== undefined && !isPositiveInt(screen.width))
        return false;
    if (screen.height !== undefined && !isPositiveInt(screen.height))
        return false;
    if (screen.scale !== undefined &&
        !(typeof screen.scale === 'number' && screen.scale > 0))
        return false;
    if (screen.connector !== undefined && typeof screen.connector !== 'string')
        return false;
    if (screen.spec !== undefined && !isValidSpec(screen.spec))
        return false;
    if (screen.mode !== undefined && !isValidMode(screen.mode))
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
        throw new Error(`Invalid screen geometry: ${JSON.stringify(screens)}`);
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
            if (s.spec !== undefined && s.spec !== null && typeof s.spec === 'object')
                screen.spec = {connector: String(s.spec.connector), vendor: String(s.spec.vendor ?? ''), product: String(s.spec.product ?? ''), serial: String(s.spec.serial ?? '')};
            if (s.mode !== undefined && s.mode !== null && typeof s.mode === 'object')
                screen.mode = {width: s.mode.width, height: s.mode.height, rate: s.mode.rate};
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

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function formatScale(scale) {
    return String(scale ?? 1);
}

function specXml(spec) {
    return `        <monitorspec>
          <connector>${escapeXml(spec.connector)}</connector>
          <vendor>${escapeXml(spec.vendor)}</vendor>
          <product>${escapeXml(spec.product)}</product>
          <serial>${escapeXml(spec.serial)}</serial>
        </monitorspec>`;
}

function modeXml(mode) {
    return `        <mode>
          <width>${mode.width}</width>
          <height>${mode.height}</height>
          <rate>${mode.rate.toFixed(3)}</rate>
        </mode>`;
}

function monitorXml(m) {
    return `      <monitor>
${specXml(m.spec)}
${modeXml(m.mode)}
      </monitor>`;
}

// Render an arrangement as a GDM-compatible monitors.xml (version 2).
// Screens without a full spec/mode (e.g. saved by an older version) are
// skipped; throws if nothing displayable remains.
export function toMonitorsXml(arrangement) {
    const screens = arrangement.screens.filter(s => s.spec && s.mode);
    if (screens.length === 0)
        throw new Error('arrangement has no screen with full spec/mode');
    const logicalMonitors = screens.map(s => `    <logicalmonitor>
      <x>${s.x}</x>
      <y>${s.y}</y>
      <scale>${formatScale(s.scale)}</scale>
      <primary>${s.isPrimary ? 'yes' : 'no'}</primary>
${monitorXml(s)}
    </logicalmonitor>`);
    return `<monitors version="2">
  <configuration>
${logicalMonitors.join('\n')}
  </configuration>
</monitors>
`;
}

// Render a mirror configuration for the login screen: a single logical
// monitor at (0,0) containing every given screen. `monitors` entries are
// {spec, mode} for all connected displays.
export function mirrorMonitorsXml(monitors) {
    const valid = monitors.filter(m => m.spec && m.mode);
    if (valid.length === 0)
        throw new Error('no connected screen with full spec/mode');
    return `<monitors version="2">
  <configuration>
    <logicalmonitor>
      <x>0</x>
      <y>0</y>
      <scale>1</scale>
      <primary>yes</primary>
${valid.map(monitorXml).join('\n')}
    </logicalmonitor>
  </configuration>
</monitors>
`;
}
