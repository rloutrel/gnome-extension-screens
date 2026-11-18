// GJS-only module: talks to org.gnome.Mutter.DisplayConfig on the session
// bus to read the current display state and apply a saved arrangement.
// Arrangement data logic lives in arrangements.js (pure); this file only
// does D-Bus IO.
import Gio from 'gi://Gio';

const IFACE = 'org.gnome.Mutter.DisplayConfig';
const PATH = '/org/gnome/Mutter/DisplayConfig';

let _proxy = null;

function proxy() {
    if (!_proxy) {
        _proxy = new Gio.DBusProxy({
            gConnection: Gio.DBus.session,
            gName: IFACE,
            gObjectPath: PATH,
            gInterfaceName: IFACE,
        });
    }
    return _proxy;
}

function call(method, params) {
    return new Promise((resolve, reject) => {
        proxy().call(method, params, Gio.DBusCallFlags.NONE, -1, null,
            (p, res) => {
                try {
                    resolve(p.call_finish(res).deep_unpack());
                } catch (error) {
                    reject(error);
                }
            });
    });
}

export async function getCurrentState() {
    const [serial, monitors, logicalMonitors] = await call('GetCurrentState', null);
    return {serial, monitors, logicalMonitors};
}

// Current screens as plain descriptors, with the connector so a saved
// arrangement can be re-applied later: {connector, x, y, scale, isPrimary}.
export async function collectCurrentScreens() {
    const {logicalMonitors} = await getCurrentState();
    return logicalMonitors.map(lm => ({
        connector: lm[5][0][0],
        x: lm[0],
        y: lm[1],
        scale: lm[2],
        isPrimary: lm[4],
    }));
}

function currentModeId(monitor) {
    const modes = monitor[1];
    const current = modes.find(m => m[5]['is-current'] === true);
    const chosen = current ?? modes.find(m => m[5]['is-preferred'] === true) ?? modes[0];
    return chosen[0];
}

// Apply a saved arrangement: method 1 = temporary (session only).
// Saved screens whose connector is not currently connected are skipped.
export async function applyArrangement(arrangement) {
    const {serial, monitors} = await getCurrentState();
    const logicalMonitors = [];
    for (const screen of arrangement.screens) {
        const monitor = monitors.find(m => m[0][0] === screen.connector);
        if (!monitor)
            continue;
        logicalMonitors.push([
            screen.x,
            screen.y,
            screen.scale ?? 1.0,
            0, // transform: normal
            screen.isPrimary === true,
            [[screen.connector, currentModeId(monitor), {}]],
        ]);
    }
    if (logicalMonitors.length === 0)
        throw new Error('none of the saved screens is currently connected');
    if (!logicalMonitors.some(lm => lm[4]))
        logicalMonitors[0][4] = true; // mutter requires exactly one primary
    await call('ApplyMonitorsConfig', [serial, 1, logicalMonitors, {}]);
}
