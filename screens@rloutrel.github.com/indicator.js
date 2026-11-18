// Panel indicator: menu construction, rendering and polling.
// Pure logic lives in pure modules (see AGENTS.md); this file only wires
// GJS widgets and keeps the enable()/disable() lifecycle clean.
import St from 'gi://St';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import {_debug, notifyError} from './logger.js';
import {toScreenDescriptors, formatScreenLabel} from './screens.js';
import {parseArrangements, saveArrangement, removeArrangement, serializeArrangements, toMonitorsXml} from './arrangements.js';
import {collectCurrentScreens, applyArrangement, writeLoginScreenMonitorsXml} from './displayConfig.js';
import {openSaveArrangementDialog} from './arrangementDialog.js';

export const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    constructor({extensionPath, openPreferences, settings}) {
        super(0.0, _('Screens'));
        this._extensionPath = extensionPath;
        this._openPreferences = openPreferences;
        this._settings = settings;
        this._monitorsChangedId = null;
        this._settingsChangedId = null;
    }

    setup() {
        this._addIcon();
        this._buildMenu();
        this._settingsChangedId = this._settings.connect('changed',
            () => this._rebuildMenuIfClosed());
        const monitorManager = global.backend.get_monitor_manager();
        this._monitorsChangedId = monitorManager.connect('monitors-changed',
            () => this._rebuildMenuIfClosed());
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
        this._buildSavedArrangements();
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction(_('Save current arrangement…'), () => {
            openSaveArrangementDialog(name => this._saveCurrentArrangement(name));
        });
        this.menu.addAction(_('Display Settings…'), () => {
            Gio.Subprocess.new(['gnome-control-center', 'display'],
                Gio.SubprocessFlags.NONE);
        });
        const prefsItem = this.menu.addAction(_('Preferences'),
            () => this._openPreferences());
        prefsItem.label.add_style_class_name('screens-menu-label');
    }

    _savedArrangements() {
        if (!this._settings.settings_schema.has_key('saved-arrangements'))
            return [];
        return parseArrangements(this._settings.get_string('saved-arrangements'));
    }

    _buildSavedArrangements() {
        for (const arrangement of this._savedArrangements()) {
            const item = new PopupMenu.PopupSubMenuMenuItem(arrangement.name);
            item.menu.addAction(_('Set'), () => this._applyArrangement(arrangement));
            item.menu.addAction(_('Set for login screen'), () => this._setForLoginScreen(arrangement));
            item.menu.addAction(_('Delete'), () => {
                const next = removeArrangement(this._savedArrangements(), arrangement.name);
                this._settings.set_string('saved-arrangements', serializeArrangements(next));
            });
            this.menu.addMenuItem(item);
        }
    }

    async _saveCurrentArrangement(name) {
        try {
            const screens = await collectCurrentScreens();
            const next = saveArrangement(this._savedArrangements(), name, screens);
            this._settings.set_string('saved-arrangements', serializeArrangements(next));
        } catch (error) {
            notifyError(_('Could not save arrangement'), error.message);
        }
    }

    async _applyArrangement(arrangement) {
        try {
            await applyArrangement(arrangement);
            _debug(`applied arrangement '${arrangement.name}'`);
        } catch (error) {
            notifyError(_('Could not apply arrangement'), `${arrangement.name}: ${error.message}`);
        }
    }

    async _setForLoginScreen(arrangement) {
        try {
            const xml = toMonitorsXml(arrangement);
            await writeLoginScreenMonitorsXml(xml);
            _debug(`arrangement '${arrangement.name}' written to the login screen monitors.xml`);
        } catch (error) {
            notifyError(_('Could not set the login screen configuration'), `${arrangement.name}: ${error.message}`);
        }
    }

    // Rebuilding destroys all menu items, which folds back an open menu;
    // only rebuild while the menu is closed.
    _rebuildMenuIfClosed() {
        if (!this.menu.isOpen)
            this._buildMenu();
    }

    destroy() {
        _debug('indicator destroy()');
        if (this._monitorsChangedId) {
            global.backend.get_monitor_manager().disconnect(this._monitorsChangedId);
            this._monitorsChangedId = null;
        }
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        super.destroy();
    }
});
