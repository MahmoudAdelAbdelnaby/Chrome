let shortcuts = {};
let notes = {};
let clipboardHistory = [];
let fuzzySearch = false;
let activeMenu = null;

// Load data from storage
chrome.storage.sync.get(
  ["shortcuts", "notes", "clipboardHistory", "fuzzySearch"],
  (result) => {
    shortcuts = result.shortcuts || {};
    notes = result.notes || {};
    clipboardHistory = result.clipboardHistory || [];
    fuzzySearch = result.fuzzySearch || false;
  }
);

// Update the observer and initial setup
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          addInputListeners(node);
        }
      });
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Remove existing event listeners before adding new ones
function addInputListeners(element) {
  if (element.nodeType === Node.ELEMENT_NODE) {
    if (
      element.tagName === "INPUT" ||
      element.tagName === "TEXTAREA" ||
      element.className === "elementToProof" ||
      element.tagName === "P" ||
      element.isContentEditable
    ) {
      // Remove existing listeners
      element.removeEventListener("input", handleInput);
      element.removeEventListener("keydown", handleKeydown);

      // Add new listeners
      element.addEventListener("input", handleInput);
      element.addEventListener("keydown", handleKeydown);
    }

    // Process child elements
    for (let child of element.children) {
      addInputListeners(child);
    }
  }
}

// Initial setup for existing elements
function initializeInputs() {
  // Handle regular inputs
  document.querySelectorAll('input[type="text"], textarea').forEach((input) => {
    input.addEventListener("input", handleInput);
  });

  // Handle contenteditable elements
  document.querySelectorAll('[contenteditable="true"]').forEach((editable) => {
    editable.addEventListener("input", handleInput);
  });

  // Handle iframes
  document.querySelectorAll("iframe").forEach((iframe) => {
    try {
      if (iframe.contentDocument) {
        const iframeInputs = iframe.contentDocument.querySelectorAll(
          'input[type="text"], textarea, [contenteditable="true"]'
        );
        iframeInputs.forEach((input) => {
          input.addEventListener("input", handleInput);
        });
      }
    } catch (e) {
      // Handle cross-origin iframe errors silently
    }
  });
}

// // Listen for input events
// document.addEventListener('input', handleInput);
// document.addEventListener('keydown', handleKeydown);

// Add keyboard event listener for Enter key
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const activeMenu = document.querySelector(".shortcut-menu");
    if (activeMenu) {
      const activeItem = activeMenu.querySelector(".shortcut-menu-item.active");
      if (activeItem) {
        activeItem.click();
      }
      e.preventDefault();
    }
  }
});

function handleKeydown(e) {
  const target = e.target;
  const isContentEditable = isEditableElement(target);
  const value = getElementValue(target);

  // Check if it's a trigger key (space, enter, or tab)
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab') {
    // Look for any shortcut in the text
    let shortcutMatch = null;
    
    // Check for shortcuts in different groups
    for (const group in shortcuts) {
      for (const shortcutKey in shortcuts[group]) {
        const shortcutPattern = shortcutKey.replace('//', '');
        
        // Special handling for email composers and contenteditable elements
        if (isContentEditable) {
          const selection = window.getSelection();
          if (selection.rangeCount) {
            const range = selection.getRangeAt(0);
            const container = range.startContainer;
            
            // Get text content up to cursor
            let content;
            if (container.nodeType === Node.TEXT_NODE) {
              content = container.textContent.substring(0, range.startOffset);
            } else {
              const textContent = target.textContent || '';
              content = textContent.substring(0, range.startOffset);
            }
            
            // Check if content ends with the shortcut
            if (content.endsWith('//' + shortcutPattern)) {
              e.preventDefault();
              e.stopPropagation();
              
              // Get the replacement text
              const replacementText = shortcuts[group][shortcutKey];
              
              // Get full content
              const fullContent = container.nodeType === Node.TEXT_NODE ? 
                container.textContent : 
                target.textContent;
              
              // Find the shortcut position
              const shortcutIndex = content.lastIndexOf('//' + shortcutPattern);
              const beforeShortcut = fullContent.substring(0, shortcutIndex);
              const afterShortcut = fullContent.substring(shortcutIndex + shortcutPattern.length + 2);
              
              // Create new content
              const newContent = beforeShortcut + replacementText + afterShortcut;
              
              // Update content
              if (container.nodeType === Node.TEXT_NODE) {
                container.textContent = newContent;
              } else {
                target.textContent = newContent;
              }
              
              // Set cursor position
              const newRange = document.createRange();
              const textNode = container.nodeType === Node.TEXT_NODE ? 
                container : 
                target.firstChild || target;
              
              const newPosition = shortcutIndex + replacementText.length;
              
              try {
                newRange.setStart(textNode, newPosition);
                newRange.setEnd(textNode, newPosition);
                selection.removeAllRanges();
                selection.addRange(newRange);
                
                // Ensure focus remains on editor
                target.focus();
              } catch (err) {
                console.error('Error setting cursor position:', err);
              }
              
              closeActiveMenu();
              return;
            }
          }
        } else {
          // Handle regular input fields (unchanged)
          const pattern = new RegExp(`//${shortcutPattern}$`);
          if (pattern.test(value)) {
            e.preventDefault();
            e.stopPropagation();
            
            const replacementText = shortcuts[group][shortcutKey];
            const start = target.selectionStart;
            const shortcutStart = value.lastIndexOf('//' + shortcutPattern);
            
            if (shortcutStart !== -1) {
              const newValue = value.substring(0, shortcutStart) + 
                             replacementText + 
                             value.substring(start);
              
              target.value = newValue;
              const newPosition = shortcutStart + replacementText.length;
              target.selectionStart = newPosition;
              target.selectionEnd = newPosition;
              target.focus();
            }
            
            closeActiveMenu();
            return;
          }
        }
      }
    }
  }
}

