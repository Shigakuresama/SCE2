This is the **Master Implementation Plan (v3.0)** for the **SCE Rebate Automation System**.

This plan reconstructs your current fragmented toolset into a unified **Cloud-Hybrid Platform**. It specifically addresses your "Financial Button" scraping requirement, the "Mobile Data Entry" workflow, and the "Auto-Upload" organization.

### **System Architecture: The "Cloud Loop"**

1. **Cloud Brain (DigitalOcean):** The central database and file host.
2. **Webapp (Desktop):** Route planning and PDF generation.
3. **Extension (Desktop):** The "Scraper" (Pre-field) and "Submitter" (Post-field).
4. **Mobile Web (Field):** Data entry and photo capture.

---

### **Part 1: The Cloud Server (`sce-cloud-server`)**

**Status:** **NEW PROJECT**
**Role:** Replaces `sce-proxy-server`. Stores route data, photos, and serves the mobile page.

#### **1.1 Database Schema (SQLite)**

We need a `database.sqlite` file to track the state of every house.

```sql
CREATE TABLE properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address_full TEXT,       -- "1909 W Martha Ln..."
    street_number TEXT,      -- "1909" (For SCE search)
    street_name TEXT,        -- "W Martha Ln" (For SCE search)
    zip_code TEXT,           -- "92706"
    
    -- Scraped Data (From Prep Phase)
    customer_name TEXT,
    customer_phone TEXT,
    
    -- Field Data (From Mobile Phase)
    customer_age INTEGER,
    field_notes TEXT,
    
    -- Status Workflow
    status TEXT DEFAULT 'pending_scrape' -- pending_scrape -> ready_for_field -> visited -> ready_for_submission -> complete
);

CREATE TABLE documents (
    id INTEGER PRIMARY KEY,
    property_id INTEGER,
    doc_type TEXT,          -- 'bill', 'unit', 'signature'
    file_path TEXT,
    FOREIGN KEY(property_id) REFERENCES properties(id)
);

```

#### **1.2 API Endpoints (`server.js`)**

```javascript
const express = require('express');
const db = require('./database'); // Wrapper for sqlite3
const upload = require('./upload-middleware'); // Multer config

const app = express();

// 1. PREP: Register addresses from Webapp
app.post('/api/route/batch', (req, res) => {
    const { addresses } = req.body; 
    // Inserts addresses -> returns IDs [101, 102...]
    const ids = db.insertBatch(addresses); 
    res.json({ ids });
});

// 2. SCRAPER: Get next address to scrape
app.get('/api/queue/scrape', (req, res) => {
    const job = db.getOne({ status: 'pending_scrape' });
    res.json(job);
});

// 3. SCRAPER: Save scraped data (Name/Phone)
app.post('/api/properties/:id/scraped', (req, res) => {
    const { name, phone } = req.body;
    db.update(req.params.id, { 
        customer_name: name, 
        customer_phone: phone, 
        status: 'ready_for_field' 
    });
    res.json({ success: true });
});

// 4. MOBILE: Serve the Field UI
app.get('/mobile/:id', (req, res) => {
    const prop = db.getById(req.params.id);
    res.render('mobile-view', { prop }); // Serve HTML with Name/Phone pre-filled
});

// 5. MOBILE: Handle Field Uploads & Data
app.post('/api/properties/:id/field-data', upload.any(), (req, res) => {
    const { age, notes } = req.body;
    // Save text data
    db.update(req.params.id, { 
        customer_age: age, 
        field_notes: notes,
        status: 'visited' 
    });
    // Save files (handled by multer middleware)
    res.json({ success: true });
});

// 6. SUBMITTER: Get ready jobs (Photos + Data)
app.get('/api/queue/submit', (req, res) => {
    // Returns Property Data + Links to all uploaded files
    const job = db.getFullJob({ status: 'visited' }); 
    res.json(job);
});

```

---

### **Part 2: The Extension (`sce-extension`)**

**Status:** **HEAVY REFACTOR**
**Role:** Absorb Tampermonkey logic, handle Scraping and File Injection.

#### **2.1 `manifest.json` Updates**

Add permissions to control tabs and access your cloud server.

```json
{
  "manifest_version": 3,
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": [
    "https://sce.dsmcentral.com/*",
    "http://YOUR_DIGITALOCEAN_IP/*"
  ],
  "background": { "service_worker": "background.js" }
}

```

#### **2.2 The "Scraper" Logic (`scraper.js`)**

This script runs when the extension pulls a "Scrape Job".

```javascript
async function performScrape(addressData) {
    // 1. Fill Address/Zip
    setInputValue('input[name="streetNum"]', addressData.street_number);
    setInputValue('input[name="streetName"]', addressData.street_name);
    setInputValue('input[name="zip"]', addressData.zip_code);
    
    // 2. Click Search
    document.querySelector('button.search-btn').click();
    
    // 3. WAIT for the "Financial" or Program Button
    await waitForElement('.program-selection-button');
    
    // 4. Click the FIRST Program Button (e.g., "Financial Income")
    // This triggers the loading of customer data
    document.querySelectorAll('.program-selection-button')[0].click();
    
    // 5. SMART WAIT: Watch for Name Field to populate
    // Replaces sleep(2000) with an observer
    const name = await waitForTextContent('.customer-name-label');
    const phone = document.querySelector('.customer-phone-label').innerText;
    
    // 6. Send back to Cloud
    await fetch(`http://CLOUD_IP/api/properties/${addressData.id}/scraped`, {
        method: 'POST',
        body: JSON.stringify({ name, phone })
    });
}

