let shortcuts = {};
let notes = {};
let clipboardHistory = [];
let fuzzySearch = false;

// Load data from storage
chrome.storage.sync.get(
	['shortcuts', 'notes', 'clipboardHistory', 'fuzzySearch'],
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
		if (mutation.type === 'childList') {
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
			element.tagName === 'INPUT' ||
			element.tagName === 'TEXTAREA' ||
			element.isContentEditable
		) {
			// Remove existing listeners
			element.removeEventListener('input', handleInput);
			element.removeEventListener('keydown', handleKeydown);

			// Add new listeners
			element.addEventListener('input', handleInput);
			element.addEventListener('keydown', handleKeydown);
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
		input.addEventListener('input', handleInput);
	});

	// Handle contenteditable elements
	document.querySelectorAll('[contenteditable="true"]').forEach((editable) => {
		editable.addEventListener('input', handleInput);
	});

	// Handle iframes
	document.querySelectorAll('iframe').forEach((iframe) => {
		try {
			if (iframe.contentDocument) {
				const iframeInputs = iframe.contentDocument.querySelectorAll(
					'input[type="text"], textarea, [contenteditable="true"]'
				);
				iframeInputs.forEach((input) => {
					input.addEventListener('input', handleInput);
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
document.addEventListener('keydown', (e) => {
	if (e.key === 'Enter') {
		const activeMenu = document.querySelector('.shortcut-menu');
		if (activeMenu) {
			const activeItem = activeMenu.querySelector('.shortcut-menu-item.active');
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

	if (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab') {
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
		const span = document.createElement('span');
		const text = element.value.substring(0, element.selectionStart);
		span.textContent = text;
		span.style.opacity = '0';
		span.style.position = 'absolute';
		span.style.whiteSpace = 'pre';
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

	if (value.endsWith('//')) {
		showShortcutMenu(target, isContentEditable);
	} else if (value.endsWith('//notes')) {
		showNotesPopup(target, isContentEditable);
	} else if (value.endsWith('//clipboard')) {
		showClipboardHistory(target, isContentEditable);
	}

	// Auto-expand shortcuts
	Object.entries(shortcuts).forEach(([key, expansion]) => {
		const regex = new RegExp(`\\b${key}\\b`, 'g');
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

// Update click outside handling
function addClickOutsideHandler(element, callback) {
	const handleClickOutside = (e) => {
		if (!element.contains(e.target)) {
			callback();
			document.removeEventListener('mousedown', handleClickOutside);
		}
	};
	document.addEventListener('mousedown', handleClickOutside);
}

function showShortcutMenu(target, isContentEditable) {
	removeExistingShortcutMenu();
	const menu = document.createElement('div');
	menu.className = 'shortcut-menu';

	function renderShortcuts(filter = '') {
		menu.innerHTML = '';
		Object.entries(shortcuts).forEach(([key, value]) => {
			if (
				key.toLowerCase().includes(filter.toLowerCase()) ||
				value.toLowerCase().includes(filter.toLowerCase())
			) {
				const item = document.createElement('div');
				item.className = 'shortcut-menu-item';
				item.textContent = key;

				const tooltip = document.createElement('div');
				tooltip.className = 'shortcut-tooltip';
				item.appendChild(tooltip);

				item.addEventListener('mouseenter', () => {
					tooltip.textContent = value;
					tooltip.classList.add('visible');
				});

				item.addEventListener('mouseleave', () => {
					tooltip.classList.remove('visible');
				});

				item.addEventListener('click', () => {
					replaceShortcut(target, key, isContentEditable);
					menu.remove();
					// tooltip.remove();
				});

				menu.appendChild(item);
			}
		});
	}

	renderShortcuts();

	// Position menu at cursor
	const cursorPos = getCursorPosition(target);
	if (cursorPos) {
		const scrollY = window.scrollY;
		menu.style.position = 'absolute';
		menu.style.left = `${cursorPos.left}px`;
		menu.style.top = `${cursorPos.top + cursorPos.height + scrollY}px`;
	}

	document.body.appendChild(menu);
	// searchInput.focus();

	// Handle click outside
	document.addEventListener(
		'click',
		(e) => {
			if (!menu.contains(e.target) && e.target !== target) {
				menu.remove();
				// tooltip.remove();
			}
		},
		{once: true}
	);
}

function replaceShortcut(target, key, isContentEditable) {
	const replacementText = shortcuts[key] + ' ';

	if (isContentEditable) {
		const selection = window.getSelection();
		const range = selection.getRangeAt(0);
		const content = target.textContent;
		const shortcutIndex = content.lastIndexOf('//');

		if (shortcutIndex !== -1) {
			const beforeShortcut = content.substring(0, shortcutIndex);
			const afterShortcut = content
				.substring(shortcutIndex)
				.replace(/\/\/\w*/, '');

			target.textContent = beforeShortcut + replacementText + afterShortcut;

			// Set cursor position after the replacement
			const newRange = document.createRange();
			const textNode = target.firstChild || target;
			const newPosition = shortcutIndex + replacementText.length;
			newRange.setStart(textNode, newPosition);
			newRange.setEnd(textNode, newPosition);
			selection.removeAllRanges();
			selection.addRange(newRange);
		}
	} else {
		const start = target.selectionStart;
		const value = target.value;
		const shortcutIndex = value.lastIndexOf('//', start);

		if (shortcutIndex !== -1) {
			const beforeShortcut = value.substring(0, shortcutIndex);
			const afterShortcut = value.substring(start);
			const newValue = beforeShortcut + replacementText + afterShortcut;

			target.value = newValue;
			const newPosition = shortcutIndex + replacementText.length;
			target.setSelectionRange(newPosition, newPosition);
		}
	}

	// Ensure the target maintains focus
	target.focus();
}

function showNotesPopup(target, isContentEditable) {
	const popup = document.createElement('div');
	popup.className = 'notes-popup';

	const header = document.createElement('div');
	header.className = 'notes-popup-header';
	header.innerHTML = '<h2>Select Note</h2>';
	popup.appendChild(header);

	const content = document.createElement('div');
	content.className = 'notes-popup-content';

	const topicSelect = document.createElement('select');
	const subtopicSelect = document.createElement('select');
	const presetText = document.createElement('div');
	const importBtn = document.createElement('button');
	importBtn.textContent = 'Import';
	importBtn.className = 'btn-primary';

	content.appendChild(createField('Topic', topicSelect));
	content.appendChild(createField('Subtopic', subtopicSelect));
	content.appendChild(presetText);

	const actions = document.createElement('div');
	actions.className = 'notes-popup-actions';
	actions.appendChild(importBtn);

	popup.appendChild(content);
	popup.appendChild(actions);

	Object.keys(notes).forEach((topic) => {
		const option = document.createElement('option');
		option.value = topic;
		option.textContent = topic;
		topicSelect.appendChild(option);
	});

	topicSelect.addEventListener('change', () =>
		updateSubtopics(topicSelect.value, subtopicSelect, presetText)
	);
	subtopicSelect.addEventListener('change', () =>
		updatePresetText(topicSelect.value, subtopicSelect.value, presetText)
	);
	importBtn.addEventListener('click', () =>
		importNote(target, topicSelect.value, subtopicSelect.value, popup)
	);

	document.body.appendChild(popup);

	updateSubtopics(topicSelect.value, subtopicSelect, presetText);

	// Add click outside handling
	addClickOutsideHandler(popup, () => popup.remove());
}

function createField(label, element) {
	const field = document.createElement('div');
	field.className = 'notes-popup-field';
	const labelElement = document.createElement('label');
	labelElement.textContent = label;
	field.appendChild(labelElement);
	field.appendChild(element);
	return field;
}

function updateSubtopics(topic, subtopicSelect, presetText) {
	subtopicSelect.innerHTML = '';

	Object.keys(notes[topic]).forEach((subtopic) => {
		const option = document.createElement('option');
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
			presetText.appendChild(document.createTextNode(part));
		} else {
			const input = document.createElement('input');
			input.placeholder = part;
			presetText.appendChild(input);
		}
	});
}

function importNote(target, topic, subtopic, popup) {
	const presetText = popup.querySelector(
		'.notes-popup-content > div:last-child'
	);
	let finalText = notes[topic][subtopic].text;

	presetText.querySelectorAll('input').forEach((input) => {
		finalText = finalText.replace(`{${input.placeholder}}`, input.value);
	});

	const value = target.value;
	const newValue = value.replace(/\/\/notes\w*$/, finalText + ' ');
	target.value = newValue;
	target.selectionStart = target.selectionEnd = newValue.length;

	popup.remove();
}

function showClipboardHistory(target, isContentEditable) {
	const menu = document.createElement('div');
	menu.className = 'shortcut-menu';

	clipboardHistory.forEach((item) => {
		const truncatedItem =
			item.length > 30 ? item.substring(0, 30) + '...' : item;
		const element = document.createElement('div');
		element.className = 'shortcut-menu-item';
		element.textContent = truncatedItem;
		element.addEventListener('click', () => {
			const value = target.value;
			const newValue = value.replace(/\/\/clipboard\w*$/, item + ' ');
			target.value = newValue;
			target.selectionStart = target.selectionEnd = newValue.length;
			menu.remove();
		});
		menu.appendChild(element);
	});

	const rect = target.getBoundingClientRect();
	menu.style.left = `${rect.left}px`;
	menu.style.top = `${rect.bottom}px`;

	document.body.appendChild(menu);

	document.addEventListener(
		'click',
		(e) => {
			if (!menu.contains(e.target) && e.target !== target) {
				menu.remove();
			}
		},
		{once: true}
	);

	// Add click outside handling
	addClickOutsideHandler(menu, () => menu.remove());
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

// Listen for copy events to update clipboard history
document.addEventListener('copy', (e) => {
	const text = window.getSelection().toString();
	if (text) {
		clipboardHistory.unshift(text);
		if (clipboardHistory.length > 20) {
			clipboardHistory.pop();
		}
		chrome.storage.sync.set({clipboardHistory});
	}
});

// Initialize on page load

// // Re-initialize on dynamic content changes
// document.addEventListener('DOMContentLoaded', () => {
// 	// Remove any existing listeners first
// 	document.removeEventListener('input', handleInput);
// 	document.removeEventListener('keydown', handleKeydown);

// 	// Add listeners to document
// 	document.addEventListener('input', handleInput);
// 	document.addEventListener('keydown', handleKeydown);

// 	// Initialize input elements
// 	addInputListeners(document.body);
// });

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
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
	const existingMenu = document.querySelector('.shortcut-menu');
	if (existingMenu) {
		existingMenu.remove();
	}
}