// Get the writing cursor position
function getCursorPosition(element) {
  if (element.isContentEditable) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    if (rects.length > 0) {
      return {
        left: rects[0].left,
        top: rects[0].top,
        height: rects[0].height,
      };
    }
  } else {
    // For regular input elements
    const inputPosition = element.getBoundingClientRect();
    // Create a temporary span to measure text
    const span = document.createElement("span");
    const text = element.value.substring(0, element.selectionStart);
    span.textContent = text;
    span.style.opacity = "0";
    span.style.position = "absolute";
    span.style.whiteSpace = "pre";
    span.style.font = window.getComputedStyle(element).font;

    document.body.appendChild(span);
    const spanRect = span.getBoundingClientRect();
    document.body.removeChild(span);

    return {
      left: inputPosition.left + spanRect.width,
      top: inputPosition.top,
      height: inputPosition.height,
    };
  }
  return null;
}

function handleInput(e) {
  const target = e.target;
  const value = target.value || target.textContent;
  const isContentEditable = target.isContentEditable;

  debug('Input event:', { value, isContentEditable });

  // Check for shortcut pattern
  const match = value.match(/\/\/(\w*)$/);
  
  if (!match) {
    closeActiveMenu();
    return;
  }

  const searchTerm = match[1].toLowerCase();
  debug('Search term:', searchTerm);

  // Special commands
  if (value.endsWith("//notes")) {
    closeActiveMenu();
    showNotesPopup(target, isContentEditable);
        return;
      }

  if (value.endsWith("//clipboard")) {
    closeActiveMenu();
    showClipboardHistory(target, isContentEditable);
    return;
  }

  updateOrCreateMenu(target, isContentEditable, searchTerm);
}

function updateOrCreateMenu(target, isContentEditable, searchTerm) {
  if (!activeMenu) {
    activeMenu = createMenu(target, isContentEditable);
  }
  
  updateMenuContent(searchTerm);
}