```

#### **2.3 The "Submitter" Logic (`injector.js`)**

This script runs when the extension pulls a "Submit Job" (Post-field work).

```javascript
async function injectFieldData(jobData) {
    // 1. Fill Standard Fields
    fillField('age', jobData.customer_age);
    fillField('notes', jobData.field_notes);
    
    // 2. NAVIGATE TO UPLOAD TAB
    // ... navigation logic ...
    
    // 3. FILE INJECTION MAGIC
    // Fetch the images from your Cloud Server as Blobs
    const files = await Promise.all(jobData.files.map(async (f) => {
        const blob = await fetch(f.url).then(r => r.blob());
        return new File([blob], f.name, { type: 'image/jpeg' });
    }));
    
    // 4. Drop into SCE Input
    const input = document.querySelector('input[type="file"]');
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    input.files = dataTransfer.files;
    
    // 5. Trigger Angular Change Event
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

```

---

### **Part 3: The Webapp (`sce-webapp`)**

**Status:** **UI UPDATE**
**Role:** Plan -> Request Scrape -> Review -> Print PDF.

#### **3.1 Workflow Update**

1. **Select Map Area:** (Existing functionality).
2. **Button:** Change "Generate PDF" to **"Queue for Scraping"**.
* Sends list to `POST /api/route/batch`.


3. **Review Dashboard:**
* A new modal that polls the Cloud DB.
* Shows: *1909 W Martha | John Doe | 555-0199 | [Ready]*
* You can delete "Bad" scrapes (e.g., no name found) before printing.


4. **Button:** **"Print Route Sheet"**.
* Generates PDF using the *Cloud Data* (so Name/Phone are printed).
* Embeds QR Code: `http://CLOUD_IP/mobile/{id}`.



#### **3.2 `pdf-generator.js` Updates**

Use the reference to update the `_drawCell` method:

```javascript
_drawCell(doc, x, y, address, data) {
    // Print Scraped Name/Phone
    doc.text(`Name: ${data.customer_name}`, x, y + 10);
    doc.text(`Phone: ${data.customer_phone}`, x, y + 20);
    
    // Draw Fillable "Age" Box (Visual backup)
    doc.rect(x, y + 30, 20, 10); 
    doc.text("Age", x, y + 28);
    
    // Draw QR Code (The Bridge to Mobile)
    const qrUrl = `http://CLOUD_IP/mobile/${data.id}`;
    doc.addImage(qr(qrUrl), 'PNG', x + 50, y, 20, 20);
}

```

---

### **Part 4: The Mobile Web (Field Interface)**

**Status:** **NEW**
**Role:** Simple HTML page served by Cloud Server.

**URL:** `http://CLOUD_IP/mobile/101`

**HTML Structure:**

```html
<h1>1909 W Martha Ln</h1>
<div class="info-card">
  <p><strong>Owner:</strong> John Doe</p> <p><strong>Phone:</strong> 555-0199</p> </div>

<form id="field-form">
  <label>Age:</label>
  <input type="number" name="age" placeholder="e.g. 45">
  
  <label>Notes:</label>
  <textarea name="notes" placeholder="Gate code, dog, etc."></textarea>
  
  <button type="button" onclick="capture('bill')">📸 Snap Bill</button>
  <button type="button" onclick="capture('unit')">📸 Snap Unit</button>
  
  <canvas id="sig-pad"></canvas>
  
  <button type="submit">Save & Mark Ready</button>
</form>

```

---

### **Execution Checklist**

1. **Cloud Server:**
* [ ] Buy DigitalOcean Droplet ($4/mo).
* [ ] Install Node.js, PM2 (process manager), Nginx (web server).
* [ ] Deploy `sce-cloud-server` code.


2. **Extension:**
* [ ] Port `SCE-AutoFill.user.js` logic into `content.js`.
* [ ] Implement the `MutationObserver` waiter (no more sleep!).
* [ ] Add the "Scrape" and "Submit" polling logic to `background.js`.


3. **Webapp:**
* [ ] Update `app.js` to talk to Cloud API instead of local logic.
* [ ] Update `pdf-generator.js` to render the scraped data fields.



### **The Resulting Workflow**

1. **Home:** Draw box on map -> Click "Scrape". Extension runs in background, finding names/phones.
2. **Home:** Review list -> Print PDF.
3. **Field:** Scan QR. Phone shows "John Doe". You type "Age: 50". You snap photo. You get signature.
4. **Home:** Click "Process". Extension fills form, types "Age: 50", uploads photo, uploads signature. **Done.**
