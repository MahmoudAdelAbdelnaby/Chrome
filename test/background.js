chrome.runtime.onInstalled.addListener(() => {
	chrome.storage.sync.set({
		shortcuts: {
			w1: 'Welcome',
			ty: 'Thank you for your message',
		},
		notes: {
			'Customer Service': {
				Greeting: {
					text: 'Dear {Name},\n\nThank you for contacting {Company Name}. We appreciate your interest in our products/services.',
				},
				Closing: {
					text: 'If you have any further questions, please dont hesitate to ask.\n\nBest regards,\n{Your Name}',
				},
			},
		},
		clipboardHistory: [],
	});
});

// chrome.action.onClicked.addListener((tab) => {
// 	chrome.scripting.executeScript({
// 		target: {tabId: tab.id},
// 		function: () => {
// 			const activeElement = document.activeElement;
// 			if (
//         activeElement.tagName === 'INPUT' ||
// 				activeElement.tagName === 'TEXTAREA' ||
// 				activeElement.isContentEditable
// 			) {
// 				const value = activeElement.value;
// 				if (value.endsWith('//notes')) {
// 					chrome.runtime.sendMessage({action: 'showNotesPopup'});
// 				} else if (value.endsWith('//clipboard')) {
// 					chrome.runtime.sendMessage({action: 'showClipboardHistory'});
// 				}
// 				activeElement.addEventListener('keydown', (event) => {
// 					if (event.ctrlKey ) {
// 						// Your function to be triggered
// 						console.log("triggered");
// 						event.preventDefault(); // Prevent default browser behavior
// 					}
// 				});
// 			}
// 		},
// 	});
// });
