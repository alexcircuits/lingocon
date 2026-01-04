# Hosting Multiple Websites on One VPS

Hosting both `lingocon.com` and `noirsystems.com` on the same server is straightforward using **Nginx Virtual Hosts** and **PM2**.

## 1. Project Organization
Keep your projects separated in the `/var/www` directory:
- `/var/www/lingocon/` (Existing)
- `/var/www/noir-systems/` (New)

## 2. PM2 & Port Management
Each application must listen on a unique internal port.
- **LingoCon**: Port 3000 (Current)
- **Noir Systems**: Port 3001 (Recommended)

In your `noir-systems` project, create an `ecosystem.config.js` with a unique port:

```javascript
module.exports = {
  apps: [{
    name: 'noir-systems',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001 // Unique port
    }
  }]
};
```

## 3. Nginx Configuration
Create a new Nginx configuration for the second site:

1.  **Create the file**:
    `sudo nano /etc/nginx/sites-available/noirsystems`

2.  **Add the config**: (Change `3001` if you use a different port)
    ```nginx
    server {
        server_name noirsystems.com www.noirsystems.com;

        location / {
            proxy_pass http://localhost:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```

3.  **Enable the site**:
    `sudo ln -s /etc/nginx/sites-available/noirsystems /etc/nginx/sites-enabled/`

4.  **Test and Restart Nginx**:
    `sudo nginx -t`
    `sudo systemctl restart nginx`

## 4. SSL (HTTPS) Setup
Running Certbot will automatically detect the new server block and add SSL:
`sudo certbot --nginx -d noirsystems.com -d www.noirsystems.com`

## Summary Checklist
1. [ ] Clone Noir Systems to `/var/www/noir-systems`
2. [ ] Configure PM2 to run on port `3001`
3. [ ] Create Nginx virtual host for `noirsystems.com`
4. [ ] Run Certbot for SSL
