// GJS-only module: talks to org.gnome.Mutter.DisplayConfig on the session
// bus to read the current display state and apply a saved arrangement.
// Arrangement data logic lives in arrangements.js (pure); this file only
// does D-Bus IO.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

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

// Current screens as plain descriptors, with the full monitor spec and
// current mode so a saved arrangement can be re-applied or written to
// GDM's monitors.xml later.
export async function collectCurrentScreens() {
    const {monitors, logicalMonitors} = await getCurrentState();
    return logicalMonitors.map(lm => {
        const specArr = lm[5][0];
        const monitor = monitors.find(m => m[0][0] === specArr[0]);
        const mode = monitor ? currentMode(monitor) : null;
        return {
            // Normalize: nested/devkit sessions can report odd values
            // (e.g. a 0 refresh rate on virtual modes).
            x: Math.round(lm[0]),
            y: Math.round(lm[1]),
            scale: lm[2] > 0 ? lm[2] : 1,
            isPrimary: lm[4] === true,
            spec: {
                connector: String(specArr[0]),
                vendor: String(specArr[1]),
                product: String(specArr[2]),
                serial: String(specArr[3]),
            },
            mode: mode
                ? {
                    width: Math.round(mode[1]),
                    height: Math.round(mode[2]),
                    rate: mode[3] > 0 ? mode[3] : 60,
                }
                : undefined,
        };
    });
}

function currentMode(monitor) {
    const modes = monitor[1];
    return modes.find(m => m[5]['is-current'] === true) ??
        modes.find(m => m[5]['is-preferred'] === true) ??
        modes[0];
}

// Apply a saved arrangement: method 1 = temporary (session only).
// Saved screens whose connector is not currently connected are skipped.
export async function applyArrangement(arrangement) {
    const {serial, monitors} = await getCurrentState();
    const entries = [];
    for (const screen of arrangement.screens) {
        const connector = screen.spec?.connector ?? screen.connector;
        const monitor = monitors.find(m => m[0][0] === connector);
        if (monitor)
            entries.push({screen, connector, modeId: currentMode(monitor)[0]});
    }
    if (entries.length === 0)
        throw new Error('none of the saved screens is currently connected');
    if (!entries.some(e => e.screen.isPrimary === true))
        entries[0] = {...entries[0], screen: {...entries[0].screen, isPrimary: true}};

    // GJS will not coerce nested JS arrays into D-Bus structs ("not a
    // subclass of GObject.Struct, it's a Array"), so build the structs
    // bottom-up as explicit GLib.Variant objects:
    // logical monitor = (i x, i y, d scale, u transform, b primary,
    //                     a(ssa{sv}) monitors)
    // monitor entry   = (s connector, s mode_id, a{sv} properties)
    const logicalVariants = entries.map(({screen, connector, modeId}) => {
        const monitorEntry = new GLib.Variant('(ssa{sv})',
            [connector, modeId, new GLib.Variant('a{sv}', {})]);
        return new GLib.Variant('(iiduba(ssa{sv}))',
            [screen.x, screen.y, screen.scale ?? 1.0, 0, screen.isPrimary === true,
                [monitorEntry]]);
    });
    const params = new GLib.Variant('(uua(iiduba(ssa{sv}))a{sv})',
        [serial, 1, logicalVariants, new GLib.Variant('a{sv}', {})]);
    await call('ApplyMonitorsConfig', params);
}

// GDM reads its display configuration from the gdm user's monitors.xml.
// The gdm home differs across distros (/var/lib/gdm3 on Debian/Ubuntu,
// /var/lib/gdm on Fedora/RHEL); pick the one that exists.
const LOGIN_SCREEN_MONITORS_XML = [
    '/var/lib/gdm3/.config/monitors.xml',
    '/var/lib/gdm/.config/monitors.xml',
];

export function loginScreenMonitorsXmlPath() {
    for (const path of LOGIN_SCREEN_MONITORS_XML) {
        const parent = Gio.File.new_for_path(path).get_parent();
        if (parent && parent.query_exists(null))
            return path;
    }
    return LOGIN_SCREEN_MONITORS_XML[0];
}

// Write the generated monitors.xml for the login screen. Root is required,
// so go through pkexec (polkit shows the admin password prompt); install -D
// creates the .config directory if needed.
export function writeLoginScreenMonitorsXml(xml) {
    return new Promise((resolve, reject) => {
        let proc;
        try {
            proc = Gio.Subprocess.new(
                ['pkexec', 'install', '-D', '/dev/stdin', loginScreenMonitorsXmlPath()],
                Gio.SubprocessFlags.STDIN_PIPE);
        } catch (error) {
            reject(error);
            return;
        }
        proc.communicate_utf8_async(xml, null, (p, res) => {
            try {
                p.communicate_utf8_finish(res);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}
