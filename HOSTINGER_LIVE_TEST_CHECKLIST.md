# Autodesk Diagnosis Platform - Hostinger Live Test Checklist

**Status:** ✅ Phase 2 Complete - Ready for Live Testing  
**Date:** 2026-09-23  
**Last Updated:** 2026-09-23  

---

## 📋 Pre-Deployment Verification ✅

All items completed and tested locally:

- [x] **Database module (db.js)** - 496 lines, 14 functions
  - Connection pooling with mysql2/promise
  - CRUD operations for all tables
  - Transaction support (BEGIN/COMMIT/ROLLBACK)
  - Graceful fallback to memory mode
  
- [x] **Server integration** - server.js updated
  - Async/await for all database endpoints
  - Database initialization at startup
  - Graceful shutdown with SIGTERM
  - Health check with database status
  
- [x] **Schema & Database** - autodesk-diagnosis-platform_schema.sql
  - 12 normalized tables with proper relationships
  - Indexes for performance
  - Views for reporting
  
- [x] **Testing** - test-api.js script
  - 10 comprehensive endpoint tests
  - Colored output for readability
  - Error handling validation
  - Sample data validation (Revit + AutoCAD, process-standardization + skill-gaps)
  
- [x] **Configuration** - .env.example template
  - All required environment variables
  - Hostinger-specific instructions
  - Fallback values defined
  
- [x] **Code Quality**
  - Named exports fixed (PRODUCTS, CHALLENGES)
  - All modules properly imported
  - Error handling comprehensive
  - Request logging enabled

---

## 🚀 Hostinger Deployment Steps

### Step 1: Create MySQL Database on Hostinger

1. Login to **Hostinger hPanel** (hosting control panel)
2. Navigate to **Databases** → **MySQL Databases**
3. Create new database:
   - **Database name:** `autodesk_diagnosis`
   - **Username:** `autodesk_user` (or your choice)
   - **Password:** Generate strong password
   - **Host:** Usually `localhost` or your Hostinger MySQL host
4. **Note the credentials:**
   - `DB_HOST=` (check Hostinger for exact host)
   - `DB_USER=` (your chosen username)
   - `DB_PASSWORD=` (your generated password)
   - `DB_NAME=autodesk_diagnosis`

### Step 2: Create .env File in Production

Create `.env` file in your Hostinger project directory:

```bash
NODE_ENV=production
PORT=8080
HOST=0.0.0.0

# Hostinger MySQL Database
DB_HOST=<your-hostinger-mysql-host>
DB_USER=<your-database-user>
DB_PASSWORD=<your-database-password>
DB_NAME=autodesk_diagnosis
```

**Do NOT commit .env to Git** (already in .gitignore)

### Step 3: Deploy Database Schema

Run the schema migration to create all tables:

```bash
# From your Hostinger SSH/terminal:
cd /home/you/autodesk-diagnosis

# Option A: If you have MySQL CLI access
mysql -h DB_HOST -u DB_USER -p DB_NAME < autodesk-diagnosis-platform_schema.sql

# Option B: If using phpMyAdmin (Hostinger usually provides this)
# - Go to phpMyAdmin in hPanel
# - Select the autodesk_diagnosis database
# - Go to "Import" tab
# - Upload autodesk-diagnosis-platform_schema.sql
# - Click "Import"
```

### Step 4: Install Dependencies

```bash
cd /home/you/autodesk-diagnosis
npm install
```

### Step 5: Start Application with PM2

```bash
# Install PM2 if not already installed
npm install -g pm2

# Start the application
pm2 start server.js --name "autodesk-diagnosis"

# Make it auto-restart on reboot
pm2 startup
pm2 save

# Check status
pm2 status
```

### Step 6: Configure Hostinger Webhook (Auto-Deploy on Push)

1. In your Hostinger hPanel → **Git**
2. Connect your GitHub repository
3. Configure webhook to redeploy when you push to main branch
4. After webhook setup, your app auto-deploys on push to GitHub

---

## ✅ Live Test Validation

Once deployed, run these tests to verify everything works:

### A. Health Check
```bash
curl https://autodesk-diagnosis.hostinger.app/health
```

Expected response:
```json
{
  "status": "Server is running",
  "timestamp": "2026-09-23T...",
  "port": 8080,
  "database_ready": true,
  "database_status": "connected"
}
```

### B. API Test Suite

Run the complete test script from your Hostinger server:

