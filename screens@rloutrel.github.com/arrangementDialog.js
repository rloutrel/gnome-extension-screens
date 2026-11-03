// Modal dialog asking for a name when saving the current arrangement.
// GJS-only module (Shell UI); all arrangement logic lives in arrangements.js.
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

export function openSaveArrangementDialog(onSave) {
    const dialog = new ModalDialog.ModalDialog({
        styleClass: 'screens-save-dialog',
    });

    const entry = new St.Entry({
        hint_text: _('Configuration name'),
        can_focus: true,
    });
    dialog.contentLayout.add_child(entry);

    const save = () => {
        const name = entry.get_text();
        dialog.close();
        onSave(name);
    };
    entry.clutter_text.connect('activate', save);

    dialog.addButton({
        label: _('Cancel'),
        action: () => dialog.close(),
        key: Clutter.KEY_Escape,
    });
    dialog.addButton({
        label: _('Save'),
        action: save,
        default: true,
    });
    dialog.setInitialKeyFocus(entry);
    dialog.open();
}