function createMenu(target, isContentEditable) {
  const menu = document.createElement('div');
  menu.className = 'menu';
  
  // Store the original trigger element
  menu.triggerElement = target;
  
  const content = document.createElement('div');
  content.className = 'menu-content';
  menu.appendChild(content);

  // Get cursor position
  const cursorPosition = getCursorCoordinates(target, isContentEditable);
  
  // Position menu near cursor with fixed offset
  if (cursorPosition) {
    const { x, y } = cursorPosition;
    menu.style.position = 'fixed';
    
    // Calculate position with fixed offset
    const offsetX = 10; // Horizontal offset from cursor
    const offsetY = 20; // Vertical offset from cursor
    
    // Check if menu would go off-screen
    const menuWidth = 300;
    const menuHeight = 300;
    
    let left = x + offsetX;
    let top = y + offsetY;
    
    // Adjust if off screen right
    if (left + menuWidth > window.innerWidth) {
      left = x - menuWidth - offsetX;
    }
    
    // Adjust if off screen bottom
    if (top + menuHeight > window.innerHeight) {
      top = y - menuHeight - offsetY;
    }
    
    // Ensure menu doesn't go off screen left or top
    left = Math.max(10, left);
    top = Math.max(10, top);
    
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  document.body.appendChild(menu);
  return menu;
}

function updateMenuContent(searchTerm) {
  if (!activeMenu) return;

  const content = activeMenu.querySelector('.menu-content');
  content.innerHTML = '';

  if (!searchTerm) {
    renderGroups(content);
    return;
  }

  const results = searchShortcuts(searchTerm);
  if (results.shortcuts.length === 0 && results.groups.length === 0) {
    closeActiveMenu();
    return;
  }

  renderSearchResults(content, results);
}

function searchShortcuts(term) {
  const results = {
    groups: [],
    shortcuts: []
  };

  // Search groups
  Object.keys(shortcuts).forEach(group => {
    if (group.toLowerCase().includes(term)) {
      results.groups.push(group);
    }
    
    // Search shortcuts within group
    Object.entries(shortcuts[group]).forEach(([key, value]) => {
      if (key.toLowerCase().includes(term)) {
        results.shortcuts.push({ group, key, value });
      }
    });
  });

  return results;
}

function renderGroups(container) {
  Object.keys(shortcuts).forEach(group => {
    const groupItem = document.createElement('div');
    groupItem.className = 'group-item';
    groupItem.textContent = group;
    groupItem.addEventListener('click', (e) => {
      e.stopPropagation();
      showGroupShortcuts(container, group, e);
    });
    container.appendChild(groupItem);
  });
}

function showGroupShortcuts(container, group, e) {
  // Prevent event propagation to avoid menu closing
  if (e) e.stopPropagation();
  
  container.innerHTML = '';
  
  // Add back button
  const backBtn = document.createElement('div');
  backBtn.className = 'back-button';
  backBtn.innerHTML = '← Back to Groups';
  backBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    updateMenuContent();
  });
  container.appendChild(backBtn);

  // Add shortcuts
  Object.entries(shortcuts[group]).forEach(([key, value]) => {
    const item = createShortcutItem(key, value);
    container.appendChild(item);
  });
}

function renderSearchResults(container, results) {
  // Render matching groups
  if (results.groups.length > 0) {
    const groupsSection = document.createElement('div');
    groupsSection.className = 'menu-section';
    groupsSection.innerHTML = '<div class="menu-section-title">Groups</div>';
    
    results.groups.forEach(group => {
      const groupItem = document.createElement('div');
      groupItem.className = 'group-item';
      groupItem.textContent = group;
      groupItem.addEventListener('click', () => showGroupShortcuts(container, group));
      groupsSection.appendChild(groupItem);
    });
    
    container.appendChild(groupsSection);
  }

  // Render matching shortcuts
  if (results.shortcuts.length > 0) {
    const shortcutsSection = document.createElement('div');
    shortcutsSection.className = 'menu-section';
    shortcutsSection.innerHTML = '<div class="menu-section-title">Shortcuts</div>';
    
    results.shortcuts.forEach(({ key, value }) => {
      const item = createShortcutItem(key, value);
      shortcutsSection.appendChild(item);
    });
    
    container.appendChild(shortcutsSection);
  }
}

function createShortcutItem(key, value) {
  const item = document.createElement('div');
  item.className = 'shortcut-menu-item';
        item.textContent = key;

  const tooltip = document.createElement('div');
  tooltip.className = 'menu-tooltip';
          tooltip.textContent = value;
  document.body.appendChild(tooltip);
  
  item.addEventListener('mouseenter', (e) => {
    e.stopPropagation();
    tooltip.style.display = 'block';
    positionTooltip(item, tooltip);
  });
  
  item.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
  });
  
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    // Get the original target that triggered the menu
    const target = activeMenu.triggerElement || document.activeElement;
    
    debug('Click target:', {
      target,
      tagName: target?.tagName,
      isContentEditable: target?.isContentEditable
    });
    
    if (target) {
      const isContentEditable = target.isContentEditable || false;
      insertText(target, value, isContentEditable);
    }
    
    closeActiveMenu();
    tooltip.remove();
  });
  
  return item;
}

function closeActiveMenu() {
  if (activeMenu) {
    debug('Closing active menu');
    activeMenu.cleanup?.();
    activeMenu.remove();
    
    // Remove any orphaned tooltips
    document.querySelectorAll('.menu-tooltip').forEach(tooltip => tooltip.remove());
    
    activeMenu = null;
  }
}