```bash
# SSH into Hostinger
# From project directory:
node test-api.js
```

Expected: All 10 tests pass with ✅ status

### C. Manual API Test (using curl)

**1. Create a diagnosis:**
```bash
curl -X POST https://autodesk-diagnosis.hostinger.app/api/diagnosis \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Your Client Name",
    "companyName": "Your Company",
    "industry": "Engineering",
    "role": "Director",
    "clientEmail": "email@company.com",
    "clientPhone": "+52-333-1234-567",
    "country": "Mexico",
    "products": ["revit", "autocad"],
    "challenges": ["process-standardization", "skill-gaps"]
  }'
```

**2. Get the diagnosis ID from response, then retrieve it:**
```bash
curl https://autodesk-diagnosis.hostinger.app/api/diagnoses/1
```

**3. List all diagnoses:**
```bash
curl https://autodesk-diagnosis.hostinger.app/api/diagnoses
```

---

## 🔍 Monitoring & Logs

### Check Application Logs

```bash
# View live logs
pm2 logs autodesk-diagnosis

# View specific number of lines
pm2 logs autodesk-diagnosis --lines 100

# Save logs to file
pm2 logs autodesk-diagnosis > app-logs.txt
```

### Monitor Resources

```bash
# Check server status
pm2 status

# Monitor in real-time
pm2 monit
```

---

## 🚨 Troubleshooting

### Issue: "Cannot connect to database"
**Solution:**
1. Verify `DB_HOST`, `DB_USER`, `DB_PASSWORD` in .env
2. Check database exists: `DB_NAME=autodesk_diagnosis`
3. Verify schema was imported: Check phpMyAdmin for tables
4. Server gracefully falls back to memory mode if DB unavailable

### Issue: "Port 8080 already in use"
**Solution:**
```bash
# Kill process on port 8080
pm2 kill
pm2 start server.js --name "autodesk-diagnosis"
```

### Issue: "Module not found errors"
**Solution:**
```bash
npm install
npm install --save express cors body-parser dotenv mysql2
```

### Issue: "Diagnosis not saving to database"
**Solution:**
1. Check: `database_status: "connected"` in `/health`
2. Check logs: `pm2 logs autodesk-diagnosis`
3. Verify schema includes all 12 tables
4. System works in memory mode while you fix database

---

## 📊 Database Verification Query

After deployment, verify schema was created correctly:

```bash
# Login to phpMyAdmin or MySQL CLI:
USE autodesk_diagnosis;
SHOW TABLES;
```

Should show 12 tables:
```
clients
diagnoses
diagnosis_products
diagnosis_challenges
recommendations
recommendation_actions
implementation_phases
phase_activities
capability_gaps
success_metrics
diagnosis_history
generated_reports
```

---

## 🎯 Expected Behavior After Live Test

✅ **Memory Mode Disabled:**
- Diagnoses persist in MySQL database
- Reload page → diagnoses still there
- Health check shows `database_ready: true`

✅ **Full CRUD Working:**
- CREATE: POST /api/diagnosis stores in DB
- READ: GET /api/diagnoses retrieves from DB
- UPDATE: Status changes persist
- DELETE: (ready for Phase 3)

✅ **Performance:**
- Diagnosis generation < 500ms
- API responses < 100ms
- No memory leaks over time

✅ **Scalability Ready:**
- Database handles multiple concurrent requests
- Connection pooling manages resources
- Logs show proper transaction handling

---

## 📝 After Successful Live Test

1. **Document findings:**
   - Note any performance metrics
   - Record response times
   - List any issues encountered

2. **Next Phase (Phase 3 - Authentication):**
   - Implement JWT login system
   - Add role-based access control
   - Secure API with authentication

3. **Update stakeholders:**
   - Share live platform URL
   - Run demo with real data
   - Gather feedback for Phase 3

---

## 📞 Support & Contact

**In case of issues:**
1. Check logs: `pm2 logs autodesk-diagnosis`
2. Review DEPLOYMENT_GUIDE.md for detailed troubleshooting
3. Verify .env file has correct credentials
4. Check Hostinger hPanel for database status
5. Contact: rj@axonid.mx

---

**Status: ✅ Ready for Live Testing**  
**All code committed:** ✅ Yes  
**Database module tested:** ✅ Yes  
**API endpoints validated:** ✅ Yes (10/10 tests passing)  
**Documentation complete:** ✅ Yes  

**Next Action:** Configure Hostinger MySQL database and run Step 1-6 above.
