let shortcuts = {};
let notes = {};
let clipboardHistory = [];
let fuzzySearch = false;

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupEventListeners();
  setupResizable();
});

function loadData() {
  chrome.storage.sync.get(['shortcuts', 'notes', 'clipboardHistory', 'fuzzySearch'], (result) => {
    shortcuts = result.shortcuts || {};
    notes = result.notes || {};
    clipboardHistory = result.clipboardHistory || [];
    fuzzySearch = result.fuzzySearch || false;
    renderShortcuts();
    renderNotes();
    renderClipboardHistory();
    document.getElementById('fuzzy-search').checked = fuzzySearch;
  });
}

function setupEventListeners() {
  // Sidebar navigation
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
      document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      document.getElementById(`${item.dataset.view}-view`).classList.add('active');
      item.classList.add('active');
    });
  });

  // Shortcuts
  document.getElementById('add-shortcut-btn').addEventListener('click', addShortcut);
  document.getElementById('shortcut-search').addEventListener('input', filterShortcuts);

  // Notes
  document.getElementById('add-note-btn').addEventListener('click', addNote);
  document.getElementById('notes-search').addEventListener('input', filterNotes);

  // Clipboard
  document.getElementById('clipboard-search').addEventListener('input', filterClipboardHistory);

  // Settings
  document.getElementById('fuzzy-search').addEventListener('change', toggleFuzzySearch);
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', importData);

  // Add event listener for shortcut import
  document.getElementById('import-shortcuts-btn').addEventListener('click', importShortcuts);

  // Add event listener for notes export
  document.getElementById('export-notes-btn').addEventListener('click', exportNotes);

  // Add event listener for clipboard history clear
  document.getElementById('clear-clipboard-btn').addEventListener('click', clearClipboardHistory);
}

function setupResizable() {
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      chrome.storage.local.set({ popupSize: { width, height } });
    }
  });

  resizeObserver.observe(document.body);

  chrome.storage.local.get('popupSize', (result) => {
    if (result.popupSize) {
      document.body.style.width = `${result.popupSize.width}px`;
      document.body.style.height = `${result.popupSize.height}px`;
    }
  });
}

function addShortcut() {
  const key = document.getElementById('shortcut-key').value.trim();
  const text = document.getElementById('shortcut-text').value.trim();

  if (key && text) {
    shortcuts[key] = text;
    chrome.storage.sync.set({ shortcuts }, () => {
      renderShortcuts();
      document.getElementById('shortcut-key').value = '';
      document.getElementById('shortcut-text').value = '';
    });
  }
}

function renderShortcuts() {
  const list = document.getElementById('shortcuts-list');
  list.innerHTML = '';

  Object.entries(shortcuts).forEach(([key, value]) => {
    const item = document.createElement('div');
    item.className = 'shortcut-item';
    item.innerHTML = `
      <div class="item-details">
        <strong>${key}:</strong> ${value}
      </div>
      <div class="action-btns">
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
      </div>
    `;
    
    item.querySelector('.edit-btn').addEventListener('click', () => editShortcut(key));
    item.querySelector('.delete-btn').addEventListener('click', () => deleteShortcut(key));
    
    list.appendChild(item);
  });
}

function editShortcut(key) {
  const newText = prompt('Enter the new text for the shortcut:', shortcuts[key]);
  if (newText !== null) {
    shortcuts[key] = newText;
    chrome.storage.sync.set({ shortcuts }, renderShortcuts);
  }
}

function deleteShortcut(key) {
  if (confirm(`Are you sure you want to delete the shortcut "${key}"?`)) {
    delete shortcuts[key];
    chrome.storage.sync.set({ shortcuts }, renderShortcuts);
  }
}

