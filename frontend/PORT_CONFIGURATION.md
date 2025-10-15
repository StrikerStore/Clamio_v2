# Frontend Port Configuration

## How to Run on Different Ports

Your frontend now supports running on different ports using multiple methods:

---

## **Method 1: Using PORT Environment Variable**

Set the `PORT` variable before running the dev command:

### Windows (PowerShell):
```powershell
$env:PORT=3001; npm run dev
```

### Windows (CMD):
```cmd
set PORT=3001 && npm run dev
```

### Linux/Mac:
```bash
PORT=3001 npm run dev
```

---

## **Method 2: Using Pre-configured Scripts**

We've added convenient scripts in `package.json`:

```bash
# Run on port 3001
npm run dev:3001

# Run on port 3002
npm run dev:3002

# Run on port 3003
npm run dev:3003
```

---

## **Method 3: Direct Command Line**

You can also specify the port directly:

```bash
npm run dev -- -p 3001
npm run dev -- -p 4000
npm run dev -- -p 8080
```

---

## **Production (After Build)**

For production builds:

```bash
# Build first
npm run build

# Run with custom port
npm run start:3001
npm run start:3002

# Or with PORT variable
PORT=3001 npm start
```

---

## **Using .env.local File**

Create a `.env.local` file in the root directory:

```env
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Then just run:
```bash
npm run dev
```

---

## **Quick Reference**

| Command | Port | Description |
|---------|------|-------------|
| `npm run dev` | 3000 | Default port (or from PORT env var) |
| `npm run dev:3001` | 3001 | Pre-configured port 3001 |
| `npm run dev:3002` | 3002 | Pre-configured port 3002 |
| `npm run dev:3003` | 3003 | Pre-configured port 3003 |
| `PORT=3001 npm run dev` | 3001 | Custom port via env var |
| `npm run dev -- -p 4000` | 4000 | Any custom port |

---

## **Example: Running Multiple Instances**

To run multiple frontend instances simultaneously:

```bash
# Terminal 1 - Port 3000
npm run dev

# Terminal 2 - Port 3001
npm run dev:3001

# Terminal 3 - Port 3002
npm run dev:3002
```

Each instance will be accessible at:
- http://localhost:3000
- http://localhost:3001
- http://localhost:3002

---

## **Troubleshooting**

**Port already in use?**
```bash
# Windows: Find and kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac: Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Environment variable not working?**
- On Windows, use PowerShell (not CMD) for better env var support
- Or use the pre-configured scripts: `npm run dev:3001`

