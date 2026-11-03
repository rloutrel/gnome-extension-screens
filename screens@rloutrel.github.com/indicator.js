// Panel indicator: menu construction, rendering and polling.
// Pure logic lives in pure modules (see AGENTS.md); this file only wires
// GJS widgets and keeps the enable()/disable() lifecycle clean.
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import {_debug} from './logger.js';
import {toScreenDescriptors, formatScreenLabel} from './screens.js';

export const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    constructor({extensionPath, openPreferences, settings}) {
        super(0.0, _('Screens'));
        this._extensionPath = extensionPath;
        this._openPreferences = openPreferences;
        this._settings = settings;
        this._pollTimeoutId = null;
        this._settingsChangedId = null;
    }

    setup() {
        this._addIcon();
        this._buildMenu();
        this._settingsChangedId = this._settings.connect('changed::show-resolution',
            () => this._buildMenu());
        this._startPolling();
    }

    _addIcon() {
        const icon = new St.Icon({
            icon_name: 'video-display-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(icon);
    }

    _collectScreens() {
        const display = global.display;
        const primaryIndex = display.get_primary_monitor();
        const geometries = [];
        for (let i = 0; i < display.get_n_monitors(); i++)
            geometries.push(display.get_monitor_geometry(i));
        return toScreenDescriptors(geometries, primaryIndex);
    }

    _buildMenu() {
        this.menu.removeAll();
        const showResolution = this._settings.get_boolean('show-resolution');
        for (const screen of this._collectScreens()) {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
                formatScreenLabel(screen, showResolution, _)));
        }
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction(_('Display Settings…'), () => {
            Gio.Subprocess.new(['gnome-control-center', 'display'],
                Gio.SubprocessFlags.NONE);
        });
        const prefsItem = this.menu.addAction(_('Preferences'),
            () => this._openPreferences());
        prefsItem.label.add_style_class_name('screens-menu-label');
    }

    _startPolling() {
        this._stopPolling();
        this._pollTimeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, 5, () => {
                this._buildMenu();
                return GLib.SOURCE_CONTINUE;
            });
    }

    _stopPolling() {
        if (this._pollTimeoutId) {
            GLib.source_remove(this._pollTimeoutId);
            this._pollTimeoutId = null;
        }
    }

    destroy() {
        _debug('indicator destroy()');
        this._stopPolling();
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        super.destroy();
    }
});
