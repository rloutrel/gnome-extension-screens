// PURE module: zero GJS/GObject imports, unit-tested under plain Node.
// Domain logic for the Screens extension: turning raw monitor geometries
// into plain descriptors and formatting menu labels. Never import gi:// or
// resource:/// here (see AGENTS.md).

export function toScreenDescriptors(geometries, primaryIndex) {
    return geometries.map((geometry, index) => ({
        index,
        isPrimary: index === primaryIndex,
        x: geometry.x,
        y: geometry.y,
        width: geometry.width,
        height: geometry.height,
    }));
}

export function formatScreenLabel(screen, showResolution, translate) {
    let label = `${translate('Display')} ${screen.index + 1}`;
    if (screen.isPrimary)
        label += ` (${translate('primary')})`;
    if (showResolution)
        label += ` — ${screen.width}×${screen.height} @ ${screen.x},${screen.y}`;
    return label;
}
