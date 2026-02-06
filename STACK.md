# SCE2 - Final Technology Stack & Recommendations

## 🎯 Final Technology Stack

### **Backend - Cloud Server**
```
Language:         TypeScript 5.3+
Runtime:          Node.js 20+
Framework:        Express 4.18
Database ORM:     Prisma 5.9
Database:         SQLite (dev) / PostgreSQL (prod)
File Storage:     Local filesystem / S3-compatible (future)
Logging:          Winston 3.11
API Validation:   express-validator 7.0
File Uploads:     Multer 1.4

Port:             3333 (not 3000 to avoid conflicts with SCE v1)
```

### **Browser Extension**
```
Type:             Chrome Manifest V3
Language:         TypeScript 5.3+
Build:            Native TypeScript compiler (tsc)
Libraries:
  - jsPDF 2.5 (PDF generation)
  - QRCode 1.5 (QR code generation for mobile)

Permissions:
  - activeTab, scripting, storage, tabs
  - SCE website (sce.dsmcentral.com)
  - Cloud server (localhost:3333 or cloud domain)
```

### **Desktop Webapp**
```
Framework:        React 18.2
Build Tool:       Vite 5.0
Language:         TypeScript 5.3+
Routing:          react-router-dom 6.21
Maps:             Leaflet 1.9 (OpenStreetMap)
PDF:              jsPDF 2.5
Styling:          Tailwind CSS 3.4
Port:             5173 (Vite default)
```

### **Mobile Web**
```
Framework:        React 18.2
Build Tool:       Vite 5.0
Language:         TypeScript 5.3+
Styling:          Tailwind CSS 3.4 (mobile-first)
Port:             5174 (Vite default)

Features:
  - Photo capture (camera API)
  - Signature pad (canvas)
  - Geolocation
  - Offline PWA (future)
```

### **Development Tools**
```
Workspace:        npm workspaces (monorepo)
Package Manager:  npm 10+
TypeScript:       5.3 (all packages)
Linting:          ESLint 8.56
Formatting:       Prettier 3.2
Testing:          Vitest 1.2
Process Manager:  PM2 (production) / tsx watch (dev)
```

---

## 🔌 Recommended MCP Servers

### **Essential for SCE2**

#### 1. **@modelcontextprotocol/server-filesystem** (Built-in)
**Why:** File system operations for reading/writing configs, logs, exports
**Use Cases:**
- Read/write property data exports
- Access log files for debugging
- Generate route PDFs

#### 2. **@modelcontextprotocol/server-fetch** (Built-in)
**Why:** Make HTTP requests to external APIs
**Use Cases:**
- Test API endpoints during development
- Fetch address validation data
- Webhook notifications

#### 3. **@modelcontextprotocol/server-puppeteer** OR **@modelcontextprotocol/server-playwright**
**Why:** Browser automation for advanced scraping fallback
**Use Cases:**
- Debug scraping issues when extension fails
- Test SCE website form changes
- Automated screenshot capture for documentation

**Recommendation:** Use **Playwright** (you already have it in SCE v1)

### **Nice-to-Have**

#### 4. **@modelcontextprotocol/server-postgres**
**Why:** Direct database access for advanced queries
**Use Cases:**
- Generate custom reports
- Bulk data imports/exports
- Database health checks

#### 5. **@modelcontextprotocol/server-slack**
**Why:** Team notifications for automation events
**Use Cases:**
- Notify when routes complete
- Alert on scrape failures
- Daily summary reports

#### 6. **Memory MCP Server** (if available)
**Why:** Remember decisions across sessions
**Use Cases:**
- Track why certain scraping patterns were chosen
- Remember API changes to SCE website
- Store troubleshooting solutions

### **Custom MCP Server Consideration**

Create **`@sce2/mcp-automation`** for:
- Direct Prisma database access
- Trigger scrape/submit jobs via chat
- Query property status
- Generate reports

**Benefits:**
- Conversational automation control
- No need to open extension UI
- Can chain with other MCP tools

---

## 🛠️ Recommended Skills

### **For Development Workflow**

#### 1. **superpowers:writing-plans** (Essential)
**When:** Before implementing any multi-step feature
**Why:** Break down complex tasks into implementation steps
**Use Cases:**
- "Add mobile photo upload feature"
- "Migrate from SQLite to PostgreSQL"
- "Implement batch PDF generation"

#### 2. **superpowers:brainstorming** (You just used it!)
**When:** Exploring new features or architecture changes
**Why:** Collaborative design exploration
**Use Cases:**
- Design new database schemas
- Plan API endpoint changes
- Explore deployment strategies

#### 3. **superpowers:test-driven-development** (Highly Recommended)
**When:** Writing new features or bugfixes
**Why:** Catch issues early, document expected behavior
**Use Cases:**
- API endpoint testing
- Extension content script logic
- Database query validation

#### 4. **superpowers:systematic-debugging** (Essential)
**When:** ANY bug, test failure, or unexpected behavior
**Why:** Structured debugging vs. guessing
**Use Cases:**
- Extension not connecting to server
- Database query errors
- Scraping failures on SCE website