function positionTooltip(item, tooltip) {
  const itemRect = item.getBoundingClientRect();
  const menuRect = activeMenu.getBoundingClientRect();
  
  // Position tooltip to the right of the menu
  let left = menuRect.right + 8;
  const top = itemRect.top;

  // Check if tooltip would go off screen to the right
  tooltip.style.display = 'block'; // Temporarily show to get dimensions
  const tooltipRect = tooltip.getBoundingClientRect();
  if (left + tooltipRect.width > window.innerWidth) {
    // Position to the left of the menu instead
    left = menuRect.left - tooltipRect.width - 8;
  }
  
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function insertText(target, text, isContentEditable) {
  try {
    if (!target) return;

    if (isContentEditable) {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      
      const range = selection.getRangeAt(0);
      const container = range.startContainer;
      
      // Special handling for TinyMCE
      const isTinyMCE = target.closest('#tinymce') || target.id === 'tinymce';
      
      let content;
      let startOffset;
      
      // Handle different node types and editors
      if (container.nodeType === Node.TEXT_NODE) {
        content = container.textContent;
        startOffset = range.startOffset;
      } else if (isTinyMCE) {
        const editableDiv = container.nodeType === Node.ELEMENT_NODE ? 
          container : 
          container.parentElement;
        
        content = editableDiv.textContent;
        startOffset = range.startOffset;
      } else {
        content = target.textContent;
        startOffset = range.startOffset;
      }

      const beforeRange = content.substring(0, startOffset);
      const shortcutIndex = beforeRange.lastIndexOf("//");

      if (shortcutIndex !== -1) {
        const beforeShortcut = content.substring(0, shortcutIndex);
        const afterShortcut = content.substring(startOffset);
        const newContent = beforeShortcut + text + afterShortcut;

        if (isTinyMCE) {
          const editableDiv = container.nodeType === Node.ELEMENT_NODE ? 
            container : 
            container.parentElement;
          
          editableDiv.textContent = newContent;
          
          const newRange = document.createRange();
          const textNode = editableDiv.firstChild || editableDiv;
          const newPosition = shortcutIndex + text.length;
          
          try {
            newRange.setStart(textNode, newPosition);
            newRange.setEnd(textNode, newPosition);
            selection.removeAllRanges();
            selection.addRange(newRange);
            editableDiv.focus();
          } catch (e) {
            console.error('Error setting cursor position:', e);
          }
        } else {
          if (container.nodeType === Node.TEXT_NODE) {
            container.textContent = newContent;
          } else {
            target.textContent = newContent;
          }

          const newRange = document.createRange();
          const textNode = container.nodeType === Node.TEXT_NODE ? 
            container : 
            target.firstChild || target;
          const newPosition = shortcutIndex + text.length;
          
          newRange.setStart(textNode, newPosition);
          newRange.setEnd(textNode, newPosition);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }
    } else {
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        const start = target.selectionStart;
        const value = target.value;
        const shortcutIndex = value.lastIndexOf("//", start);

        if (shortcutIndex !== -1) {
          const newValue = value.substring(0, shortcutIndex) + text + value.substring(start);
          target.value = newValue;
          
          const newPosition = shortcutIndex + text.length;
          target.selectionStart = newPosition;
          target.selectionEnd = newPosition;
          
          target.focus();
          
          if (target.tagName === 'TEXTAREA') {
            const lineHeight = parseInt(window.getComputedStyle(target).lineHeight);
            const lines = target.value.substr(0, newPosition).split('\n').length;
            target.scrollTop = (lines - 1) * lineHeight;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error inserting text:', error);
  }
}

function createSearchableSelect(options, placeholder = 'Search...', defaultValue = '') {
  const wrapper = document.createElement('div');
  wrapper.className = 'searchable-select';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = defaultValue || placeholder;
  input.className = 'searchable-select-input';
  
  // Add a hidden span to store the actual value
  const valueHolder = document.createElement('span');
  valueHolder.style.display = 'none';
  valueHolder.textContent = defaultValue;
  wrapper.appendChild(valueHolder);

  const dropdown = document.createElement('div');
  dropdown.className = 'searchable-select-dropdown';

  function renderOptions(searchTerm = '') {
    dropdown.innerHTML = '';
    const filteredOptions = searchTerm 
      ? options.filter(option => 
          option.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : options;

    filteredOptions.forEach(option => {
      const item = document.createElement('div');
      item.className = 'searchable-select-item';
      item.textContent = option;
      if (option === valueHolder.textContent) {
        item.classList.add('selected');
      }
      item.addEventListener('click', () => {
        valueHolder.textContent = option;
        input.value = ''; // Clear search text
        input.placeholder = option; // Show selected value as placeholder
        dropdown.style.display = 'none';
        wrapper.dispatchEvent(new CustomEvent('change', { detail: option }));
      });
      dropdown.appendChild(item);
    });

    if (filteredOptions.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'searchable-select-no-results';
      noResults.textContent = 'No matches found';
      dropdown.appendChild(noResults);
    }
  }

  input.addEventListener('focus', () => {
    input.value = ''; // Clear input when focused
    renderOptions(''); // Show all options
    dropdown.style.display = 'block';
  });

  input.addEventListener('input', (e) => {
    renderOptions(e.target.value);
    dropdown.style.display = 'block';
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      input.value = ''; // Clear search text
      input.placeholder = valueHolder.textContent || placeholder; // Restore placeholder
      dropdown.style.display = 'none';
    }, 200);
  });

  wrapper.appendChild(input);
  wrapper.appendChild(dropdown);
  
  return wrapper;
}

function showNotesPopup(target, isContentEditable) {
  const popup = document.createElement('div');
  popup.className = 'notes-popup';
  
  popup.innerHTML = `
    <div class="notes-popup-header">
      <div class="notes-popup-title">
        <span class="ax">AX</span><span class="celerate">elerate</span> <span>Templates</span>
      </div>
      <div class="notes-popup-controls">
        <button type="button" class="minimize-btn" title="Minimize">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
          </svg>
        </button>
        <button type="button" class="close-btn" title="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="notes-popup-content">
      <div class="notes-main-section">
        <div class="notes-selectors">
          <div class="notes-popup-field topic-field">
            <label>Topic</label>
            <div class="select-container"></div>
          </div>
          <div class="notes-popup-field subtopic-field">
            <label>Subtopic</label>
            <div class="select-container"></div>
          </div>
        </div>
        <div class="template-preview"></div>
      </div>

      <div class="clipboard-section">
        <h3>Clipboard history</h3>
        <div class="clipboard-items"></div>
      </div>
    </div>

    <div class="notes-popup-actions">
      <button type="button" class="cancel">Cancel</button>
      <button type="button" class="import">Import Note</button>
    </div>
  `;

  // Get container references
  const topicContainer = popup.querySelector('.topic-field .select-container');
  const subtopicContainer = popup.querySelector('.subtopic-field .select-container');
  
  // Get topics from notes object
  const topics = Object.keys(notes);
  
  // Create searchable selects
  const topicSelect = createSearchableSelect(topics, 'Search topics...', topics[0]);
  const subtopicSelect = createSearchableSelect([], 'Search subtopics...'); // Initially empty

  // Add selects to containers
  topicContainer.appendChild(topicSelect);
  subtopicContainer.appendChild(subtopicSelect);

  // Set default selection for topic (first item)
  if (topics.length > 0) {
    const defaultTopic = topics[0];
    const topicInput = topicSelect.querySelector('input');
    topicInput.value = defaultTopic;
    topicInput.setAttribute('data-value', defaultTopic);

    // Handle topic selection changes
    topicInput.addEventListener('change', (e) => {
      const selectedTopic = e.detail;
      updateSubtopicSelect(selectedTopic);
    });

    // Initial subtopic setup
    updateSubtopicSelect(defaultTopic);
  }

  function updateSubtopicSelect(topic) {
    const subtopics = Object.keys(notes[topic] || {});
    const defaultSubtopic = subtopics[0] || '';
    const newSubtopicSelect = createSearchableSelect(subtopics, 'Search subtopics...', defaultSubtopic);
    subtopicContainer.innerHTML = '';
    subtopicContainer.appendChild(newSubtopicSelect);

    // Handle subtopic selection changes
    newSubtopicSelect.addEventListener('change', (e) => {
      const selectedSubtopic = e.detail;
      if (topic && selectedSubtopic && notes[topic][selectedSubtopic]) {
        updateTemplatePreview(notes[topic][selectedSubtopic], popup);
      }
    });

    // Show initial template preview
    if (defaultSubtopic && notes[topic][defaultSubtopic]) {
      updateTemplatePreview(notes[topic][defaultSubtopic], popup);
    }
  }

  // Add clipboard functionality with auto-refresh
    const clipboardItems = popup.querySelector('.clipboard-items');
  
  function updateClipboardHistory() {
      clipboardItems.innerHTML = clipboardHistory
        .map(item => `
          <div class="clipboard-item">
            ${item.length > 50 ? item.substring(0, 50) + '...' : item}
          </div>
        `)
        .join('');

      // Add click handlers for clipboard items
      clipboardItems.querySelectorAll('.clipboard-item').forEach((item, index) => {
        item.addEventListener('click', () => {
          const textToCopy = clipboardHistory[index];
          navigator.clipboard.writeText(textToCopy).then(() => {
            item.style.backgroundColor = '#e9ecef';
            setTimeout(() => {
            item.style.backgroundColor = '';
            }, 200);
          });
        });
      });
    }

  // Initial update
  updateClipboardHistory();

  // Set up clipboard history refresh interval
  const refreshInterval = setInterval(updateClipboardHistory, 1000);

  // Clean up on close
  const cleanup = () => {
    clearInterval(refreshInterval);
    popup.remove();
  };

  // Handle close button
  popup.querySelector('.close-btn').addEventListener('click', cleanup);
  popup.querySelector('.cancel').addEventListener('click', cleanup);

  // Update copy event listener
  document.addEventListener('copy', () => {
    setTimeout(updateClipboardHistory, 100); // Small delay to ensure clipboard is updated
  });

  // Handle minimize/maximize
  const minimizeBtn = popup.querySelector('.minimize-btn');
  let isMinimized = false;

  function minimize() {
    if (!isMinimized) {
      popup.classList.add('minimized');
      isMinimized = true;
    }
  }

  function maximize() {
    if (isMinimized) {
      popup.classList.remove('minimized');
      isMinimized = false;
      popup.style.top = '50%';
      popup.style.left = '50%';
      popup.style.transform = 'translate(-50%, -50%)';
    }
  }

  minimizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isMinimized) {
      maximize();
        } else {
      minimize();
    }
  });

  // Handle click on minimized popup
  popup.addEventListener('click', (e) => {
    if (isMinimized && !e.target.closest('.close-btn')) {
      maximize();
    }
  });

  // Fix import functionality
  popup.querySelector('.import').addEventListener('click', () => {
    const selectedTopic = topicSelect.querySelector('input').placeholder; // Use placeholder as current value
    const selectedSubtopic = subtopicContainer.querySelector('input').placeholder; // Use placeholder as current value
    
    if (selectedTopic && selectedSubtopic && notes[selectedTopic]?.[selectedSubtopic]) {
      let templateText = notes[selectedTopic][selectedSubtopic].text;
      const inputs = popup.querySelectorAll('.template-preview input');
      
      inputs.forEach(input => {
        templateText = templateText.replace(
          `{${input.placeholder}}`,
          input.value || input.placeholder
        );
      });

      insertText(target, templateText, isContentEditable);
    popup.remove();
    }
  });

  // Remove any duplicate event listeners
  popup.querySelector('.minimize-btn').removeEventListener('click', () => {
    popup.classList.toggle('minimized');
  });

  // Add popup to document
  document.body.appendChild(popup);

  // Position popup in center
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';

  return popup;
}

function renderClipboardItems(container) {
  container.innerHTML = '';
  clipboardHistory.forEach(item => {
    const element = document.createElement('div');
    element.className = 'clipboard-item';
    element.textContent = item.length > 50 ? item.substring(0, 50) + '...' : item;
    
    element.addEventListener('click', () => {
      navigator.clipboard.writeText(item).then(() => {
        showCopyNotification();
      });
    });
    
    container.appendChild(element);
  });
}

function showCopyNotification() {
  const notification = document.createElement('div');
  notification.className = 'copy-notification';
  notification.textContent = 'Copied to clipboard';
  
  document.body.appendChild(notification);
  
  // Trigger animation
  setTimeout(() => notification.classList.add('show'), 10);
  
  // Remove notification after animation
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

function createField(label, element) {
  const field = document.createElement("div");
  field.className = "notes-popup-field";
  const labelElement = document.createElement("label");
  labelElement.textContent = label;
  field.appendChild(labelElement);
  field.appendChild(element);
  return field;
}

function updateSubtopics(topic, subtopicSelect, presetText) {
  subtopicSelect.innerHTML = "";

  Object.keys(notes[topic]).forEach((subtopic) => {
    const option = document.createElement("option");
    option.value = subtopic;
    option.textContent = subtopic;
    subtopicSelect.appendChild(option);
  });

  updatePresetText(topic, subtopicSelect.value, presetText);
}

function updatePresetText(topic, subtopic, presetText) {
  const note = notes[topic][subtopic];
  presetText.innerHTML = '';
  
  note.text.split(/{([^}]+)}/).forEach((part, index) => {
    if (index % 2 === 0) {
      const textNode = document.createElement('span');
      textNode.textContent = part;
      presetText.appendChild(textNode);
    } else {
      const input = document.createElement('input');
      input.placeholder = part;
      input.style.width = part.length + 2 + 'ch';  // Dynamic width based on placeholder
      input.style.backgroundColor = '#f0fdfa';     // Light teal background
      presetText.appendChild(input);
    }
  });
}

function importNote(target, topic, subtopic, popup) {
  const presetText = popup.querySelector(
    ".notes-popup-content > div:last-child"
  );
  let finalText = notes[topic][subtopic].text;

  presetText.querySelectorAll("input").forEach((input) => {
    finalText = finalText.replace(`{${input.placeholder}}`, input.value);
  });

  const value = target.value;
  const newValue = value.replace(/\/\/notes\w*$/, finalText + " ");
  target.value = newValue;
  target.selectionStart = target.selectionEnd = newValue.length;

  popup.remove();
}

function showClipboardHistory(target, isContentEditable) {
  removeExistingShortcutMenu();
  
  const menu = document.createElement('div');
  menu.className = 'clipboard-menu';
  
  // Store the original trigger element
  menu.triggerElement = target;

  // Add menu content...
  if (clipboardHistory.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'clipboard-empty';
    emptyMessage.textContent = 'No clipboard history';
    menu.appendChild(emptyMessage);
  } else {
    clipboardHistory.forEach((text) => {
      const item = document.createElement('div');
      item.className = 'clipboard-item';
      item.textContent = text.length > 50 ? text.substring(0, 50) + '...' : text;
      
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        insertText(target, text, isContentEditable);
        menu.remove();
      });
      
      menu.appendChild(item);
    });
  }

  // Position menu near cursor
  const cursorPosition = getCursorCoordinates(target, isContentEditable);
  if (cursorPosition) {
    const { x, y } = cursorPosition;
    menu.style.position = 'fixed';
    
    // Check boundaries and adjust position
    const menuWidth = 300; // Approximate menu width
    const menuHeight = Math.min(clipboardHistory.length * 40, 300); // Approximate menu height
    
    if (x + menuWidth > window.innerWidth) {
      menu.style.left = `${window.innerWidth - menuWidth - 20}px`;
    } else {
      menu.style.left = `${x}px`;
    }
    
    if (y + menuHeight > window.innerHeight) {
      menu.style.top = `${y - menuHeight - 10}px`;
    } else {
      menu.style.top = `${y + 20}px`;
    }
  }

  // Add event listeners...
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== target) {
      menu.remove();
    }
  }, { once: true });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      menu.remove();
    }
  }, { once: true });

  document.body.appendChild(menu);
  return menu;
}

