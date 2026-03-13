# SMTP Error Analysis: `ENETUNREACH` in Production

This document explains why the SMTP (Email) and Twilio services are failing in your production environment (Railway) while working perfectly on your local machine, and how we are fixing it.

## 1. The Problem: IPv6 vs. IPv4

The error message you received:
`connect ENETUNREACH 2606:4700:90:0:f225:a1af:129b:4ba1:465`

### What it means:
*   **ENETUNREACH**: This stands for "Network Unreachable."
*   **2606:4700...**: This is an **IPv6** address.
*   **The Cause**: Modern versions of Node.js (version 17 and above) prefer to connect using IPv6 by default. However, many cloud environments like Railway do not have a fully configured IPv6 network route to external servers like Hostinger or Twilio. 

When your code tries to connect to `smtp.hostinger.com`, Node.js sees both an IPv4 and an IPv6 address. It tries the IPv6 one first, fails to find a route, and throws this error.

## 2. Why it works locally but not live?
*   **Local Machine**: Your home internet likely has a "dual-stack" or a local fallback that handles IPv6 resolution smoothly.
*   **Live (Railway)**: Railway servers run in a restricted cloud network where IPv6 is often not available for outgoing traffic, but Node.js still tries to use it.

## 3. The Fix Implementation

I have already pushed a fix to your GitHub. It works in three ways:

1.  **Forcing IPv4 globally**: We tell Node.js to prioritize IPv4 for ALL DNS lookups using `dns.setDefaultResultOrder('ipv4first')`.
2.  **Forcing IPv4 in Nodemailer**: We explicitly told the email transporter to only use IPv4 (`family: 4`).
3.  **Connection Timeouts**: We added 10-second timeouts so the server doesn't "hang" for 2 minutes when a connection fails.

## 4. How to resolve this right now

1.  **Check Deployment**: Go to your [Railway Dashboard](https://railway.app/dashboard). Make sure the latest build (the one I pushed 10 minutes ago) is **Successful** and **Active**.
2.  **Verify Railway Variables**:
    *   Ensure `SMTP_HOST` is `smtp.hostinger.com`.
    *   Ensure `SMTP_PORT` is `465`.
3.  **Database Check**: If your dashboard has a "Settings" page where you can type in the SMTP host, check there as well. Sometimes settings saved in the database override the `.env` file.

---
**Summary**: The issue is not your credentials. It is a network conflict. The update I pushed forces the app to use the stable IPv4 standard, which will fix the error once the build is live on Railway.
