# Chrome Extensions (EAG-V3)

Youtube Demo link: https://youtu.be/bWzRWP4mrA0

This repository contains Chrome extensions developed as part of the **EAG-V3** initiative.

Currently included:
- `wellbeing-tracker`: a digital wellbeing extension focused on healthy browser usage habits.

## Wellbeing Tracker Overview

`wellbeing-tracker` helps users build healthier browsing behavior by tracking activity and surfacing insights through a simple UI.

## Features

The `wellbeing-tracker` extension provides:
- **Activity dashboards (daily & weekly)**: category-based summaries and trends with both daily and weekly views.
- **Focus Mode**: add distracting websites to a focus/block list; when enabled, those sites are prevented from opening to help maintain concentration.
- **Dark / Light theme toggle**: switch the popup and options UI between dark and light modes.
- **Alert options for category limits**: set daily time limits per category and receive gentle reminders when approaching or exceeding those limits in an alert window.
- **Popup dashboard** for quick visibility into current metrics and progress toward limits.
- **Options page** to configure categories, focus list, themes, limits, and reminder preferences.
- **Visual charts** for activity trends and summaries.
- **Background processing** to capture and persist browsing activity while Chrome runs.

## Installation Guide (Developer Mode)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select the folder:
	 - `wellbeing-tracker/`
5. The extension will be loaded and available in your Chrome toolbar.

To test changes:
1. Update the source files.
2. Return to `chrome://extensions`.
3. Click **Reload** on the `wellbeing-tracker` extension card.

## Project Structure

```text
chrome-extensions/
	README.md
	wellbeing-tracker/
		background.js      # Background service logic
		chart.js           # Chart rendering/helpers
		manifest.json      # Extension manifest and permissions
		options.css        # Styles for options page
		options.html       # Options page UI
		options.js         # Options page behavior
		popup.css          # Styles for popup UI
		popup.html         # Popup page UI
		popup.js           # Popup interactions and data rendering
		icons/             # Extension icons
```

## License

This collection is open-source and free to use.
