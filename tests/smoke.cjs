// Dependency-free DOM harness: exercises the shipped app script, not copied logic.
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const path = require("node:path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
function boot(storage = new Map(), blocked = false) {
  class Element {
    constructor() { this.value = ""; this.dataset = {}; this.hidden = false; this.events = {}; this.textContent = ""; this.innerHTML = ""; this.open = false; this.classes = new Set(); this.classList = {add: x => this.classes.add(x), remove: x => this.classes.delete(x), toggle: (x, yes) => yes ? this.classes.add(x) : this.classes.delete(x)}; }
    addEventListener(name, fn) { this.events[name] = fn; }
    click() { return this.events.click?.({preventDefault() {}}); }
    focus() { this.focused = true; }
    scrollIntoView() {}
    showModal() { this.open = true; }
    close() { this.open = false; }
    setAttribute(name, value) { this[name] = value; }
    querySelectorAll(selector) {
      const items = [];
      const pattern = selector === ".note-card" ? /data-note-id="([^"]+)"/g : selector === 'input[type="checkbox"]' ? /data-task-id="([^"]+)" data-note-id="([^"]+)"/g : /data-calendar-id="([^"]+)"/g;
      for (const m of this.innerHTML.matchAll(pattern)) { const e = new Element(); if (selector === ".note-card") e.dataset.noteId = m[1]; else if (selector === 'input[type="checkbox"]') { e.dataset.taskId = m[1]; e.dataset.noteId = m[2]; } else e.dataset.calendarId = m[1]; items.push(e); }
      this.children = items;
      return items;
    }
  }
  const ids = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element()]));
  const shell = new Element(), meta = new Element();
  const groups = {};
  for (const [selector, key, values] of [
    [".nav-button", "view", ["notes","tasks","add","schedule","settings"]],
    [".filter-chip", "filter", ["all","task","idea","scheduled"]],
    [".theme-option", "theme", ["ocean","grape","sunset","matcha"]]
  ]) groups[selector] = values.map(value => { const e = new Element(); e.dataset[key] = value; return e; });
  groups[".view"] = ["notesView","tasksView","scheduleView"].map(id => { ids[id].id = id; return ids[id]; });
  const document = {querySelector: s => s[0] === "#" ? ids[s.slice(1)] || null : s === ".app-shell" ? shell : s.startsWith("meta") ? meta : null, querySelectorAll: s => groups[s] || [], createElement: () => new Element()};
  let downloads = [];
  const context = {document, console, Date, Intl, Math, JSON, String, Number, Array, Blob, URL: {createObjectURL: b => { downloads.push(b); return "blob:test"; }, revokeObjectURL() {}}, setTimeout: () => 1, clearTimeout() {}, window: {confirm: () => true, addEventListener() {}}, navigator: {}, location: {protocol: "https:"}, localStorage: {getItem: k => { if (blocked) throw new Error("blocked"); return storage.get(k) || null; }, setItem: (k,v) => { if (blocked) throw new Error("blocked"); storage.set(k,v); }}};
  vm.runInNewContext(source, context);
  return {ids, groups, shell, storage, downloads, notes: () => JSON.parse(storage.get("mello-notes-v1")).notes};
}
const a = boot();
assert.match(a.ids.greeting.textContent, /MELLO/);
assert.equal(a.ids.noteCount.textContent, "4 total");
assert.equal(a.shell.dataset.theme, "ocean");
a.ids.noteInput.value = "A plain note";
a.ids.savePlainNote.click();
assert.equal(a.notes()[0].text, "A plain note");
assert.equal(a.ids.noteInput.value, "");
a.ids.noteInput.value = "call Sam tomorrow at 3pm and buy coffee";
a.ids.organizeButton.click();
assert.equal(a.ids.organizeDialog.open, true);
assert.equal(a.ids.suggestedTime.value, "15:00");
a.ids.applyOrganized.click();
assert.equal(a.notes()[0].tasks.length, 2);
assert.equal(a.ids.organizeDialog.open, false);
a.ids.noteGrid.children[0].click();
assert.equal(a.ids.noteDialog.open, true);
a.ids.editingTitle.value = "Updated title";
a.ids.saveNote.click();
assert.equal(a.notes()[0].title, "Updated title");
const task = a.ids.taskList.children[0];
task.checked = true; task.events.change();
assert.equal(a.notes()[0].tasks[0].done, true);
a.groups[".nav-button"][1].click();
assert.equal(a.ids.capturePanel.hidden, true);
a.groups[".nav-button"][2].click();
assert.equal(a.ids.capturePanel.hidden, false);
assert.equal(a.ids.noteInput.focused, true);
a.groups[".nav-button"][4].click();
assert.equal(a.ids.settingsDialog.open, true);
a.groups[".theme-option"][3].click();
assert.equal(a.shell.dataset.theme, "matcha");
a.ids.noteInput.value = "Keep these exact words!";
a.ids.organizeButton.click(); a.ids.keepOriginal.click();
assert.equal(a.notes()[0].text, "Keep these exact words!");
a.ids.noteGrid.children[0].click();
a.ids.editingDate.value = "2026-10-01"; a.ids.editingTime.value = "09:30";
a.ids.noteCalendar.click();
assert.equal(a.downloads.length, 1);
assert.equal(a.notes()[0].reminderDate, "2026-10-01");
const reloaded = boot(a.storage);
assert.equal(reloaded.notes().length, 7);
assert.equal(reloaded.shell.dataset.theme, "matcha");
const blocked = boot(new Map(), true);
blocked.ids.noteInput.value = "Do not lose my words"; blocked.ids.savePlainNote.click();
assert.equal(blocked.ids.noteInput.value, "Do not lose my words");
assert.match(blocked.ids.toast.textContent, /Storage is unavailable/);
console.log("PASS: startup, plain save, formatting, original save, edit, tasks, navigation, themes, calendar export, persistence, blocked storage.");