// Update the copy event listener to immediately refresh clipboard history
document.addEventListener("copy", (e) => {
  const text = window.getSelection().toString().trim();
  if (text) {
    clipboardHistory = clipboardHistory.filter(item => item !== text);
    clipboardHistory.unshift(text);
    if (clipboardHistory.length > 20) {
      clipboardHistory.pop();
    }
    chrome.storage.sync.set({ clipboardHistory });

    // Update all open notes popups
    document.querySelectorAll('.notes-popup').forEach(popup => {
      const clipboardItems = popup.querySelector('.clipboard-items');
      if (clipboardItems) {
        const updateEvent = new CustomEvent('updateClipboard', { detail: clipboardHistory });
        clipboardItems.dispatchEvent(updateEvent);
      }
    });
  }
});

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

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  addInputListeners(document.body);
});

function positionMenu(menu, target) {
  const rect = target.getBoundingClientRect();
  menu.style.left = `${rect.left}px`;
  menu.style.top = `${rect.bottom}px`;
}

function isElementAtBottomOfScreen(element) {
  const rect = element.getBoundingClientRect();
  return rect.bottom > window.innerHeight - 100; // 100px threshold
}

initializeInputs();

function removeExistingShortcutMenu() {
  const existingMenu = document.querySelector(".shortcut-menu");
  if (existingMenu) {
    existingMenu.remove();
  }
}

