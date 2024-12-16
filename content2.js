// Remove existing event listeners before adding new ones
function addInputListeners(element) {
  if (element.nodeType === Node.ELEMENT_NODE) {
    if (
      element.tagName === "INPUT" ||
      element.tagName === "TEXTAREA" ||
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

let shortcuts = {};
let notes = {};
let clipboardHistory = [];
let fuzzySearch = false;

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

// Listen for input events
document.addEventListener("input", handleInput);
document.addEventListener("keydown", handleKeydown);

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
  const isContentEditable = target.isContentEditable;
  const value = isContentEditable ? target.textContent : target.value;

  if (e.key === "Enter" || e.key === " " || e.key === "Tab") {
    const shortcutMatch = value.match(/\/\/(\w+)$/);
    if (shortcutMatch) {
      e.preventDefault();
      const shortcutKey = shortcutMatch[1];
      if (shortcuts[shortcutKey]) {
        replaceShortcut(target, shortcutKey, isContentEditable);
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
  const isContentEditable = target.isContentEditable;
  const value = isContentEditable ? target.textContent : target.value;

  if (value.endsWith("//")) {
    showShortcutMenu(target, isContentEditable);
  } else if (value.endsWith("//notes")) {
    showNotesPopup(target, isContentEditable);
  } else if (value.endsWith("//clipboard")) {
    showClipboardHistory(target, isContentEditable);
  }

  // Auto-expand shortcuts
  Object.entries(shortcuts).forEach(([key, expansion]) => {
    const regex = new RegExp(`\\b${key}\\b`, "g");
    if (regex.test(value)) {
      const newValue = value.replace(regex, expansion);
      if (isContentEditable) {
        target.textContent = newValue;
      } else {
        target.value = newValue;
      }
      // Set cursor position after the expanded text
      const newPosition = newValue.length;
      if (isContentEditable) {
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(target.childNodes[0], newPosition);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        target.setSelectionRange(newPosition, newPosition);
      }
    }
  });
}

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

function initializeInputs() {
  document
    .querySelectorAll('input[type="text"], textarea, [contenteditable="true"]')
    .forEach((input) => {
      input.addEventListener("input", handleInput);
      input.addEventListener("keydown", handleKeydown);
    });
}

// Update click outside handling
function addClickOutsideHandler(element, callback) {
  const handleClickOutside = (e) => {
    if (!element.contains(e.target)) {
      callback();
      document.removeEventListener("mousedown", handleClickOutside);
    }
  };
  document.addEventListener("mousedown", handleClickOutside);
}

function showShortcutMenu(target, isContentEditable) {
  const existingMenu = document.querySelector(".shortcut-menu");
  if (existingMenu) {
    existingMenu.remove();
  }
  const menu = document.createElement("div");
  menu.className = "shortcut-menu";

  const shortcutList = document.createElement("div");
  shortcutList.className = "shortcut-list";
  menu.appendChild(shortcutList);

  const tooltip = document.createElement("div");
  tooltip.className = "shortcut-tooltip";
  document.body.appendChild(tooltip);

  function renderShortcuts(filter = "") {
    shortcutList.innerHTML = "";
    Object.entries(shortcuts).forEach(([key, value]) => {
      if (
        key.toLowerCase().includes(filter.toLowerCase()) ||
        value.toLowerCase().includes(filter.toLowerCase())
      ) {
        const item = document.createElement("div");
        item.className = "shortcut-menu-item";
        item.textContent = key;

        item.addEventListener("mouseenter", () => {
          tooltip.textContent = value;
          tooltip.classList.add("visible");

          const rect = item.getBoundingClientRect();
          tooltip.style.left = `${rect.right + 8}px`;
          tooltip.style.top = `${rect.top}px`;
        });

        item.addEventListener("mouseleave", () => {
          tooltip.classList.remove("visible");
        });

        item.addEventListener("click", () => {
          replaceShortcut(target, key, isContentEditable);
          menu.remove();
          tooltip.remove();
        });

        shortcutList.appendChild(item);
      }
    });
  }

  renderShortcuts();

  // Position menu at cursor
  const cursorPos = getCursorPosition(target);
  if (cursorPos) {
    const scrollY = window.scrollY;
    menu.style.position = "absolute";
    menu.style.left = `${cursorPos.left}px`;
    menu.style.top = `${cursorPos.top + cursorPos.height + scrollY}px`;
  }

  document.body.appendChild(menu);

  // Handle click outside
  document.addEventListener(
    "mousedown",
    (e) => {
      if (!menu.contains(e.target) && e.target !== target) {
        menu.remove();
        tooltip.remove();
      }
    },
    { once: true }
  );
}
