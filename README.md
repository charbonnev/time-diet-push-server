# Time Diet Push Server

A Node.js Express server for handling Web Push Notifications for the Time Diet PWA.

## Features

- 🔔 **Web Push Notifications** - Send notifications to PWA users even when app is closed
- 🔐 **VAPID Authentication** - Secure push notification delivery
- ⏰ **Scheduled Notifications** - Schedule notifications for future delivery
- 📱 **Cross-Platform** - Works on desktop and mobile browsers
- 🔄 **Subscription Management** - Handle user subscriptions and unsubscriptions

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the example environment file and update with your values:

```bash
cp .env.example .env
```

Update `.env` with:
- Your VAPID keys (generate with `npx web-push generate-vapid-keys`)
- Your email address
- Server port (default: 3001)

### 3. Run the Server

```bash
# Development
npm run dev

# Production
npm start
```

The server will start on `http://localhost:3001`

## API Endpoints

### Get VAPID Public Key
```
GET /vapid-public-key
```
Returns the public VAPID key for client-side subscription.

### Subscribe to Notifications
```
POST /subscribe
Content-Type: application/json

{
  "endpoint": "https://...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

### Send Immediate Notification
```
POST /send-notification
Content-Type: application/json

{
  "title": "Notification Title",
  "body": "Notification body text",
  "icon": "/icon.png",
  "data": { "custom": "data" }
}
```

### Schedule Future Notification
```
POST /schedule-notification
Content-Type: application/json

{
  "title": "Scheduled Notification",
  "body": "This will be sent later",
  "scheduledTime": "2024-01-01T12:00:00Z",
  "blockId": "optional-block-id"
}
```

### Unsubscribe
```
POST /unsubscribe
Content-Type: application/json

{
  "endpoint": "https://..."
}
```

### Get Subscription Count
```
GET /subscriptions
```

## Integration with Time Diet PWA

This server is designed to work with the Time Diet PWA frontend. The frontend uses the `PushNotificationManager` utility to:

1. Subscribe users to push notifications
2. Send scheduled notifications for time blocks
3. Handle notification clicks and actions

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VAPID_PUBLIC_KEY` | VAPID public key for push authentication | Yes |
| `VAPID_PRIVATE_KEY` | VAPID private key for push authentication | Yes |
| `VAPID_EMAIL` | Contact email (mailto: format) | Yes |
| `PORT` | Server port (default: 3001) | No |

## Security Notes

- Never commit your `.env` file to version control
- VAPID keys should be kept secure and not exposed to clients (except public key)
- In production, use a proper database instead of in-memory storage
- Consider rate limiting for production deployments

## Production Deployment

For production deployment, consider:

1. **Database**: Replace in-memory subscription storage with Redis/PostgreSQL
2. **Rate Limiting**: Add rate limiting middleware
3. **HTTPS**: Ensure server runs on HTTPS
4. **Environment**: Use proper environment variable management
5. **Monitoring**: Add logging and monitoring
6. **Scaling**: Consider horizontal scaling for high traffic

## Related Projects

- [Time Diet PWA](https://github.com/charbonnev/time-diet) - The main PWA application

## License

MIT License - see the Time Diet PWA repository for details.
