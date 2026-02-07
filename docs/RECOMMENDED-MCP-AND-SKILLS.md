# SCE2 - Recommended MCP Servers & Skills

Based on sequential thinking analysis of the SCE2 stack, here are the prioritized recommendations:

---

## 🎯 TIER 1: CRITICAL (Day 1)

### MCP Servers

#### 1. **@modelcontextprotocol/server-filesystem** (Built-in)
- **Purpose:** File operations for uploads, exports, logs
- **Use Cases:**
  - Reading/writing photo uploads
  - Managing document storage
  - Accessing logs for debugging
  - Generating CSV/JSON exports

#### 2. **@modelcontextprotocol/server-postgres**
- **Purpose:** Direct database access for debugging and reports
- **Use Cases:**
  - Direct SQL queries during development
  - Bulk data exports/imports
  - Performance analysis
  - Custom reports that Prisma makes complex
  - Database health checks

#### 3. **@modelcontextprotocol/server-playwright** (Already have in SCE v1)
- **Purpose:** Browser automation fallback and E2E testing
- **Use Cases:**
  - Test scraping logic when extension fails
  - Debug SCE website DOM changes
  - Screenshot capture for documentation
  - E2E workflow testing
  - Visual regression testing

### Skills

#### 4. **systematic-debugging** ⭐ MOST CRITICAL
- **When:** ANY bug, test failure, or unexpected behavior
- **Why:** Structured debugging vs. guessing
- **SCE2 Use Cases:**
  - Extension not connecting to server
  - Scraping failures on SCE website
  - Database query errors
  - Queue processing stuck
  - API endpoint returning wrong data

#### 5. **superpowers:test-driven-development**
- **When:** Writing ANY feature or bugfix
- **Why:** Catch issues early, document expected behavior
- **SCE2 Use Cases:**
  - API route handlers (easy to test, critical to get right)
  - Database queries (Prisma schema validation)
  - Helper functions (utils, formatters)
  - Extension content script logic

#### 6. **episodic-memory** ⭐ HIDDEN GEM
- **When:** Need to remember past decisions/solutions
- **Why:** Preserves wisdom across sessions
- **SCE2 Use Cases:**
  - Remember SCE website DOM changes
  - Recall scraping patterns that worked
  - Find solutions to past bugs
  - Search conversation history for "How did we handle X?"

---

## 🚀 TIER 2: HIGHLY RECOMMENDED (First Week)

### MCP Servers

#### 7. **@modelcontextprotocol/server-fetch** (Built-in)
- **Purpose:** HTTP requests for API testing
- **Use Cases:**
  - Test API endpoints without browser
  - Webhook integration testing
  - Quick API validation during dev

### Skills

#### 8. **pr-review-toolkit:silent-failure-hunter** ⭐ CRITICAL FOR SCRAPING
- **When:** Reviewing code with error handling
- **Why:** Finds inadequate error handling, swallowed exceptions
- **SCE2 Use Cases:**
  - Extension background script error handling
  - API route error responses
  - Scraping retry logic
  - Queue processing failures

#### 9. **pr-review-toolkit:code-reviewer**
- **When:** After completing feature work
- **Why:** Validates code quality before commit
- **SCE2 Use Cases:**
  - Prisma schema changes
  - TypeScript type safety
  - API endpoint design
  - Extension permission audits

#### 10. **elements-of-style:writing-clearly-and-concisely**
- **When:** Writing documentation, comments, commit messages
- **Why:** Clear communication = maintainable code
- **SCE2 Use Cases:**
  - API documentation
  - Complex scraping logic comments
  - Database migration descriptions
  - README/CLAUDE.md accuracy

#### 11. **superpowers:writing-plans**
- **When:** Before implementing multi-step features
- **Why:** Break down complex work
- **SCE2 Use Cases:**
  - "Add mobile photo upload feature"
  - "Migrate from SQLite to PostgreSQL"
  - "Implement batch PDF generation"
  - "Add retry logic to scrape queue"

---

## 🔧 TIER 3: ENHANCEMENT (First Month)

### Skills

#### 12. **claudeception**
- **Purpose:** Extract reusable knowledge from sessions
- **SCE2 Use Cases:**
  - Capture SCE website scraping patterns
  - Document common Angular Material selectors
  - Remember extension permission requirements
  - Build knowledge base of SCE quirks

#### 13. **document-skills:webapp-testing**
- **Purpose:** Test web applications with Playwright
- **SCE2 Use Cases:**
  - Mobile photo capture testing
  - Signature pad interactions
  - Geolocation simulation
  - Offline PWA testing
  - Form validation testing

