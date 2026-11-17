"""IPRPS CD Burner: the GTK 3 window.

Copyright (C) 2026 Mythical Legends Publishing, LLC
License: GNU GPL v2 (see LICENSE)
"""

from __future__ import annotations

import hashlib
import os
import subprocess
import threading
import urllib.parse

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, Gio, GLib, GObject, Gtk, Pango  # noqa: E402

from . import __version__, backend as B  # noqa: E402

APP_ID = "space.infiniteplane.CDBurner"
CAMPAIGNS = os.path.join(os.path.expanduser("~"), "Campaigns")

CSS = b"""
.iprps-title { font-weight: bold; font-size: 115%; }
.iprps-hint { opacity: 0.75; }
.iprps-warning { color: #e5a50a; }
.iprps-error { color: #ed333b; }
.iprps-ok { color: #57e389; }
.iprps-page { padding: 12px; }
.iprps-log { font-family: monospace; font-size: 90%; }
"""


def _label(text, css=None, xalign=0.0, wrap=False):
    lab = Gtk.Label(label=text, xalign=xalign)
    if wrap:
        lab.set_line_wrap(True)
        lab.set_max_width_chars(70)
    if css:
        lab.get_style_context().add_class(css)
    return lab


def _button(label, icon=None, tooltip=None, suggested=False, destructive=False):
    b = Gtk.Button(label=label)
    if icon:
        b.set_image(Gtk.Image.new_from_icon_name(icon, Gtk.IconSize.BUTTON))
        b.set_always_show_image(True)
    if tooltip:
        b.set_tooltip_text(tooltip)
    if suggested:
        b.get_style_context().add_class("suggested-action")
    if destructive:
        b.get_style_context().add_class("destructive-action")
    return b


def _check(label, active=False, tooltip=None):
    c = Gtk.CheckButton(label=label)
    c.set_active(active)
    if tooltip:
        c.set_tooltip_text(tooltip)
    return c


def _uris_to_paths(data):
    paths = []
    for uri in data.get_uris() or []:
        if uri.startswith("file://"):
            paths.append(urllib.parse.unquote(urllib.parse.urlparse(uri).path))
    return paths