function filterShortcuts() {
  const query = document.getElementById('shortcut-search').value.toLowerCase();
  const list = document.getElementById('shortcuts-list');
  list.innerHTML = '';

  Object.entries(shortcuts).forEach(([key, value]) => {
    if (fuzzySearch) {
      if (fuzzysearch(query, key.toLowerCase()) || fuzzysearch(query, value.toLowerCase())) {
        renderShortcutItem(key, value, list);
      }
    } else {
      if (key.toLowerCase().includes(query) || value.toLowerCase().includes(query)) {
        renderShortcutItem(key, value, list);
      }
    }
  });
}

function renderShortcutItem(key, value, list) {
  const item = document.createElement('div');
  item.className = 'shortcut-item';
  item.innerHTML = `
    <strong>${key}:</strong> ${value}
    <button class="edit-btn">Edit</button>
    <button class="delete-btn">Delete</button>
  `;
  
  item.querySelector('.edit-btn').addEventListener('click', () => editShortcut(key));
  item.querySelector('.delete-btn').addEventListener('click', () => deleteShortcut(key));
  
  list.appendChild(item);
}

function addNote() {
  const topic = document.getElementById('note-topic').value.trim();
  const subtopic = document.getElementById('note-subtopic').value.trim();
  const template = document.getElementById('note-template').value.trim();

  if (topic && subtopic && template) {
    if (!notes[topic]) {
      notes[topic] = {};
    }
    notes[topic][subtopic] = { text: template };
    chrome.storage.sync.set({ notes }, () => {
      renderNotes();
      document.getElementById('note-topic').value = '';
      document.getElementById('note-subtopic').value = '';
      document.getElementById('note-template').value = '';
    });
  }
}

function renderNotes() {
  const list = document.getElementById('notes-list');
  list.innerHTML = '';

  Object.entries(notes).forEach(([topic, subtopics]) => {
    const topicElement = document.createElement('div');
    topicElement.className = 'note-topic';
    topicElement.innerHTML = `<h3>${topic}</h3>`;

    Object.entries(subtopics).forEach(([subtopic, data]) => {
      const subtopicElement = document.createElement('div');
      subtopicElement.className = 'note-item';
      subtopicElement.innerHTML = `
      <div class="details">
        <strong>${subtopic}:</strong> ${data.text}
      </div>
      <div class="action-btns">
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
      </div>
      `;

      subtopicElement.querySelector('.edit-btn').addEventListener('click', () => editNote(topic, subtopic));
      subtopicElement.querySelector('.delete-btn').addEventListener('click', () => deleteNote(topic, subtopic));

      topicElement.appendChild(subtopicElement);
    });

    list.appendChild(topicElement);
  });
}

function editNote(topic, subtopic) {
  const newText = prompt('Enter the new text for the note:', notes[topic][subtopic].text);
  if (newText !== null) {
    notes[topic][subtopic].text = newText;
    chrome.storage.sync.set({ notes }, renderNotes);
  }
}

function deleteNote(topic, subtopic) {
  if (confirm(`Are you sure you want to delete the note "${subtopic}" under "${topic}"?`)) {
    delete notes[topic][subtopic];
    if (Object.keys(notes[topic]).length === 0) {
      delete notes[topic];
    }
    chrome.storage.sync.set({ notes }, renderNotes);
  }
}

function filterNotes() {
  const query = document.getElementById('notes-search').value.toLowerCase();
  const list = document.getElementById('notes-list');
  list.innerHTML = '';

  Object.entries(notes).forEach(([topic, subtopics]) => {
    const topicElement = document.createElement('div');
    topicElement.className = 'note-topic';
    topicElement.innerHTML = `<h3>${topic}</h3>`;

    let hasMatchingSubtopics = false;

    Object.entries(subtopics).forEach(([subtopic, data]) => {
      if (fuzzySearch) {
        if (fuzzysearch(query, topic.toLowerCase()) || fuzzysearch(query, subtopic.toLowerCase()) || fuzzysearch(query, data.text.toLowerCase())) {
          renderNoteItem(topic, subtopic, data, topicElement);
          hasMatchingSubtopics = true;
        }
      } else {
        if (topic.toLowerCase().includes(query) || subtopic.toLowerCase().includes(query) || data.text.toLowerCase().includes(query)) {
          renderNoteItem(topic, subtopic, data, topicElement);
          hasMatchingSubtopics = true;
        }
      }
    });

    if (hasMatchingSubtopics) {
      list.appendChild(topicElement);
    }
  });
}

