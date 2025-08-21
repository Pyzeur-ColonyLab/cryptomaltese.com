# Diagnostic Commands for CryptoMaltese Deployment

## Server-side Checks (Run these on 195.15.241.120)

### 1. Check if services are running
```bash
# Check if Node.js API is running on port 3000
sudo netstat -tulpn | grep :3000
# OR
sudo ss -tulpn | grep :3000

# Check if Python graph service is running on port 8000
sudo netstat -tulpn | grep :8000
# OR
sudo ss -tulpn | grep :8000

# Check all listening services
sudo netstat -tulpn | grep LISTEN
```

### 2. Check process status
```bash
# Check for Node.js processes
ps aux | grep node
ps aux | grep npm

# Check for Python processes
ps aux | grep python
ps aux | grep uvicorn
ps aux | grep fastapi
```

### 3. Check service logs
```bash
# If using PM2 for Node.js
pm2 logs

# If using systemd services
sudo journalctl -u cryptomaltese-api -f
sudo journalctl -u cryptomaltese-graph -f

# Check recent system logs
sudo journalctl -n 50
```

### 4. Test local connections on server
```bash
# Test API locally on server
curl http://localhost:3000/api/health
curl http://127.0.0.1:3000/api/health

# Test graph service locally on server
curl http://localhost:8000/health
curl http://127.0.0.1:8000/health
```

### 5. Check firewall status
```bash
# Ubuntu/Debian
sudo ufw status
sudo iptables -L

# CentOS/RHEL
sudo firewall-cmd --list-all
sudo iptables -L
```

### 6. Check binding addresses
```bash
# See what address services are bound to
sudo lsof -i :3000
sudo lsof -i :8000
```

## Firewall Configuration

### If using UFW (Ubuntu):
```bash
# Allow ports
sudo ufw allow 3000
sudo ufw allow 8000
sudo ufw reload
sudo ufw status
```

### If using firewall-cmd (CentOS/RHEL):
```bash
# Allow ports
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports
```

## Service Configuration Fixes

### 1. If Node.js API is bound to localhost only:
Update your Node.js server configuration to bind to all interfaces:
```javascript
// In your main server file
app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on 0.0.0.0:3000');
});
```

### 2. If Python graph service is bound to localhost only:
Update uvicorn command or configuration:
```bash
# Instead of: uvicorn main:app --port 8000
# Use: uvicorn main:app --host 0.0.0.0 --port 8000
```

Or in your Python service startup:
```python
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
```

## Quick Service Restart Commands

### Node.js API:
```bash
# If using PM2
pm2 restart cryptomaltese-api

# If using direct node
pkill -f "node.*app.js"  # Kill existing
nohup node app.js > api.log 2>&1 &  # Restart
```

### Python Graph Service:
```bash
# If using systemd
sudo systemctl restart cryptomaltese-graph

# If using direct uvicorn
pkill -f "uvicorn.*main:app"  # Kill existing
cd /path/to/graph_service
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > graph.log 2>&1 &  # Restart
```

## Alternative Testing from Client Side

### Test with different timeouts:
```bash
# Test with longer timeout
curl --connect-timeout 30 http://195.15.241.120:3000/api/health
curl --connect-timeout 30 http://195.15.241.120:8000/health
```

### Test with telnet:
```bash
# Test if ports are reachable
telnet 195.15.241.120 3000
telnet 195.15.241.120 8000
```

### Test with nmap:
```bash
# Scan for open ports
nmap -p 3000,8000 195.15.241.120
```

## Expected Responses

### API Health Check:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "cryptomaltese-api"
}
```

### Graph Service Health Check:
```json
{
  "status": "healthy",
  "service": "graph_service",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```
