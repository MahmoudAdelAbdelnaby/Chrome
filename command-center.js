let shortcuts = {};
let notes = {};

// Load data from storage
chrome.storage.sync.get(['shortcuts', 'notes'], (result) => {
  shortcuts = result.shortcuts || {};
  notes = result.notes || {};
  renderShortcuts();
  renderNotes();
});

function renderShortcuts() {
  const shortcutList = document.getElementById('shortcutList');
  shortcutList.innerHTML = '';

  Object.entries(shortcuts).forEach(([key, value]) => {
    const item = document.createElement('div');
    item.className = 'shortcut-item';
    item.innerHTML = `
      <strong>${key}:</strong> ${value}
      <button class="edit-btn">Edit</button>
      <button class="delete-btn">Delete</button>
    `;
    
    item.querySelector('.edit-btn').addEventListener('click', () => editShortcut(key));
    item.querySelector('.delete-btn').addEventListener('click', () => deleteShortcut(key));
    
    shortcutList.appendChild(item);
  });
}

function renderNotes() {
  const notesList = document.getElementById('notesList');
  notesList.innerHTML = '';

  Object.entries(notes).forEach(([topic, subtopics]) => {
    const topicElement = document.createElement('div');
    topicElement.className = 'note-topic';
    topicElement.innerHTML = `<h3>${topic}</h3>`;

    Object.entries(subtopics).forEach(([subtopic, data]) => {
      const subtopicElement = document.createElement('div');
      subtopicElement.className = 'note-item';
      subtopicElement.innerHTML = `
        <strong>${subtopic}:</strong> ${data.text}
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
      `;

      subtopicElement.querySelector('.edit-btn').addEventListener('click', () => editNote(topic, subtopic));
      subtopicElement.querySelector('.delete-btn').addEventListener('click', () => deleteNote(topic, subtopic));

      topicElement.appendChild(subtopicElement);
    });

    notesList.appendChild(topicElement);
  });
}

document.getElementById('addShortcutBtn').addEventListener('click', () => {
  const key = prompt('Enter the shortcut key:');
  if (key && !shortcuts[key]) {
    const value = prompt('Enter the shortcut value:');
    if (value) {
      shortcuts[key] = value;
      saveAndRenderShortcuts();
    }
  } else if (shortcuts[key]) {
    alert('This shortcut already exists. Please choose a different key.');
  }
});

document.getElementById('addNoteBtn').addEventListener('click', () => {
  const topic = prompt('Enter the note topic:');
  if (topic) {
    const subtopic = prompt('Enter the note subtopic:');
    if (subtopic) {
      const text = prompt('Enter the note text:');
      if (text) {
        if (!notes[topic]) {
          notes[topic] = {};
        }
        notes[topic][subtopic] = { text };
        saveAndRenderNotes();
      }
    }
  }
});

function editShortcut(key) {
  const newValue = prompt('Enter the new value for the shortcut:', shortcuts[key]);
  if (newValue !== null) {
    shortcuts[key] = newValue;
    saveAndRenderShortcuts();
  }
}

function deleteShortcut(key) {
  if (confirm(`Are you sure you want to delete the shortcut "${key}"?`)) {
    delete shortcuts[key];
    saveAndRenderShortcuts();
  }
}

function editNote(topic, subtopic) {
  const newText = prompt('Enter the new text for the note:', notes[topic][subtopic].text);
  if (newText !== null) {
    notes[topic][subtopic].text = newText;
    saveAndRenderNotes();
  }
}

function deleteNote(topic, subtopic) {
  if (confirm(`Are you sure you want to delete the note "${subtopic}" under "${topic}"?`)) {
    delete notes[topic][subtopic];
    if (Object.keys(notes[topic]).length === 0) {
      delete notes[topic];
    }
    saveAndRenderNotes();
  }
}

function saveAndRenderShortcuts() {
  chrome.storage.sync.set({ shortcuts }, () => {
    renderShortcuts();
  });
}

function saveAndRenderNotes() {
  chrome.storage.sync.set({ notes }, () => {
    renderNotes();
  });
}