class BurnerWindow(Gtk.ApplicationWindow):
    def __init__(self, app):
        super().__init__(application=app, title="IPRPS CD Burner")
        self.set_default_size(900, 680)
        self.set_icon_name("iprps-cd-burner")
        self.runner = None
        self.disc = B.DiscInfo()
        self.audio_tracks: list[B.Track] = []

        header = Gtk.HeaderBar(show_close_button=True)
        header.set_title("IPRPS CD Burner")
        header.set_subtitle("Data discs, audio CDs and disc images")
        self.set_titlebar(header)
        about = Gtk.Button.new_from_icon_name("help-about-symbolic", Gtk.IconSize.BUTTON)
        about.set_tooltip_text("About IPRPS CD Burner")
        about.connect("clicked", self.on_about)
        header.pack_end(about)

        outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self.add(outer)

        self.tools_bar = Gtk.InfoBar(message_type=Gtk.MessageType.WARNING)
        self.tools_label = _label("", wrap=True)
        self.tools_bar.get_content_area().add(self.tools_label)
        self.tools_bar.set_no_show_all(True)
        outer.pack_start(self.tools_bar, False, False, 0)

        outer.pack_start(self._build_drive_bar(), False, False, 0)
        outer.pack_start(Gtk.Separator(), False, False, 0)

        self.stack = Gtk.Stack(transition_type=Gtk.StackTransitionType.CROSSFADE)
        switcher = Gtk.StackSwitcher(stack=self.stack, halign=Gtk.Align.CENTER)
        switcher.set_margin_top(8)
        outer.pack_start(switcher, False, False, 0)
        self.stack.add_titled(self._build_data_page(), "data", "Data Disc")
        self.stack.add_titled(self._build_audio_page(), "audio", "Audio CD")
        self.stack.add_titled(self._build_image_page(), "image", "Burn Image")
        self.stack.add_titled(self._build_copy_page(), "copy", "Copy Disc")
        self.stack.add_titled(self._build_erase_page(), "erase", "Erase")
        outer.pack_start(self.stack, True, True, 0)

        outer.pack_start(Gtk.Separator(), False, False, 0)
        outer.pack_start(self._build_status_area(), False, False, 0)

        self.show_all()
        self._check_tools()
        self.refresh_drives()

    # ------------------------------------------------------------------ drive bar
    def _build_drive_bar(self):
        box = Gtk.Box(spacing=8, margin=10)
        box.pack_start(_label("Drive:"), False, False, 0)
        self.drive_combo = Gtk.ComboBoxText()
        self.drive_combo.set_size_request(320, -1)
        self.drive_combo.connect("changed", lambda *_: self.refresh_disc())
        box.pack_start(self.drive_combo, False, False, 0)
        refresh = Gtk.Button.new_from_icon_name("view-refresh-symbolic", Gtk.IconSize.BUTTON)
        refresh.set_tooltip_text("Look for drives and read the disc again")
        refresh.connect("clicked", lambda *_: self.refresh_drives())
        box.pack_start(refresh, False, False, 0)
        self.eject_btn = Gtk.Button.new_from_icon_name("media-eject-symbolic", Gtk.IconSize.BUTTON)
        self.eject_btn.set_tooltip_text("Eject the disc")
        self.eject_btn.connect("clicked", self.on_eject)
        box.pack_start(self.eject_btn, False, False, 0)
        self.disc_label = _label("Looking for drives...", "iprps-hint")
        self.disc_label.set_ellipsize(Pango.EllipsizeMode.END)
        box.pack_start(self.disc_label, True, True, 6)
        return box

    def current_dev(self):
        return self.drive_combo.get_active_id()

    def refresh_drives(self):
        keep = self.current_dev()
        self.drive_combo.remove_all()
        drives = B.list_drives()
        for d in drives:
            self.drive_combo.append(d.dev, d.label)
        if drives:
            ids = [d.dev for d in drives]
            self.drive_combo.set_active_id(keep if keep in ids else ids[0])
            bad = [d for d in drives if not d.accessible]
            if bad:
                self._set_disc_text(B.permission_hint(bad[0].dev), "iprps-error")
        else:
            self.disc = B.DiscInfo()
            self._set_disc_text("No disc drive found. You can still save disc images.", "iprps-warning")
            self._update_capacity()
        self._update_buttons()

    def refresh_disc(self):
        dev = self.current_dev()
        if not dev or self.runner:
            return
        self._set_disc_text("Reading the disc...", "iprps-hint")

        def work():
            info = B.disc_info(dev)
            GLib.idle_add(self._disc_ready, dev, info)

        threading.Thread(target=work, daemon=True).start()

    def _disc_ready(self, dev, info):
        if dev != self.current_dev():
            return False
        self.disc = info
        css = "iprps-error" if info.error else ("iprps-ok" if info.present and info.appendable
                                                else "iprps-hint")
        self._set_disc_text(info.describe(), css)
        # When a writable disc is in the drive, plan for it automatically.
        if info.present and info.appendable and info.free_sectors:
            self.data_size_combo.set_active_id("drive")
            if info.is_cd and info.blank:
                self.audio_size_combo.set_active_id("drive")
        self._update_capacity()
        self._update_buttons()
        return False

    def _set_disc_text(self, text, css):
        ctx = self.disc_label.get_style_context()
        for c in ("iprps-hint", "iprps-ok", "iprps-error", "iprps-warning"):
            ctx.remove_class(c)
        ctx.add_class(css)
        self.disc_label.set_text(text)
        self.disc_label.set_tooltip_text(text)

    # ------------------------------------------------------------------ data page
    def _build_data_page(self):
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        page.get_style_context().add_class("iprps-page")

        top = Gtk.Box(spacing=8)
        top.pack_start(_label("Disc label:"), False, False, 0)
        self.volid_entry = Gtk.Entry(text="IPRPS_DISC", max_length=32)
        self.volid_entry.set_tooltip_text("The name computers show for the disc. "
                                          "Letters, numbers and _ only; other characters become _.")
        top.pack_start(self.volid_entry, False, False, 0)
        page.pack_start(top, False, False, 0)

        tools = Gtk.Box(spacing=6)
        add_files = _button("Add Files", "document-new-symbolic")
        add_files.connect("clicked", self.on_data_add, False)
        add_dir = _button("Add Folder", "folder-new-symbolic")
        add_dir.connect("clicked", self.on_data_add, True)
        add_camp = _button("Add Campaigns", "folder-symbolic",
                           "Add your whole Campaigns folder: maps, handouts, audio and notes")
        add_camp.connect("clicked", self.on_add_campaigns)
        rm = _button("Remove", "list-remove-symbolic")
        rm.connect("clicked", self.on_data_remove)
        clear = _button("Clear", "edit-clear-all-symbolic")
        clear.connect("clicked", lambda *_: (self.data_store.clear(), self._update_capacity()))
        for b in (add_files, add_dir, add_camp, rm, clear):
            tools.pack_start(b, False, False, 0)
        page.pack_start(tools, False, False, 0)

        # path, name, size text, size bytes, icon, location
        self.data_store = Gtk.ListStore(str, str, str, GObject.TYPE_INT64, str, str)
        view = Gtk.TreeView(model=self.data_store)
        view.get_selection().set_mode(Gtk.SelectionMode.MULTIPLE)
        self.data_view = view
        col = Gtk.TreeViewColumn("Name")
        icon = Gtk.CellRendererPixbuf()
        col.pack_start(icon, False)
        col.add_attribute(icon, "icon-name", 4)
        txt = Gtk.CellRendererText(ellipsize=Pango.EllipsizeMode.MIDDLE)
        col.pack_start(txt, True)
        col.add_attribute(txt, "text", 1)
        col.set_expand(True)
        view.append_column(col)
        view.append_column(Gtk.TreeViewColumn("Size", Gtk.CellRendererText(xalign=1.0), text=2))
        loc = Gtk.CellRendererText(ellipsize=Pango.EllipsizeMode.START)
        lc = Gtk.TreeViewColumn("From", loc, text=5)
        lc.set_expand(True)
        view.append_column(lc)
        view.drag_dest_set(Gtk.DestDefaults.ALL, [], Gdk.DragAction.COPY)
        view.drag_dest_add_uri_targets()
        view.connect("drag-data-received", lambda w, c, x, y, d, i, t: self.add_data_paths(_uris_to_paths(d)))
        page.pack_start(self._scrolled(view, "Drag files and folders here, or use Add Files."),
                        True, True, 0)

        cap = Gtk.Box(spacing=8)
        self.data_level = Gtk.LevelBar(min_value=0, max_value=1)
        self.data_level.add_offset_value("full", 1.0)
        cap.pack_start(self.data_level, True, True, 0)
        self.data_size_combo = Gtk.ComboBoxText()
        self.data_size_combo.append("drive", "Disc in drive")
        for name in B.CAPACITIES:
            self.data_size_combo.append(name, name)
        self.data_size_combo.set_active_id("CD 700 MB")
        self.data_size_combo.set_tooltip_text("Disc size to plan for")
        self.data_size_combo.connect("changed", lambda *_: self._update_capacity())
        cap.pack_start(self.data_size_combo, False, False, 0)
        page.pack_start(cap, False, False, 0)
        self.data_cap_label = _label("", "iprps-hint")
        page.pack_start(self.data_cap_label, False, False, 0)

        opts = Gtk.Box(spacing=16)
        self.data_verify = _check("Check the disc after burning", True,
                                  "Reads every file back and compares checksums")
        self.data_close = _check("Close the disc", False,
                                 "No more files can be added later. Some older players "
                                 "only read closed discs.")
        self.data_sim = _check("Simulate only", False,
                               "Go through the burn with the laser off to test the drive and disc. "
                               "Works with CD-R/RW and DVD-R/RW; not DVD+R or Blu-ray.")
        for c in (self.data_verify, self.data_close, self.data_sim):
            opts.pack_start(c, False, False, 0)
        page.pack_start(opts, False, False, 0)

        actions = Gtk.Box(spacing=8, halign=Gtk.Align.END)
        self.data_iso_btn = _button("Save as Image...", "document-save-as-symbolic",
                                    "Make an ISO disc image file instead of burning")
        self.data_iso_btn.connect("clicked", self.on_data_image)
        self.data_burn_btn = _button("Burn", "media-optical-burn-symbolic", suggested=True)
        self.data_burn_btn.connect("clicked", self.on_data_burn)
        actions.pack_start(self.data_iso_btn, False, False, 0)
        actions.pack_start(self.data_burn_btn, False, False, 0)
        page.pack_start(actions, False, False, 0)
        return page

    def _scrolled(self, view, placeholder):
        overlay = Gtk.Overlay()
        sw = Gtk.ScrolledWindow(hexpand=True, vexpand=True)
        sw.set_shadow_type(Gtk.ShadowType.IN)
        sw.add(view)
        overlay.add(sw)
        hint = _label(placeholder, "iprps-hint", xalign=0.5)
        hint.set_halign(Gtk.Align.CENTER)
        hint.set_valign(Gtk.Align.CENTER)
        hint.set_no_show_all(True)
        overlay.add_overlay(hint)
        overlay.set_overlay_pass_through(hint, True)
        model = view.get_model()

        def sync(*_):
            hint.set_visible(len(model) == 0)

        model.connect("row-inserted", sync)
        model.connect("row-deleted", sync)
        GLib.idle_add(sync)
        return overlay

    def add_data_paths(self, paths):
        have = {row[0] for row in self.data_store}
        for p in paths:
            p = os.path.abspath(p)
            if p in have or not os.path.exists(p):
                continue
            size = B.path_size(p)
            icon = "folder" if os.path.isdir(p) else "text-x-generic"
            self.data_store.append([p, os.path.basename(p) or p, B.human_size(size), size,
                                    icon, os.path.dirname(p)])
            have.add(p)
        self._update_capacity()

    def on_data_add(self, _btn, folders):
        action = Gtk.FileChooserAction.SELECT_FOLDER if folders else Gtk.FileChooserAction.OPEN
        dlg = Gtk.FileChooserNative.new("Add folders" if folders else "Add files", self, action,
                                        "_Add", "_Cancel")
        dlg.set_select_multiple(True)
        if dlg.run() == Gtk.ResponseType.ACCEPT:
            self.add_data_paths(dlg.get_filenames())
        dlg.destroy()

    def on_add_campaigns(self, _btn):
        if os.path.isdir(CAMPAIGNS):
            self.add_data_paths([CAMPAIGNS])
            if self.volid_entry.get_text() in ("", "IPRPS_DISC"):
                self.volid_entry.set_text("IPRPS_CAMPAIGNS")
        else:
            self.message(Gtk.MessageType.INFO, "No Campaigns folder",
                         f"There's no Campaigns folder at {CAMPAIGNS}.")

    def on_data_remove(self, _btn):
        model, paths = self.data_view.get_selection().get_selected_rows()
        for p in reversed(paths):
            model.remove(model.get_iter(p))
        self._update_capacity()

    def data_paths(self):
        return [row[0] for row in self.data_store]

    # ------------------------------------------------------------------ audio page
    def _build_audio_page(self):
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        page.get_style_context().add_class("iprps-page")

        meta = Gtk.Grid(column_spacing=8, row_spacing=6)
        meta.attach(_label("Album title:"), 0, 0, 1, 1)
        self.album_entry = Gtk.Entry(text="", hexpand=True, placeholder_text="Session soundtrack")
        meta.attach(self.album_entry, 1, 0, 1, 1)
        meta.attach(_label("Artist:"), 2, 0, 1, 1)
        self.artist_entry = Gtk.Entry(text="", hexpand=True, placeholder_text="Various")
        meta.attach(self.artist_entry, 3, 0, 1, 1)
        page.pack_start(meta, False, False, 0)

        tools = Gtk.Box(spacing=6)
        add = _button("Add Songs", "list-add-symbolic")
        add.connect("clicked", self.on_audio_add)
        camp = _button("Add Campaign Audio", "folder-music-symbolic",
                       "Add every song in Campaigns/Audio")
        camp.connect("clicked", self.on_audio_campaigns)
        up = _button("", "go-up-symbolic", "Move up")
        up.connect("clicked", self.on_audio_move, -1)
        down = _button("", "go-down-symbolic", "Move down")
        down.connect("clicked", self.on_audio_move, 1)
        rm = _button("Remove", "list-remove-symbolic")
        rm.connect("clicked", self.on_audio_remove)
        clear = _button("Clear", "edit-clear-all-symbolic")
        clear.connect("clicked", lambda *_: (self.audio_tracks.clear(), self._audio_sync()))
        for b in (add, camp, up, down, rm, clear):
            tools.pack_start(b, False, False, 0)
        page.pack_start(tools, False, False, 0)

        # number, title, artist, length
        self.audio_store = Gtk.ListStore(int, str, str, str)
        view = Gtk.TreeView(model=self.audio_store, reorderable=False)
        self.audio_view = view
        view.append_column(Gtk.TreeViewColumn("#", Gtk.CellRendererText(xalign=1.0), text=0))
        title_r = Gtk.CellRendererText(editable=True, ellipsize=Pango.EllipsizeMode.END)
        title_r.connect("edited", self.on_track_edited, "title")
        tc = Gtk.TreeViewColumn("Title (click to edit)", title_r, text=1)
        tc.set_expand(True)
        view.append_column(tc)
        artist_r = Gtk.CellRendererText(editable=True, ellipsize=Pango.EllipsizeMode.END)
        artist_r.connect("edited", self.on_track_edited, "artist")
        ac = Gtk.TreeViewColumn("Artist", artist_r, text=2)
        ac.set_expand(True)
        view.append_column(ac)
        view.append_column(Gtk.TreeViewColumn("Length", Gtk.CellRendererText(xalign=1.0), text=3))
        view.drag_dest_set(Gtk.DestDefaults.ALL, [], Gdk.DragAction.COPY)
        view.drag_dest_add_uri_targets()
        view.connect("drag-data-received",
                     lambda w, c, x, y, d, i, t: self.add_audio_paths(_uris_to_paths(d)))
        page.pack_start(self._scrolled(view, "Drag MP3, FLAC, OGG, M4A or WAV files here."),
                        True, True, 0)

        cap = Gtk.Box(spacing=8)
        self.audio_level = Gtk.LevelBar(min_value=0, max_value=1)
        cap.pack_start(self.audio_level, True, True, 0)
        self.audio_size_combo = Gtk.ComboBoxText()
        self.audio_size_combo.append("drive", "Disc in drive")
        for name in B.AUDIO_CAPACITIES_MIN:
            self.audio_size_combo.append(name, name)
        self.audio_size_combo.set_active_id("80 minutes")
        self.audio_size_combo.connect("changed", lambda *_: self._update_capacity())
        cap.pack_start(self.audio_size_combo, False, False, 0)
        page.pack_start(cap, False, False, 0)
        self.audio_cap_label = _label("", "iprps-hint")
        page.pack_start(self.audio_cap_label, False, False, 0)

        opts = Gtk.Box(spacing=16)
        self.audio_gaps = _check("2-second gaps between songs", True,
                                 "Turn off for live albums and DJ mixes that flow together")
        self.audio_gaps.connect("toggled", lambda *_: self._update_capacity())
        self.audio_norm = _check("Even out volume", False,
                                 "Makes quiet and loud songs play at a similar volume")
        self.audio_text = _check("Add CD-TEXT", True,
                                 "Stores album and song names on the disc for players that show them")
        self.audio_sim = _check("Simulate only", False, "Test the burn with the laser off")
        for c in (self.audio_gaps, self.audio_norm, self.audio_text, self.audio_sim):
            opts.pack_start(c, False, False, 0)
        page.pack_start(opts, False, False, 0)

        actions = Gtk.Box(spacing=8, halign=Gtk.Align.END)
        self.audio_burn_btn = _button("Burn Audio CD", "media-optical-burn-symbolic", suggested=True)
        self.audio_burn_btn.connect("clicked", self.on_audio_burn)
        actions.pack_start(self.audio_burn_btn, False, False, 0)
        page.pack_start(actions, False, False, 0)
        return page

    def add_audio_paths(self, paths):
        files = []
        for p in paths:
            if os.path.isdir(p):
                for root, _dirs, names in os.walk(p):
                    files += [os.path.join(root, n) for n in sorted(names)]
            else:
                files.append(p)
        files = [f for f in files if f.lower().endswith(B.AUDIO_EXTENSIONS)]
        if not files:
            return
        self.status_label.set_text(f"Reading {len(files)} song(s)...")

        def work():
            tracks = [B.probe_track(f) for f in files]
            GLib.idle_add(self._audio_added, tracks)

        threading.Thread(target=work, daemon=True).start()

    def _audio_added(self, tracks):
        self.audio_tracks += tracks
        self.status_label.set_text("Ready.")
        self._audio_sync()
        return False

    def _audio_sync(self, select=None):
        self.audio_store.clear()
        for i, t in enumerate(self.audio_tracks, 1):
            self.audio_store.append([i, t.title, t.artist, B.format_duration(t.seconds)])
        if select is not None:
            self.audio_view.get_selection().select_path(Gtk.TreePath(select))
        self._update_capacity()
        self._update_buttons()

    def on_audio_add(self, _btn):
        dlg = Gtk.FileChooserNative.new("Add songs", self, Gtk.FileChooserAction.OPEN,
                                        "_Add", "_Cancel")
        dlg.set_select_multiple(True)
        flt = Gtk.FileFilter()
        flt.set_name("Music files")
        for ext in B.AUDIO_EXTENSIONS:
            flt.add_pattern("*" + ext)
            flt.add_pattern("*" + ext.upper())
        dlg.add_filter(flt)
        if dlg.run() == Gtk.ResponseType.ACCEPT:
            self.add_audio_paths(dlg.get_filenames())
        dlg.destroy()

    def on_audio_campaigns(self, _btn):
        folder = os.path.join(CAMPAIGNS, "Audio")
        if os.path.isdir(folder):
            self.add_audio_paths([folder])
        else:
            self.message(Gtk.MessageType.INFO, "No campaign audio",
                         f"There's no folder at {folder}.")

    def _selected_track(self):
        model, it = self.audio_view.get_selection().get_selected()
        return model.get_path(it).get_indices()[0] if it else None

    def on_audio_move(self, _btn, step):
        i = self._selected_track()
        if i is None:
            return
        j = i + step
        if 0 <= j < len(self.audio_tracks):
            t = self.audio_tracks
            t[i], t[j] = t[j], t[i]
            self._audio_sync(select=j)

    def on_audio_remove(self, _btn):
        i = self._selected_track()
        if i is not None:
            del self.audio_tracks[i]
            self._audio_sync(select=min(i, len(self.audio_tracks) - 1) if self.audio_tracks else None)

    def on_track_edited(self, _r, path, text, field):
        i = int(path)
        setattr(self.audio_tracks[i], field, text.strip())
        self.audio_store[i][1 if field == "title" else 2] = text.strip()

    # ------------------------------------------------------------------ image page
    def _build_image_page(self):
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        page.get_style_context().add_class("iprps-page")
        page.pack_start(_label("Burn a disc image", "iprps-title"), False, False, 0)
        page.pack_start(_label("Writes an ISO image to a disc exactly as it is, for example an "
                               "IPRPS OS installer or a campaign archive made with Save as Image.",
                               "iprps-hint", wrap=True), False, False, 0)
        row = Gtk.Box(spacing=8)
        row.pack_start(_label("Image file:"), False, False, 0)
        self.image_chooser = Gtk.FileChooserButton(title="Choose a disc image",
                                                   action=Gtk.FileChooserAction.OPEN)
        flt = Gtk.FileFilter()
        flt.set_name("Disc images (*.iso, *.img)")
        for pat in ("*.iso", "*.ISO", "*.img", "*.IMG"):
            flt.add_pattern(pat)
        self.image_chooser.add_filter(flt)
        self.image_chooser.connect("file-set", self.on_image_chosen)
        row.pack_start(self.image_chooser, True, True, 0)
        page.pack_start(row, False, False, 0)
        self.image_info = _label("", "iprps-hint", wrap=True)
        self.image_info.set_selectable(True)
        page.pack_start(self.image_info, False, False, 0)
        self.image_sum_btn = _button("Show SHA-256 Checksum", "dialog-password-symbolic",
                                     "Compare this with the checksum the download page lists")
        self.image_sum_btn.set_halign(Gtk.Align.START)
        self.image_sum_btn.connect("clicked", self.on_image_checksum)
        page.pack_start(self.image_sum_btn, False, False, 0)
        self.image_sim = _check("Simulate only", False, "Test the burn with the laser off")
        page.pack_start(self.image_sim, False, False, 0)
        page.pack_start(Gtk.Box(), True, True, 0)
        actions = Gtk.Box(spacing=8, halign=Gtk.Align.END)
        self.image_burn_btn = _button("Burn Image", "media-optical-burn-symbolic", suggested=True)
        self.image_burn_btn.connect("clicked", self.on_image_burn)
        actions.pack_start(self.image_burn_btn, False, False, 0)
        page.pack_start(actions, False, False, 0)
        return page

    def image_path(self):
        return self.image_chooser.get_filename()

    def on_image_chosen(self, *_):
        p = self.image_path()
        if p:
            self.image_info.set_text(f"{os.path.basename(p)}: {B.human_size(os.path.getsize(p))}")
        self._update_buttons()

    def on_image_checksum(self, _btn):
        p = self.image_path()
        if not p:
            return
        self.image_info.set_text("Working out the checksum...")
        self.image_sum_btn.set_sensitive(False)

        def work():
            h = hashlib.sha256()
            with open(p, "rb") as f:
                for chunk in iter(lambda: f.read(4 * 1024 * 1024), b""):
                    h.update(chunk)
            GLib.idle_add(done, h.hexdigest())

        def done(digest):
            self.image_info.set_text(f"{os.path.basename(p)}: {B.human_size(os.path.getsize(p))}\n"
                                     f"SHA-256: {digest}")
            self.image_sum_btn.set_sensitive(True)
            return False

        threading.Thread(target=work, daemon=True).start()

    # ------------------------------------------------------------------ copy page
    def _build_copy_page(self):
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        page.get_style_context().add_class("iprps-page")
        page.pack_start(_label("Copy a disc to an image", "iprps-title"), False, False, 0)
        page.pack_start(_label(
            "Saves the data disc in the drive as an ISO image file. Burn that image onto a blank "
            "disc from Burn Image to make a copy. Audio CDs can't be copied this way; rip them "
            "with a music app instead.", "iprps-hint", wrap=True), False, False, 0)
        page.pack_start(Gtk.Box(), True, True, 0)
        actions = Gtk.Box(spacing=8, halign=Gtk.Align.END)
        self.copy_btn = _button("Save Disc as Image...", "document-save-as-symbolic", suggested=True)
        self.copy_btn.connect("clicked", self.on_copy)
        actions.pack_start(self.copy_btn, False, False, 0)
        page.pack_start(actions, False, False, 0)
        return page

    # ------------------------------------------------------------------ erase page
    def _build_erase_page(self):
        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        page.get_style_context().add_class("iprps-page")
        page.pack_start(_label("Erase a rewritable disc", "iprps-title"), False, False, 0)
        page.pack_start(_label("Works with CD-RW, DVD-RW, DVD+RW and BD-RE discs. Everything on "
                               "the disc is lost.", "iprps-hint", wrap=True), False, False, 0)
        self.erase_quick = Gtk.RadioButton.new_with_label(None, "Quick erase (a minute or two)")
        self.erase_full = Gtk.RadioButton.new_with_label_from_widget(
            self.erase_quick, "Full erase (slow; use it if a disc gives errors)")
        page.pack_start(self.erase_quick, False, False, 0)
        page.pack_start(self.erase_full, False, False, 0)
        page.pack_start(Gtk.Box(), True, True, 0)
        actions = Gtk.Box(spacing=8, halign=Gtk.Align.END)
        self.erase_btn = _button("Erase Disc", "edit-delete-symbolic", destructive=True)
        self.erase_btn.connect("clicked", self.on_erase)
        actions.pack_start(self.erase_btn, False, False, 0)
        page.pack_start(actions, False, False, 0)
        return page

    # ------------------------------------------------------------------ status area
    def _build_status_area(self):
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin=10)
        opts = Gtk.Box(spacing=16)
        opts.pack_start(_label("Speed:"), False, False, 0)
        self.speed_combo = Gtk.ComboBoxText()
        self.speed_combo.append("fast", "Fastest")
        self.speed_combo.append("slow", "Slowest (most reliable)")
        self.speed_combo.set_active_id("fast")
        self.speed_combo.set_tooltip_text("Slow burns play better in old CD players and car stereos")
        opts.pack_start(self.speed_combo, False, False, 0)
        self.eject_check = _check("Eject when done", True)
        opts.pack_start(self.eject_check, False, False, 0)
        box.pack_start(opts, False, False, 0)

        row = Gtk.Box(spacing=8)
        self.progress = Gtk.ProgressBar(show_text=True, hexpand=True)
        self.progress.set_text("")
        row.pack_start(self.progress, True, True, 0)
        self.cancel_btn = _button("Cancel", "process-stop-symbolic")
        self.cancel_btn.set_sensitive(False)
        self.cancel_btn.connect("clicked", self.on_cancel)
        row.pack_start(self.cancel_btn, False, False, 0)
        box.pack_start(row, False, False, 0)
        self.status_label = _label("Ready.")
        self.status_label.set_ellipsize(Pango.EllipsizeMode.END)
        box.pack_start(self.status_label, False, False, 0)

        exp = Gtk.Expander(label="Details")
        self.log_view = Gtk.TextView(editable=False, cursor_visible=False,
                                     wrap_mode=Gtk.WrapMode.WORD_CHAR)
        self.log_view.get_style_context().add_class("iprps-log")
        sw = Gtk.ScrolledWindow()
        sw.set_size_request(-1, 140)
        sw.set_shadow_type(Gtk.ShadowType.IN)
        sw.add(self.log_view)
        exp.add(sw)
        box.pack_start(exp, False, False, 0)
        return box

    # ------------------------------------------------------------------ state
    def _check_tools(self):
        missing = B.missing_tools()
        if missing:
            lines = ["Some burning tools aren't installed, so parts of the app are switched off:"]
            lines += [f"• {t}: {why}" for t, why in missing.items()]
            lines.append("Install them with IPRPS Updates, or build them from BLFS.")
            self.tools_label.set_text("\n".join(lines))
            self.tools_bar.show()
            self.tools_label.show()

    def _capacity_bytes(self):
        sel = self.data_size_combo.get_active_id()
        if sel == "drive":
            return self.disc.free_bytes if self.disc.present else 0
        return B.CAPACITIES.get(sel, B.CAPACITIES["CD 700 MB"])

    def _audio_capacity_seconds(self):
        sel = self.audio_size_combo.get_active_id()
        if sel == "drive":
            return self.disc.audio_free_seconds if self.disc.present and self.disc.blank else 0
        return B.AUDIO_CAPACITIES_MIN.get(sel, 80) * 60

    def _update_capacity(self):
        used = B.estimate_image_size(self.data_paths()) if len(self.data_store) else 0
        cap = self._capacity_bytes()
        frac = used / cap if cap else 0
        self.data_level.set_value(min(frac, 1.0))
        if not cap:
            self.data_cap_label.set_text(f"{B.human_size(used)} selected. Put a blank disc in the drive "
                                         "or choose a disc size.")
        elif used > cap:
            self.data_cap_label.set_text(f"{B.human_size(used)} of {B.human_size(cap)}: "
                                         f"{B.human_size(used - cap)} too much for this disc.")
        else:
            self.data_cap_label.set_text(f"{B.human_size(used)} of {B.human_size(cap)} "
                                         f"({B.human_size(cap - used)} left)")

        gap = 2 if self.audio_gaps.get_active() else 0
        secs = B.audio_total_seconds(self.audio_tracks, gap)
        acap = self._audio_capacity_seconds()
        self.audio_level.set_value(min(secs / acap, 1.0) if acap else 0)
        n = len(self.audio_tracks)
        if not acap:
            self.audio_cap_label.set_text(f"{n} songs, {B.format_duration(secs)}. Put a blank CD in the drive.")
        elif secs > acap:
            self.audio_cap_label.set_text(f"{n} songs, {B.format_duration(secs)} of "
                                          f"{B.format_duration(acap)}: {B.format_duration(secs - acap)} too long.")
        else:
            self.audio_cap_label.set_text(f"{n} songs, {B.format_duration(secs)} of "
                                          f"{B.format_duration(acap)} ({B.format_duration(acap - secs)} left)")
        self._update_buttons()

    def _update_buttons(self):
        busy = self.runner is not None
        dev = self.current_dev()
        has_x = bool(B.find_tool("xorriso"))
        has_c = bool(B.find_tool("cdrskin"))
        data_ok = len(self.data_store) > 0
        cap = self._capacity_bytes()
        fits = not cap or B.estimate_image_size(self.data_paths()) <= cap if data_ok else False
        self.data_burn_btn.set_sensitive(not busy and has_x and bool(dev) and data_ok and fits)
        self.data_iso_btn.set_sensitive(not busy and has_x and data_ok)
        acap = self._audio_capacity_seconds()
        secs = B.audio_total_seconds(self.audio_tracks, 2 if self.audio_gaps.get_active() else 0)
        self.audio_burn_btn.set_sensitive(not busy and has_c and bool(dev) and bool(self.audio_tracks)
                                          and (not acap or secs <= acap) and len(self.audio_tracks) <= 99)
        self.image_burn_btn.set_sensitive(not busy and has_x and bool(dev) and bool(self.image_path()))
        self.copy_btn.set_sensitive(not busy and bool(dev))
        self.erase_btn.set_sensitive(not busy and has_x and bool(dev))
        self.eject_btn.set_sensitive(not busy and bool(dev))
        self.drive_combo.set_sensitive(not busy)
        self.cancel_btn.set_sensitive(busy)

    # ------------------------------------------------------------------ dialogs
    def message(self, kind, title, text):
        d = Gtk.MessageDialog(transient_for=self, modal=True, message_type=kind,
                              buttons=Gtk.ButtonsType.OK, text=title)
        d.format_secondary_text(text)
        d.run()
        d.destroy()

    def confirm(self, title, text, ok_label, destructive=False):
        d = Gtk.MessageDialog(transient_for=self, modal=True, message_type=Gtk.MessageType.QUESTION,
                              buttons=Gtk.ButtonsType.NONE, text=title)
        d.format_secondary_text(text)
        d.add_button("_Cancel", Gtk.ResponseType.CANCEL)
        ok = d.add_button(ok_label, Gtk.ResponseType.OK)
        ok.get_style_context().add_class("destructive-action" if destructive else "suggested-action")
        d.set_default_response(Gtk.ResponseType.CANCEL if destructive else Gtk.ResponseType.OK)
        r = d.run()
        d.destroy()
        return r == Gtk.ResponseType.OK

    def save_dialog(self, title, name):
        dlg = Gtk.FileChooserNative.new(title, self, Gtk.FileChooserAction.SAVE, "_Save", "_Cancel")
        dlg.set_do_overwrite_confirmation(True)
        dlg.set_current_folder(os.path.expanduser("~"))
        dlg.set_current_name(name)
        path = dlg.get_filename() if dlg.run() == Gtk.ResponseType.ACCEPT else None
        dlg.destroy()
        if path and not path.lower().endswith((".iso", ".img")):
            path += ".iso"
        return path

    def _disc_warning(self):
        """Ask before writing to a disc that isn't blank. False means stop."""
        d = self.disc
        if not d.present:
            self.message(Gtk.MessageType.WARNING, "No disc", "Put a blank or rewritable disc in the drive, "
                         "wait for the light to stop blinking, then try again.")
            self.refresh_disc()
            return False
        return True

    # ------------------------------------------------------------------ actions
    def fastest(self):
        return self.speed_combo.get_active_id() == "fast"

    def on_data_burn(self, _btn):
        if not self._disc_warning():
            return
        d = self.disc
        if d.present and not d.blank and not d.appendable:
            if d.rewritable:
                self.message(Gtk.MessageType.WARNING, "This disc is full or closed",
                             "Erase it first (Erase tab), or use a blank disc.")
            else:
                self.message(Gtk.MessageType.WARNING, "This disc is full or closed",
                             "Use a blank disc.")
            return
        if d.present and not d.blank and not self.confirm(
                "Add files to this disc?",
                "This disc already has files. The new files are added beside them, and "
                "what's already on the disc stays.", "_Add Files"):
            return
        vol = self.volid_entry.get_text()
        self.start_job("Burning data disc", B.job_burn_data, self.current_dev(), self.data_paths(),
                       vol, simulate=self.data_sim.get_active(), close=self.data_close.get_active(),
                       fastest=self.fastest(), verify=self.data_verify.get_active(),
                       eject=self.eject_check.get_active())

    def on_data_image(self, _btn):
        vol = B.clean_volume_id(self.volid_entry.get_text())
        path = self.save_dialog("Save disc image", vol.lower() + ".iso")
        if path:
            self.start_job("Making disc image", B.job_make_image, path, self.data_paths(), vol)

    def on_audio_burn(self, _btn):
        if not self._disc_warning():
            return
        d = self.disc
        if d.present and not d.is_cd:
            self.message(Gtk.MessageType.WARNING, "Audio CDs need a CD",
                         f"The disc in the drive is a {d.media}. Use a blank CD-R (best for "
                         "car stereos and older players) or CD-RW.")
            return
        if d.present and not d.blank:
            if d.rewritable:
                if not self.confirm("Erase this CD-RW?", "It already has something on it. Burning an "
                                    "audio CD erases it first.", "_Erase and Burn", destructive=True):
                    return
            else:
                self.message(Gtk.MessageType.WARNING, "Use a blank CD",
                             "Audio CDs need a blank disc; this CD-R has already been written.")
                return
        self.start_job("Burning audio CD", B.job_burn_audio, self.current_dev(),
                       list(self.audio_tracks), simulate=self.audio_sim.get_active(),
                       fastest=self.fastest(), normalize=self.audio_norm.get_active(),
                       eject=self.eject_check.get_active(),
                       gap_seconds=2 if self.audio_gaps.get_active() else 0,
                       cdtext=self.audio_text.get_active(),
                       album=self.album_entry.get_text() or "Session soundtrack",
                       artist=self.artist_entry.get_text() or "Various")

    def on_image_burn(self, _btn):
        if not self._disc_warning():
            return
        img = self.image_path()
        d = self.disc
        size = os.path.getsize(img)
        if d.present and d.blank and d.free_bytes and size > d.free_bytes:
            self.message(Gtk.MessageType.WARNING, "The image is too big for this disc",
                         f"The image is {B.human_size(size)}; the disc holds {B.human_size(d.free_bytes)}.")
            return
        if d.present and not d.blank:
            if not d.rewritable:
                self.message(Gtk.MessageType.WARNING, "Use a blank disc",
                             "Images are written to blank discs; this one has already been written.")
                return
            if not self.confirm("Replace what's on this disc?", "Everything on the disc will be "
                                "erased and replaced by the image.", "_Erase and Burn", destructive=True):
                return
        self.start_job("Burning image", B.job_burn_image, self.current_dev(), img,
                       simulate=self.image_sim.get_active(), fastest=self.fastest(),
                       eject=self.eject_check.get_active())

    def on_copy(self, _btn):
        label = (self.disc.volume_id or "disc").lower()
        path = self.save_dialog("Save disc as image", label + ".iso")
        if path:
            self.start_job("Copying disc", B.job_copy_to_image, self.current_dev(), path)

    def on_erase(self, _btn):
        d = self.disc
        if d.present and not d.rewritable:
            self.message(Gtk.MessageType.WARNING, "This disc can't be erased",
                         f"A {d.media} can only be written once. Use a CD-RW, DVD-RW, DVD+RW or BD-RE.")
            return
        if not self.confirm("Erase this disc?", "Everything on the disc will be lost. This can't be undone.",
                            "_Erase", destructive=True):
            return
        self.start_job("Erasing disc", B.job_erase, self.current_dev(), self.erase_full.get_active(),
                       self.eject_check.get_active())

    def on_eject(self, _btn):
        dev = self.current_dev()
        if not dev or not B.find_tool("xorriso"):
            return
        def work():
            subprocess.run(B.eject_command(dev), capture_output=True)
            GLib.idle_add(self.refresh_disc)

        threading.Thread(target=work, daemon=True).start()
        self._set_disc_text("Ejecting...", "iprps-hint")

    def on_cancel(self, _btn):
        if self.runner and self.confirm(
                "Stop now?", "If burning has already started, the disc will probably be unusable "
                "(a rewritable disc can be erased and used again).", "_Stop", destructive=True):
            self.runner.cancel()
            self.status_label.set_text("Stopping...")

    # ------------------------------------------------------------------ job plumbing
    def log(self, text):
        buf = self.log_view.get_buffer()
        buf.insert(buf.get_end_iter(), text + "\n")
        buf.place_cursor(buf.get_end_iter())
        self.log_view.scroll_mark_onscreen(buf.get_insert())
        return False

    def set_progress(self, frac):
        if frac is None:
            self.progress.pulse()
        else:
            self.progress.set_fraction(max(0.0, min(1.0, frac)))
            self.progress.set_text(f"{frac * 100:.0f}%")
        return False

    def start_job(self, title, fn, *args, **kwargs):
        self.runner = B.JobRunner(lambda t: GLib.idle_add(self.log, t),
                                  lambda f: GLib.idle_add(self.set_progress, f))
        runner = self.runner
        self.progress.set_fraction(0)
        self.progress.set_text("0%")
        self.status_label.set_text(title + "...")
        self.log(f"--- {title} ---")
        self._update_buttons()
        app = self.get_application()
        cookie = app.inhibit(self, Gtk.ApplicationInhibitFlags.SUSPEND | Gtk.ApplicationInhibitFlags.LOGOUT,
                             "Writing a disc") if app else 0

        def work():
            try:
                result, ok = fn(runner, *args, **kwargs), True
            except B.Cancelled:
                result, ok = "Stopped.", None
            except B.JobError as e:
                result, ok = str(e), False
            except Exception as e:  # keep the window usable whatever happens
                result, ok = f"Something went wrong: {e}", False
            GLib.idle_add(self._job_done, title, result, ok, cookie)

        threading.Thread(target=work, daemon=True).start()

    def _job_done(self, title, result, ok, cookie):
        app = self.get_application()
        if app and cookie:
            app.uninhibit(cookie)
        self.runner = None
        self.log(result)
        self.status_label.set_text(result)
        if ok:
            self.progress.set_fraction(1.0)
            self.progress.set_text("Done")
        self._update_buttons()
        if ok is False:
            self.message(Gtk.MessageType.ERROR, f"{title} didn't finish", result)
        elif ok:
            self.notify(title, result)
        GLib.timeout_add_seconds(2, lambda: (self.refresh_disc(), False)[1])
        return False

    def notify(self, title, body):
        app = self.get_application()
        if app and not self.is_active():
            n = Gio.Notification.new("IPRPS CD Burner")
            n.set_body(body)
            app.send_notification("job", n)

    def on_about(self, _btn):
        a = Gtk.AboutDialog(transient_for=self, modal=True)
        a.set_program_name("IPRPS CD Burner")
        a.set_version(__version__)
        a.set_logo_icon_name("iprps-cd-burner")
        a.set_comments("Burn data discs, audio CDs and disc images on IPRPS OS.\n"
                       "Uses xorriso, cdrskin and FFmpeg.")
        a.set_website("https://infiniteplane.space")
        a.set_copyright("© 2026 Mythical Legends Publishing, LLC")
        a.set_license_type(Gtk.License.GPL_2_0)
        a.run()
        a.destroy()


