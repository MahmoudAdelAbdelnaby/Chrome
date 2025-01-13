chrome.runtime.onInstalled.addListener(() => {
	chrome.storage.sync.set({
		shortcuts: {
			"Empathy Statements": {
				"//sorry": "I completely understand your frustration, and I sincerely apologize for this experience.",
				"//hear": "I hear how challenging this has been for you.",
				"//appreciate": "I really appreciate your patience while we work through this.",
				"//understand": "I understand how frustrating this situation must be."
			},
			"Greetings": {
				"//hi": "Hello! Thank you for contacting us today. How may I assist you?",
				"//welcome": "Welcome back! How can I help you today?",
				"//morning": "Good morning! Thank you for reaching out. How can I assist you?"
			},
			"Closing Statements": {
				"//close": "Is there anything else I can help you with today?",
				"//bye": "Thank you for contacting us today. Have a great rest of your day!",
				"//follow": "I'll follow up with you as soon as I have an update."
			},
			"Positive Updates": {
				"//good": "I have some good news to share with you!",
				"//resolved": "I'm pleased to inform you that we've resolved the issue.",
				"//confirm": "I can confirm that your request has been processed successfully."
			},
			"Common Phrases": {
				"//checking": "Let me check that for you right away.",
				"//moment": "Could you give me a moment to review this?",
				"//help": "I'll be happy to help you with that."
			}
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
