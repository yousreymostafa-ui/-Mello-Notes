(() => {
  "use strict";

  const STORAGE_KEY = "mello-notes-v1";
  const THEME_KEY = "mello-theme-v2";
  const palette = ["lilac", "yellow", "mint", "peach", "blue", "paper"];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const els = {
    greeting: $("#greeting"),
    shell: $(".app-shell"),
    noteInput: $("#noteInput"),
    micButton: $("#micButton"),
    organizeButton: $("#organizeButton"),
    noteGrid: $("#noteGrid"),
    noteCount: $("#noteCount"),
    notesEmpty: $("#notesEmpty"),
    taskList: $("#taskList"),
    taskCount: $("#taskCount"),
    tasksEmpty: $("#tasksEmpty"),
    scheduleList: $("#scheduleList"),
    scheduleEmpty: $("#scheduleEmpty"),
    organizeDialog: $("#organizeDialog"),
    organizedTitle: $("#organizedTitle"),
    organizedText: $("#organizedText"),
    detectedTasks: $("#detectedTasks"),
    detectedTaskCount: $("#detectedTaskCount"),
    suggestedDate: $("#suggestedDate"),
    suggestedTime: $("#suggestedTime"),
    originalText: $("#originalText"),
    applyOrganized: $("#applyOrganized"),
    noteDialog: $("#noteDialog"),
    editingNoteId: $("#editingNoteId"),
    editingTitle: $("#editingTitle"),
    editingText: $("#editingText"),
    editingDate: $("#editingDate"),
    editingTime: $("#editingTime"),
    saveNote: $("#saveNote"),
    deleteNote: $("#deleteNote"),
    settingsDialog: $("#settingsDialog"),
    settingsButton: $("#settingsButton"),
    exportData: $("#exportData"),
    importData: $("#importData"),
    toast: $("#toast")
  };

  let state = loadState();
  let activeFilter = "all";
  let pendingSuggestion = null;
  let toastTimer = null;

  function uid(prefix = "id") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.notes)) return saved;
    } catch (error) {
      console.warn("Could not read saved notes", error);
    }
    return { notes: starterNotes(), version: 1 };
  }

  function starterNotes() {
    const now = new Date().toISOString();
    return [
      {
        id: uid("note"), title: "Tomorrow’s priorities", text: "Review the quotation, confirm the delivery date, and call Ahmed.", original: "",
        type: "task", color: "lilac", createdAt: now, updatedAt: now, reminderDate: "", reminderTime: "10:00",
        tasks: [
          { id: uid("task"), text: "Review the quotation", done: false },
          { id: uid("task"), text: "Confirm the delivery date", done: false },
          { id: uid("task"), text: "Call Ahmed", done: false }
        ]
      },
      {
        id: uid("note"), title: "Ideas for this app", text: "Keep the design friendly, smooth, and quick to understand.", original: "",
        type: "idea", color: "yellow", createdAt: now, updatedAt: now, reminderDate: "", reminderTime: "", tasks: []
      },
      {
        id: uid("note"), title: "Weekend list", text: "Pick up coffee, book the service appointment, and buy groceries.", original: "",
        type: "task", color: "mint", createdAt: now, updatedAt: now, reminderDate: "", reminderTime: "",
        tasks: [
          { id: uid("task"), text: "Pick up coffee", done: true },
          { id: uid("task"), text: "Book the service appointment", done: false },
          { id: uid("task"), text: "Buy groceries", done: false }
        ]
      },
      {
        id: uid("note"), title: "Random thought", text: "A small thought saved now is easier to organize later.", original: "",
        type: "note", color: "peach", createdAt: now, updatedAt: now, reminderDate: "", reminderTime: "", tasks: []
      }
    ];
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      showToast("Storage is unavailable. Export a backup before closing.");
      return false;
    }
  }

  function escapeHtml(value = "") {
    return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  function formatDate(dateString, timeString = "") {
    if (!dateString) return "";
    const date = new Date(`${dateString}T${timeString || "12:00"}`);
    if (Number.isNaN(date.getTime())) return dateString;
    const formatted = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
    if (!timeString) return formatted;
    return `${formatted} · ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)}`;
  }

  function noteIcon(type) {
    if (type === "task") return "✓";
    if (type === "idea") return "💡";
    return "✎";
  }

  function currentNotes() {
    const notes = [...state.notes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    if (activeFilter === "all") return notes;
    if (activeFilter === "scheduled") return notes.filter(note => note.reminderDate);
    return notes.filter(note => note.type === activeFilter);
  }

  function renderNotes() {
    const notes = currentNotes();
    els.noteGrid.innerHTML = notes.map(note => {
      const remaining = (note.tasks || []).filter(task => !task.done).length;
      const meta = note.reminderDate
        ? `🔔 ${formatDate(note.reminderDate, note.reminderTime)}`
        : note.tasks?.length
          ? `${remaining} ${remaining === 1 ? "to-do" : "to-dos"} left`
          : "Saved note";
      return `
        <button class="note-card ${escapeHtml(note.color || "paper")}" data-note-id="${escapeHtml(note.id)}" type="button">
          <div>
            <div class="note-card-top"><h3>${escapeHtml(note.title)}</h3><span class="note-type">${noteIcon(note.type)}</span></div>
            <p>${escapeHtml(note.text)}</p>
          </div>
          <span class="note-meta">${escapeHtml(meta)}</span>
        </button>`;
    }).join("");
    els.noteCount.textContent = `${state.notes.length} total`;
    els.notesEmpty.hidden = notes.length > 0;
    $$(".note-card", els.noteGrid).forEach(card => card.addEventListener("click", () => openNote(card.dataset.noteId)));
  }

  function allTasks() {
    return state.notes.flatMap(note => (note.tasks || []).map(task => ({ ...task, noteId: note.id, noteTitle: note.title })));
  }

  function renderTasks() {
    const tasks = allTasks();
    const open = tasks.filter(task => !task.done).length;
    els.taskCount.textContent = `${open} open`;
    els.tasksEmpty.hidden = tasks.length > 0;
    els.taskList.innerHTML = tasks.map(task => `
      <div class="task-row ${task.done ? "done" : ""}">
        <input type="checkbox" id="${escapeHtml(task.id)}" data-task-id="${escapeHtml(task.id)}" data-note-id="${escapeHtml(task.noteId)}" ${task.done ? "checked" : ""}>
        <div><label for="${escapeHtml(task.id)}">${escapeHtml(task.text)}</label><small>${escapeHtml(task.noteTitle)}</small></div>
      </div>`).join("");
    $$('input[type="checkbox"]', els.taskList).forEach(input => input.addEventListener("change", () => toggleTask(input.dataset.noteId, input.dataset.taskId, input.checked)));
  }

  function renderSchedule() {
    const scheduled = state.notes
      .filter(note => note.reminderDate)
      .sort((a, b) => `${a.reminderDate}${a.reminderTime}`.localeCompare(`${b.reminderDate}${b.reminderTime}`));
    els.scheduleEmpty.hidden = scheduled.length > 0;
    els.scheduleList.innerHTML = scheduled.map(note => `
      <article class="schedule-card">
        <div><h3>${escapeHtml(note.title)}</h3><small>${escapeHtml(note.text.slice(0, 100))}</small><button class="calendar-button" data-calendar-id="${escapeHtml(note.id)}" type="button">Add to Calendar</button></div>
        <time class="schedule-date" datetime="${escapeHtml(note.reminderDate)}">${escapeHtml(formatDate(note.reminderDate, note.reminderTime))}</time>
      </article>`).join("");
    $$('[data-calendar-id]', els.scheduleList).forEach(button => button.addEventListener("click", () => downloadCalendar(button.dataset.calendarId)));
  }

  function renderAll() {
    renderNotes();
    renderTasks();
    renderSchedule();
  }

  function smartOrganize(rawText) {
    const raw = rawText.trim().replace(/[^\S\n]+/g, " ");
    const date = detectDate(raw);
    const time = detectTime(raw);
    let segments = raw
      .replace(/\b(?:also|and then|then)\b/gi, ". ")
      .replace(/\band\s+(?=(?:call|check|ask|send|email|review|confirm|buy|book|prepare|follow|finish|update|contact|meet|visit|remember|pick|pay|submit|complete|create|make|add|schedule|arrange)\b)/gi, ". ")
      .split(/[.!?;\n]+/)
      .map(part => part.trim().replace(/^(?:and|but)\s+/i, ""))
      .filter(part => part.length > 1);
    if (segments.length === 1 && raw.split(" ").length > 10) {
      segments = raw.split(/\s+and\s+/i).map(part => part.trim()).filter(Boolean);
    }
    const cleanedSegments = segments.map(sentenceCase);
    const actionPattern = /^(call|check|ask|send|email|review|confirm|buy|book|prepare|follow|finish|update|contact|meet|visit|remember|pick|pay|submit|complete|create|make|add|schedule|arrange)\b/i;
    const tasks = cleanedSegments
      .filter(segment => actionPattern.test(segment) || /\b(?:need to|must|have to|should|don't forget to)\b/i.test(segment))
      .map(segment => segment.replace(/^(?:i\s+)?(?:need to|must|have to|should|don't forget to)\s+/i, ""))
      .map(stripDateWords)
      .map(sentence => sentence.replace(/[.]$/, ""))
      .filter(Boolean)
      .slice(0, 8);
    const ideaLike = /\b(idea|maybe|could|what if|concept|thought)\b/i.test(raw);
    const type = tasks.length ? "task" : ideaLike ? "idea" : "note";
    const titleSource = tasks[0] || cleanedSegments[0] || raw;
    const title = createTitle(titleSource, type);
    const text = cleanedSegments.length > 1
      ? cleanedSegments.map(segment => `• ${ensurePeriod(segment)}`).join("\n")
      : ensurePeriod(cleanedSegments[0] || raw);
    return { title, text, original: rawText.trim(), tasks, date, time, type };
  }

  function sentenceCase(text) {
    const value = text.trim();
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function ensurePeriod(text) {
    const trimmed = text.trim();
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  }

  function stripDateWords(text) {
    return text
      .replace(/\b(today|tomorrow|tonight|this morning|this afternoon|this evening|next (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week))\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function createTitle(text, type) {
    const clean = text.replace(/[•.,!?]/g, "").trim();
    const words = clean.split(/\s+/).slice(0, 7);
    let title = sentenceCase(words.join(" "));
    if (clean.split(/\s+/).length > 7) title += "…";
    if (!title) title = type === "idea" ? "New idea" : type === "task" ? "Things to do" : "New note";
    return title;
  }

  function detectDate(text) {
    const lower = text.toLowerCase();
    const base = new Date();
    if (lower.includes("tomorrow")) base.setDate(base.getDate() + 1);
    else if (!lower.includes("today") && !lower.includes("tonight")) {
      const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const dayIndex = days.findIndex(day => lower.includes(day));
      if (dayIndex < 0) return "";
      let add = (dayIndex - base.getDay() + 7) % 7;
      if (add === 0 || lower.includes(`next ${days[dayIndex]}`)) add += 7;
      base.setDate(base.getDate() + add);
    }
    return localDate(base);
  }

  function detectTime(text) {
    const match = text.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (!match) return "";
    let hour = Number(match[1]);
    const minute = match[2] || "00";
    const period = match[3].toLowerCase();
    if (period === "pm" && hour < 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  function localDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function openSuggestion() {
    const raw = els.noteInput.value.trim();
    if (!raw) {
      showToast("Write or dictate something first.");
      els.noteInput.focus();
      return;
    }
    pendingSuggestion = smartOrganize(raw);
    els.organizedTitle.value = pendingSuggestion.title;
    els.organizedText.value = pendingSuggestion.text;
    els.originalText.textContent = pendingSuggestion.original;
    els.suggestedDate.value = pendingSuggestion.date;
    els.suggestedTime.value = pendingSuggestion.time;
    els.detectedTaskCount.textContent = pendingSuggestion.tasks.length;
    els.detectedTasks.innerHTML = pendingSuggestion.tasks.length
      ? pendingSuggestion.tasks.map(task => `<div class="detected-task">${escapeHtml(task)}</div>`).join("")
      : '<span class="small">No to-dos detected. This will stay as a simple note.</span>';
    els.organizeDialog.showModal();
  }

  function addSuggestedNote(event) {
    event.preventDefault();
    if (!pendingSuggestion) return;
    const now = new Date().toISOString();
    const tasks = pendingSuggestion.tasks.map(task => ({ id: uid("task"), text: task, done: false }));
    state.notes.unshift({
      id: uid("note"),
      title: els.organizedTitle.value.trim() || "New note",
      text: els.organizedText.value.trim(),
      original: pendingSuggestion.original,
      type: tasks.length ? "task" : pendingSuggestion.type,
      color: palette[state.notes.length % palette.length],
      createdAt: now,
      updatedAt: now,
      reminderDate: els.suggestedDate.value,
      reminderTime: els.suggestedTime.value,
      tasks
    });
    if (!saveState()) { state.notes.shift(); return; }
    els.noteInput.value = "";
    pendingSuggestion = null;
    els.organizeDialog.close();
    resetFilter();
    renderAll();
    showToast("Note saved ✨");
  }

  function resetFilter() {
    activeFilter = "all";
    $$(".filter-chip").forEach(button => button.classList.toggle("active", button.dataset.filter === "all"));
  }

  function savePlainNote() {
    const raw = els.noteInput.value.trim();
    if (!raw) { showToast("Write a note first."); els.noteInput.focus(); return; }
    const now = new Date().toISOString();
    state.notes.unshift({ id: uid("note"), title: createTitle(raw, "note"), text: raw, original: raw,
      type: "note", color: "paper", createdAt: now, updatedAt: now, reminderDate: "", reminderTime: "", tasks: [] });
    if (!saveState()) { state.notes.shift(); return; }
    els.noteInput.value = "";
    resetFilter();
    renderAll();
    showToast("Note saved");
  }

  function openNote(noteId) {
    const note = state.notes.find(item => item.id === noteId);
    if (!note) return;
    els.editingNoteId.value = note.id;
    els.editingTitle.value = note.title;
    els.editingText.value = note.text;
    els.editingDate.value = note.reminderDate || "";
    els.editingTime.value = note.reminderTime || "";
    els.noteDialog.showModal();
  }

  function updateNote(event) {
    event.preventDefault();
    const note = state.notes.find(item => item.id === els.editingNoteId.value);
    if (!note) return;
    const previous = { ...note };
    note.title = els.editingTitle.value.trim() || "New note";
    note.text = els.editingText.value.trim();
    note.reminderDate = els.editingDate.value;
    note.reminderTime = els.editingTime.value;
    note.updatedAt = new Date().toISOString();
    if (!saveState()) { Object.assign(note, previous); return false; }
    els.noteDialog.close();
    renderAll();
    showToast("Note updated");
    return true;
  }

  function removeNote() {
    const id = els.editingNoteId.value;
    const note = state.notes.find(item => item.id === id);
    if (!note || !window.confirm(`Delete “${note.title}”?`)) return;
    state.notes = state.notes.filter(item => item.id !== id);
    saveState();
    els.noteDialog.close();
    renderAll();
    showToast("Note deleted");
  }

  function toggleTask(noteId, taskId, done) {
    const note = state.notes.find(item => item.id === noteId);
    const task = note?.tasks?.find(item => item.id === taskId);
    if (!task) return;
    task.done = done;
    note.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
  }

  function changeView(view) {
    if (view === "add") {
      changeView("notes");
      $("#capturePanel").scrollIntoView({ behavior: "smooth", block: "start" });
      els.noteInput.focus();
      return;
    }
    if (view === "settings") {
      els.settingsDialog.showModal();
      return;
    }
    $$(".view").forEach(section => {
      const active = section.id === `${view}View`;
      section.hidden = !active;
      section.classList.toggle("active-view", active);
    });
    $$(".nav-button").forEach(button => button.classList.toggle("active", button.dataset.view === view));
    $("#capturePanel").hidden = view !== "notes";
    $("#screenTitle").textContent = view === "notes" ? "Your notes" : view === "tasks" ? "Your to-dos" : "Coming up";
  }

  function setTheme(theme) {
    if (!["ocean", "grape", "sunset", "matcha"].includes(theme)) theme = "ocean";
    els.shell.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
    $$(".theme-option").forEach(button => button.classList.toggle("active", button.dataset.theme === theme));
    const colors = { ocean: "#f6f7f9", grape: "#f7f7fa", sunset: "#f8f7f4", matcha: "#f5f8f6" };
    $('meta[name="theme-color"]').setAttribute("content", colors[theme] || colors.ocean);
  }

  function downloadCalendar(noteId) {
    const note = state.notes.find(item => item.id === noteId);
    if (!note?.reminderDate) return;
    const start = `${note.reminderDate.replaceAll("-", "")}${note.reminderTime ? `T${note.reminderTime.replace(":", "")}00` : ""}`;
    const allDay = !note.reminderTime;
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mello Notes//EN", "BEGIN:VEVENT",
      `UID:${note.id}@mello-notes`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `${allDay ? "DTSTART;VALUE=DATE" : "DTSTART"}:${start}`,
      `SUMMARY:${escapeICS(note.title)}`, `DESCRIPTION:${escapeICS(note.text)}`, "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    downloadBlob(`${safeFileName(note.title)}.ics`, ics, "text/calendar;charset=utf-8");
    showToast("Calendar event ready");
  }

  function escapeICS(value) {
    return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  }

  function safeFileName(value) {
    return value.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-").toLowerCase() || "mello-note";
  }

  function downloadBlob(fileName, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportBackup() {
    downloadBlob(`mello-notes-backup-${localDate(new Date())}.json`, JSON.stringify(state, null, 2), "application/json");
    showToast("Backup downloaded");
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!imported || !Array.isArray(imported.notes)) throw new Error("Invalid backup");
      state = { notes: imported.notes, version: 1 };
      saveState();
      renderAll();
      showToast("Backup restored");
    } catch (error) {
      showToast("That backup could not be opened");
    } finally {
      event.target.value = "";
    }
  }

  function bindEvents() {
    els.micButton.addEventListener("click", () => {
      els.noteInput.focus();
      showToast("Tap the microphone on your iPhone keyboard to dictate.");
    });
    els.organizeButton.addEventListener("click", openSuggestion);
    $("#savePlainNote").addEventListener("click", savePlainNote);
    $("#keepOriginal").addEventListener("click", event => { event.preventDefault(); savePlainNote(); els.organizeDialog.close(); });
    $("#noteCalendar").addEventListener("click", () => {
      if (!els.editingDate.value) { showToast("Choose a reminder date first."); els.editingDate.focus(); return; }
      if (updateNote({preventDefault() {}})) downloadCalendar(els.editingNoteId.value);
    });
    els.applyOrganized.addEventListener("click", addSuggestedNote);
    els.saveNote.addEventListener("click", updateNote);
    els.deleteNote.addEventListener("click", removeNote);
    els.settingsButton.addEventListener("click", () => els.settingsDialog.showModal());
    els.exportData.addEventListener("click", exportBackup);
    els.importData.addEventListener("change", importBackup);
    $$(".filter-chip").forEach(button => button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      $$(".filter-chip").forEach(item => item.classList.toggle("active", item === button));
      renderNotes();
    }));
    $$(".nav-button").forEach(button => button.addEventListener("click", () => changeView(button.dataset.view)));
    $$(".theme-option").forEach(button => button.addEventListener("click", () => setTheme(button.dataset.theme)));
  }

  function updateGreeting() {
    const hour = new Date().getHours();
    els.greeting.textContent = `MELLO / ${hour < 12 ? "GOOD MORNING" : hour < 18 ? "GOOD AFTERNOON" : "GOOD EVENING"}`;
  }

  let savedTheme = "ocean";
  try { savedTheme = localStorage.getItem(THEME_KEY) || "ocean"; } catch {}
  setTheme(savedTheme);
  updateGreeting();
  bindEvents();
  renderAll();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(error => console.warn("Service worker registration failed", error)));
  }
})();