#### 14. **subagent-driven-development**
- **Purpose:** Parallel work on independent tasks
- **SCE2 Use Cases:**
  - Work on cloud-server + extension simultaneously
  - Test all packages in parallel
  - Generate documentation while coding

#### 15. **@modelcontextprotocol/server-slack** (Optional)
- **Purpose:** Team notifications
- **SCE2 Use Cases:**
  - Notify when scrape jobs fail
  - Daily route completion summaries
  - Database migration alerts
  - Deployment status updates
- **Note:** Only if you have a team or want notifications

---

## 💡 TIER 4: NICE-TO-HAVE (Future)

### MCP Servers

#### 16. **Brave Search MCP**
- **Purpose:** Web search during development
- **Use Cases:**
  - Research SCE website changes
  - Find Prisma/Express solutions
  - Look up Chrome Extension API updates

### Skills

#### 17. **superpowers:finishing-a-development-branch**
- **Purpose:** Proper branch completion workflow
- **Use Cases:**
  - Feature completion checklists
  - Pre-merge validation
  - Branch cleanup

#### 18. **pre-existing-error-cleanup**
- **Purpose:** Address accumulated errors discovered during work
- **SCE2 Use Cases:**
  - Fix TypeScript errors that creep in
  - Resolve test failures
  - Clean up deprecated patterns

#### 19. **Docker MCP** (When ready for production)
- **Purpose:** Container management
- **SCE2 Use Cases:**
  - Containerize cloud-server
  - Consistent dev environments
  - Easier cloud deployment

---

## 🏗️ CUSTOM MCP TO CONSIDER BUILDING

### **@sce2/mcp-automation**

Create a custom MCP server specifically for SCE2 automation:

**Features:**
- Direct Prisma database queries via natural language
- Trigger scrape/submit jobs
- Generate custom reports (routes, properties, status)
- Query property status and history
- Integration testing commands
- Database backup/restore

**Example Usage:**
```
User: "How many properties are ready for submission?"
Claude: [Uses @sce2/mcp-automation to query database]
      "There are 23 properties with status 'VISITED' ready for submission."

User: "Start scraping for the 1909 block of Martha Ln"
Claude: [Creates properties, adds to queue, triggers extension]
```

**Benefits:**
- Conversational database access
- No need to open extension UI
- Can chain with other MCP tools
- Faster workflow automation

---

## 📊 Priority Matrix

| **MCP/Skill** | **Impact** | **Effort** | **Priority** |
|---------------|------------|------------|--------------|
| systematic-debugging | HIGH | Low | 🔥 **DO FIRST** |
| test-driven-development | HIGH | Low | 🔥 **DO FIRST** |
| episodic-memory | HIGH | Low | 🔥 **DO FIRST** |
| @mcp/postgres | HIGH | Low | 🔥 **DO FIRST** |
| silent-failure-hunter | HIGH | Low | ⚡ **Week 1** |
| code-reviewer | MEDIUM | Low | ⚡ **Week 1** |
| writing-clearly | MEDIUM | Low | ⚡ **Week 1** |
| writing-plans | HIGH | Medium | ⚡ **Week 1** |
| claudeception | MEDIUM | Low | 🔧 **Month 1** |
| webapp-testing | MEDIUM | Medium | 🔧 **Month 1** |
| @mcp/slack | LOW | Low | 💡 **Optional** |

---

## 🎓 Learning Path

### Week 1: Foundation
1. Enable **episodic-memory** immediately (search SCE v1 conversations)
2. Use **systematic-debugging** for first bug
3. Write first test with **test-driven-development**
4. Set up **@mcp/postgres** for database access

### Week 2-3: Quality
5. Run **silent-failure-hunter** on existing code
6. Use **code-reviewer** before first commit
7. Apply **writing-clearly** to documentation
8. Create **@sce2/mcp-automation** custom server

### Month 1+: Enhancement
9. Extract patterns with **claudeception**
10. Test mobile workflows with **webapp-testing**
11. Consider **Slack MCP** for notifications

---

## 🔍 Key Insight

**The most critical gap is episodic-memory.**

Your SCE v1 project has accumulated wisdom about:
- SCE website DOM structure
- Scraping patterns that work
- Common Angular Material selectors
- SCE-specific quirks and workarounds
- Extension permission gotchas

**Enable episodic-memory immediately and search your SCE v1 conversations before starting SCE2 development.** This will preserve hard-won knowledge and prevent repeating mistakes.

---

**Generated:** 2026-02-05
**Method:** Sequential thinking analysis
**Stack:** SCE2 Cloud-Hybrid Platform
