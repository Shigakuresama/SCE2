# Fillable Route Sheet PDFs - User Guide

## Overview

SCE2 route sheet PDFs include fillable fields (like tax forms) that you can type into on your tablet or computer.

## Field Types

### AGE Field
- **Type:** Text input
- **Format:** Number (0-150)
- **Purpose:** Customer's age
- **Validation:** Must be a valid age

### NOTES Field
- **Type:** Textarea (multi-line)
- **Format:** Text (max 500 characters)
- **Purpose:** Field observations, customer comments, work notes
- **Examples:** "Interested in insulation. Has central HVAC. Roof in good condition."

## How to Use

### Option 1: Fill PDF Before Field Visit

1. Generate route PDF
2. Open PDF in Adobe Acrobat Reader or compatible viewer
3. Click in AGE field
4. Type customer's age
5. Click in NOTES field
6. Type field notes
7. Save PDF
8. Print for reference

### Option 2: Fill PDF During Field Visit

1. Generate route PDF
2. Open on tablet at property
3. Talk to customer
4. Type age and notes directly into PDF
5. Save and continue to next property

### Option 3: Use Mobile Web (Recommended)

1. Generate route PDF (reference only)
2. At property, scan QR code
3. Fill fields in mobile web app
4. Data syncs to database automatically

## Exporting PDF Data

⚠️ **Important:** Direct PDF file import (upload and parse) is **planned but not yet implemented**.

### Current Workflow

**Primary Method - Mobile Web (Recommended):**
1. At property, scan QR code with mobile app
2. Fill fields in mobile web app
3. Data syncs to database automatically
4. No manual export needed

**Secondary Method - PDF Entry:**
1. Fill fields in PDF (Adobe Acrobat Reader, Foxit, etc.)
2. Use PDF as reference/backup document
3. **Note:** Cannot import data from filled PDF yet (planned feature)

### Planned Feature

Future version will support:
1. Upload filled PDF file to webapp
2. System extracts form field data automatically
3. Data syncs to cloud database
4. Mobile web displays updated data

**For now, use mobile web (QR codes) as your primary data entry method.**

## PDF Viewer Compatibility

| PDF Viewer | Fillable Fields | Recommended |
|------------|----------------|-------------|
| Adobe Acrobat Reader | ✅ Yes | ✅ Yes |
| Foxit Reader | ✅ Yes | ✅ Yes |
| Preview (macOS) | ❌ No | ❌ No |
| Chrome Browser | ⚠️ Partial | ⚠️ Maybe |
| Acrobat Mobile | ✅ Yes | ✅ Yes |

**Recommendation:** Use Adobe Acrobat Reader for best results.

## Tips

- **Pre-fill Data:** Customer name and phone are already filled from extraction
- **Save Often:** Save PDF frequently to avoid losing data
- **Export Daily:** Export form data at end of each day
- **Mobile Web Backup:** Always use mobile web as primary data entry
- **PDF as Reference:** Keep printed PDF as backup in case of tech failure

## Troubleshooting

**Q: Fields aren't clickable**
A: Use Adobe Acrobat Reader or other compatible PDF viewer

**Q: Can't type in field**
A: Click once to select field, then type. Some viewers require double-click.

**Q: Data not syncing to mobile web**
A: Click "Export PDF Form Data" button in webapp

**Q: Lost PDF data**
A: Data is in mobile web app (single source of truth). Re-scan QR code.