// Add this to your event listeners setup
function setupEventListeners() {
  document.addEventListener('input', handleInput);
  
  // Observe DOM changes for new input elements
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // ELEMENT_NODE
          if (node.matches('input[type="text"], textarea, [contenteditable="true"]')) {
            node.addEventListener('input', handleInput);
          }
          node.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]')
            .forEach(el => el.addEventListener('input', handleInput));
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', setupEventListeners);

// Add a debug function
function debug(message, data = null) {
  const DEBUG = false; // Toggle this to enable/disable logging
  if (DEBUG) {
    console.log(`[Debug] ${message}`, data || '');
  }
}

function updateTemplatePreview(template, popup) {
  const templatePreview = popup.querySelector('.template-preview');
  templatePreview.innerHTML = '';

  // Split the template text and create input fields for placeholders
  template.text.split(/{([^}]+)}/).forEach((part, index) => {
    if (index % 2 === 0) {
      // Regular text
      const textNode = document.createElement('span');
      textNode.textContent = part;
      templatePreview.appendChild(textNode);
    } else {
      // Input field for placeholder
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = part;
      input.className = 'template-input';
      input.style.width = `${part.length + 2}ch`; // Dynamic width based on placeholder
      templatePreview.appendChild(input);
    }
  });
}

// Enhanced input detection
function setupInputListeners() {
  // Create a MutationObserver to watch for new elements
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Check if it's an element node
            // Check the added node itself
            if (isTextInput(node)) {
              attachInputListeners(node);
            }
            // Check children of the added node
            node.querySelectorAll('*').forEach(element => {
              if (isTextInput(element)) {
                attachInputListeners(element);
              }
            });
          }
        });
      }
    });
  });

  // Start observing the whole document
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['contenteditable']
  });

  // Initial setup for existing elements
  document.querySelectorAll('*').forEach(element => {
    if (isTextInput(element)) {
      attachInputListeners(element);
    }
  });
}