#### 5. **superpowers:verification-before-completion** (Quality Gate)
**When:** Before committing code or merging PRs
**Why:** Ensure work actually works
**Use Cases:**
- Verify API endpoints return correct data
- Test extension loads and functions
- Check database migrations apply correctly

### **For Code Quality**

#### 6. **code-reviewer** (Recommended)
**When:** After completing feature work
**Why:** Catch issues before committing
**Use Cases:**
- Review API route handlers
- Check extension background script logic
- Validate database queries

#### 7. **code-standards** (Reference)
**When:** Need guidance on code design
**Why:** SOLID principles, clean code patterns
**Use Cases:**
- Design service layer architecture
- Refactor duplicate code
- Apply YAGNI/KISS principles

### **For Documentation**

#### 8. **elements-of-style:writing-clearly-and-concisely** (Useful)
**When:** Writing documentation, commit messages, comments
**Why:** Clear communication
**Use Cases:**
- API documentation
- README files
- Code comments explaining complex logic

### **For Git Workflow**

#### 9. **commit-commands:commit-push-pr** (Time Saver)
**When:** Ready to commit and push work
**Why:** Automate commit + push + PR creation
**Use Cases:**
- Daily workflow automation
- Ensure commits follow conventions

#### 10. **git-commit-helper** (Alternative)
**When:** Need help writing descriptive commit messages
**Why:** Analyzes git diff to generate messages
**Use Cases:**
- Complex changes with multiple files
- Ensure commit history is clear

---

## 📊 Comparison: SCE (v1) vs SCE2

| **Component** | **SCE (v1)** | **SCE2** | **Improvement** |
|---------------|--------------|----------|-----------------|
| **State** | Extension storage, files | Centralized database | Single source of truth |
| **API** | Proxy server (CORS bypass only) | Full REST API | Complete CRUD + workflows |
| **Database** | None (JSON files) | SQLite/PostgreSQL + Prisma | Type-safe queries, migrations |
| **Mobile** | None | Mobile web app | Field data collection |
| **Queue** | Manual tab management | Automated queue polling | True background processing |
| **PDF** | Client-side only | Server + QR codes | Mobile bridge |
| **Deployment** | Local only | Local → Cloud (one config) | Production-ready |
| **Tech Stack** | Mixed (JS/TS) | Unified TypeScript | Type safety everywhere |
| **Monorepo** | Separate folders | npm workspaces | Shared dependencies, unified builds |
| **Testing** | Limited | Vitest + Playwright | Comprehensive test coverage |

---

## 🚀 Getting Started Workflow

### Day 1: Setup
```bash
# 1. Clone/navigate to SCE2
cd /home/sergio/Projects/SCE2

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env (default is fine for local dev)

# 4. Initialize database
cd packages/cloud-server
npm install
npm run db:push
npm run db:studio   # Optional: View database GUI

# 5. Start server
cd ../..
npm run dev:cloud
```

### Day 2: Build Extension
```bash
cd packages/extension
npm install
npm run build

# Load in Chrome
# chrome://extensions/ → Load unpacked → dist/
```

### Day 3: Webapp & Mobile
```bash
# Terminal 1: Webapp
cd packages/webapp
npm install
npm run dev

# Terminal 2: Mobile
cd packages/mobile-web
npm install
npm run dev
```

---

## 🎓 Learning Path

### If you're new to any of these technologies:

**Prisma:**
- Start: https://www.prisma.io/docs/getting-started
- Focus: Schema definition, queries, migrations

**Chrome MV3 Extensions:**
- Start: https://developer.chrome.com/docs/extensions/mv3/getstarted/
- Focus: Service workers, message passing, permissions

**Vite + React:**
- Start: https://vitejs.dev/guide/
- Focus: HMR, build process, TypeScript

**TypeScript:**
- Start: https://www.typescriptlang.org/docs/handbook/intro.html
- Focus: Type safety, interfaces, generics

---

## 🔮 Future Enhancements (Post-MVP)

### Phase 2 (3-6 months)
- [ ] Progressive Web App (PWA) for mobile offline support
- [ ] S3-compatible file storage (DigitalOcean Spaces)
- [ ] Real-time updates (WebSocket/Server-Sent Events)
- [ ] Advanced analytics dashboard
- [ ] Bulk CSV import/export

### Phase 3 (6-12 months)
- [ ] Multi-user support with authentication
- [ ] Role-based access control
- [ ] Mobile native apps (React Native)
- [ ] AI-powered address validation
- [ ] Automated route optimization

---

## 📞 Support & Resources

- **SCE v1 Reference:** `/home/sergio/Projects/SCE/`
- **SCE2 Current:** `/home/sergio/Projects/SCE2/`
- **Prisma Docs:** https://www.prisma.io/docs
- **Chrome Extensions:** https://developer.chrome.com/docs/extensions/
- **Vite:** https://vitejs.dev/

---

**Generated:** 2026-02-05
**Version:** 1.0.0
**Status:** Ready for Development 🚀