function renderNoteItem(topic, subtopic, data, topicElement) {
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
}

function renderClipboardHistory() {
  const list = document.getElementById('clipboard-list');
  list.innerHTML = '';

  clipboardHistory.forEach((item, index) => {
    const element = document.createElement('div');
    element.className = 'clipboard-item';
    element.textContent = item.length > 50 ? item.substring(0, 50) + '...' : item;
    element.addEventListener('click', () => {
      navigator.clipboard.writeText(item).then(() => {
        alert('Copied to clipboard!');
      });
    });
    list.appendChild(element);
  });
}

function filterClipboardHistory() {
  const query = document.getElementById('clipboard-search').value.toLowerCase();
  const list = document.getElementById('clipboard-list');
  list.innerHTML = '';

  clipboardHistory.forEach((item, index) => {
    if (fuzzySearch) {
      if (fuzzysearch(query, item.toLowerCase())) {
        renderClipboardItem(item, list);
      }
    } else {
      if (item.toLowerCase().includes(query)) {
        renderClipboardItem(item, list);
      }
    }
  });
}

function renderClipboardItem(item, list) {
  const element = document.createElement('div');
  element.className = 'clipboard-item';
  element.textContent = item.length > 50 ? item.substring(0, 50) + '...' : item;
  element.addEventListener('click', () => {
    navigator.clipboard.writeText(item).then(() => {
      alert('Copied to clipboard!');
    });
  });
  list.appendChild(element);
}

function toggleFuzzySearch() {
  fuzzySearch = document.getElementById('fuzzy-search').checked;
  chrome.storage.sync.set({ fuzzySearch });
}

function exportData() {
  const data = JSON.stringify({ shortcuts, notes, clipboardHistory });
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'text_expander_data.json';
  a.click();
}

function importData(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        chrome.storage.sync.set(data, () => {
          loadData();
          alert('Data imported successfully!');
        });
      } catch (error) {
        alert('Error importing data. Please make sure the file is valid JSON.');
      }
    };
    reader.readAsText(file);
  }
}

// Fuzzy search function
function fuzzysearch(needle, haystack) {
  const hlen = haystack.length;
  const nlen = needle.length;
  if (nlen > hlen) {
    return false;
  }
  if (nlen === hlen) {
    return needle === haystack;
  }
  outer: for (let i = 0, j = 0; i < nlen; i++) {
    const nch = needle.charCodeAt(i);
    while (j < hlen) {
      if (haystack.charCodeAt(j++) === nch) {
        continue outer;
      }
    }
    return false;
  }
  return true;
}

function importShortcuts() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.csv';
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target.result;
      const lines = csv.split('\n');
      lines.forEach(line => {
        const [key, value] = line.split(',');
        if (key && value) {
          shortcuts[key.trim()] = value.trim();
        }
      });
      chrome.storage.sync.set({ shortcuts }, () => {
        renderShortcuts();
        alert('Shortcuts imported successfully!');
      });
    };
    reader.readAsText(file);
  };
  fileInput.click();
}

function exportNotes() {
  let csvContent = "data:text/csv;charset=utf-8,";
  Object.entries(notes).forEach(([topic, subtopics]) => {
    Object.entries(subtopics).forEach(([subtopic, data]) => {
      csvContent += `${topic},${subtopic},${data.text}\n`;
    });
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "notes_export.csv");
  document.body.appendChild(link);
  link.click();
}

function clearClipboardHistory() {
  if (confirm("Are you sure you want to clear the clipboard history?")) {
    clipboardHistory = [];
    chrome.storage.sync.set({ clipboardHistory }, () => {
      renderClipboardHistory();
      alert('Clipboard history cleared!');
    });
  }
}