// Helper function to check if an element is a text input
function isTextInput(element) {
  return (
    element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'search') ||
    element.tagName === 'TEXTAREA' ||
    element.getAttribute('contenteditable') === 'true' ||
    element.role === 'textbox' ||
    element.getAttribute('aria-multiline') === 'true' ||
    (window.getComputedStyle(element).webkitUserModify || '').indexOf('write') > -1
  );
}

// Attach input listeners to an element
function attachInputListeners(element) {
  // Remove existing listeners to prevent duplicates
  element.removeEventListener('input', handleInput);
  element.removeEventListener('keydown', handleKeydown);
  
  // Add listeners
  element.addEventListener('input', handleInput);
  element.addEventListener('keydown', handleKeydown);
  
  // Add focus listener to handle cursor position
  element.addEventListener('focus', () => {
    lastFocusedElement = element;
  });
}

// Modified handleInput function
function handleInput(e) {
  const target = e.target;
  const value = getElementValue(target);
  const isContentEditable = isEditableElement(target);

  debug('Input event:', { value, isContentEditable });

  // Check for shortcut pattern
  const match = value.match(/\/\/(\w*)$/);
  
  if (!match) {
    closeActiveMenu();
    return;
  }

  const searchTerm = match[1].toLowerCase();
  debug('Search term:', searchTerm);

  // Handle special commands
  if (value.endsWith("//notes")) {
    closeActiveMenu();
    showNotesPopup(target, isContentEditable);
    return;
  }

  if (value.endsWith("//clipboard")) {
    closeActiveMenu();
    showClipboardHistory(target, isContentEditable);
    return;
  }

  updateOrCreateMenu(target, isContentEditable, searchTerm);
}

