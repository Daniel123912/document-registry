# Bakor Docflow MVP (WordPress)

Frontend-first plugin for document flow:
- Document creation and publish from site page
- Version history in dedicated DB table
- Employee acknowledgement per version
- Built-in report panel in the same interface

## Files
- bakor-docflow/bakor-docflow.php - plugin core
- bakor-docflow/assets/app.css - application UI style
- bakor-docflow/assets/app.js - tabs and simple UI interactions

## Install
1. Copy folder bakor-docflow into wp-content/plugins/.
2. Activate plugin Bakor Docflow MVP.
3. Assign role Bakor Responsible to users who create/publish documents.
4. Create a WordPress page and place shortcode [bakor_docflow_app].

## Usage (MVP)
1. Open page with shortcode [bakor_docflow_app].
2. Responsible user creates a draft document from the Create tab.
3. Responsible user publishes draft from Manage tab.
4. For updates, create New version with reason + new file.
5. Employees open Inbox tab and confirm acknowledgement.
6. Responsible user tracks status in Report tab.

## Current limits
- No external notifications.
- No department-based assignment yet (users only).
- No export yet.