class BurnerApp(Gtk.Application):
    def __init__(self):
        super().__init__(application_id=APP_ID, flags=Gio.ApplicationFlags.HANDLES_OPEN)
        self.window = None

    def do_startup(self):
        Gtk.Application.do_startup(self)
        settings = Gtk.Settings.get_default()
        if settings:
            settings.set_property("gtk-application-prefer-dark-theme", True)
        provider = Gtk.CssProvider()
        provider.load_from_data(CSS)
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), provider,
                                                 Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

    def do_activate(self):
        if not self.window:
            self.window = BurnerWindow(self)
        self.window.present()

    def do_open(self, files, _n, _hint):
        """Opening files with the app: .iso images go to Burn Image, music to Audio CD,
        everything else to Data Disc."""
        self.do_activate()
        w = self.window
        paths = [f.get_path() for f in files if f.get_path()]
        isos = [p for p in paths if p.lower().endswith((".iso", ".img"))]
        music = [p for p in paths if p.lower().endswith(B.AUDIO_EXTENSIONS)]
        other = [p for p in paths if p not in isos and p not in music]
        if isos:
            w.image_chooser.set_filename(isos[0])
            GLib.idle_add(w.on_image_chosen)
            w.stack.set_visible_child_name("image")
        if music:
            w.add_audio_paths(music)
            if not isos:
                w.stack.set_visible_child_name("audio")
        if other:
            w.add_data_paths(other)
            if not isos and not music:
                w.stack.set_visible_child_name("data")


def main(argv=None):
    import sys
    return BurnerApp().run(argv if argv is not None else sys.argv)