// Helper function to get element value
function getElementValue(element) {
  if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
    return element.textContent || element.innerText;
  }
  return element.value || '';
}

// Helper function to check if element is editable
function isEditableElement(element) {
  return element.isContentEditable || 
         element.getAttribute('contenteditable') === 'true' ||
         element.role === 'textbox' ||
         element.getAttribute('aria-multiline') === 'true' ||
         element.id === 'tinymce' ||  // Add TinyMCE check
         element.closest('#tinymce');  // Check for TinyMCE parent
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', setupInputListeners);

// Also initialize immediately in case the page is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setupInputListeners();
}

// Add this new function to get cursor coordinates
function getCursorCoordinates(element, isContentEditable) {
  if (isContentEditable) {
    const selection = window.getSelection();
    if (selection.rangeCount) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY
      };
    }
  } else {
    // For regular input elements
    if (element.selectionStart || element.selectionStart === 0) {
      // Create a dummy element to measure text
      const dummy = document.createElement('div');
      const computedStyle = window.getComputedStyle(element);
      
      // Copy styles that affect text measurement
      dummy.style.font = computedStyle.font;
      dummy.style.whiteSpace = 'pre-wrap';
      dummy.style.position = 'absolute';
      dummy.style.visibility = 'hidden';
      
      // Get text before cursor
      const textBeforeCursor = element.value.substring(0, element.selectionStart);
      dummy.textContent = textBeforeCursor;
      
      document.body.appendChild(dummy);
      const dummyRect = dummy.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      document.body.removeChild(dummy);
      
      return {
        x: elementRect.left + dummyRect.width,
        y: elementRect.top + (elementRect.height / 2)
      };
    }
  }
  
  // Fallback to element position if we can't get cursor position
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.bottom
  };
}



