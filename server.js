const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:test@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Store subscriptions (in production, use a database)
let subscriptions = [];

// Routes
app.get('/vapid-public-key', (req, res) => {
  res.json({
    publicKey: process.env.VAPID_PUBLIC_KEY
  });
});

app.post('/subscribe', (req, res) => {
  const subscription = req.body;
  
  // Store subscription (replace with database in production)
  subscriptions.push(subscription);
  
  console.log('New subscription:', subscription.endpoint);
  res.status(201).json({ message: 'Subscription saved' });
});

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  
  // Remove subscription
  subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
  
  console.log('Unsubscribed:', endpoint);
  res.json({ message: 'Unsubscribed successfully' });
});

app.post('/send-notification', async (req, res) => {
  const { title, body, icon, badge, data } = req.body;
  
  const payload = JSON.stringify({
    title: title || 'Time Diet',
    body: body || 'Time block notification',
    icon: icon || '/pwa-192x192.png',
    badge: badge || '/pwa-192x192.png',
    data: data || {}
  });

  console.log(`Sending notification to ${subscriptions.length} subscribers:`, { title, body });

  const promises = subscriptions.map(subscription => {
    return webpush.sendNotification(subscription, payload)
      .catch(error => {
        console.error('Error sending notification:', error);
        // Remove invalid subscriptions
        if (error.statusCode === 410) {
          subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
        }
      });
  });

  try {
    await Promise.all(promises);
    res.json({ 
      message: 'Notifications sent successfully',
      sentTo: subscriptions.length
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// Schedule notification endpoint (for Time Diet integration)
app.post('/schedule-notification', async (req, res) => {
  const { title, body, scheduledTime, blockId } = req.body;
  
  const now = new Date();
  const scheduleDate = new Date(scheduledTime);
  const delay = scheduleDate.getTime() - now.getTime();
  
  if (delay <= 0) {
    return res.status(400).json({ error: 'Scheduled time must be in the future' });
  }
  
  // Schedule the notification
  setTimeout(async () => {
    const payload = JSON.stringify({
      title: title || 'Time Diet Reminder',
      body: body || 'Time to start your next block!',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { blockId, type: 'time-block' }
    });
    
    const promises = subscriptions.map(subscription => {
      return webpush.sendNotification(subscription, payload)
        .catch(error => {
          console.error('Error sending scheduled notification:', error);
          if (error.statusCode === 410) {
            subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
          }
        });
    });
    
    await Promise.all(promises);
    console.log(`Scheduled notification sent: ${title}`);
  }, delay);
  
  res.json({ 
    message: 'Notification scheduled successfully',
    scheduledFor: scheduleDate.toISOString(),
    delay: `${Math.round(delay / 1000)} seconds`
  });
});

app.get('/subscriptions', (req, res) => {
  res.json({
    count: subscriptions.length,
    subscriptions: subscriptions.map(sub => ({
      endpoint: sub.endpoint,
      // Don't expose keys for security
    }))
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Push notification server running on port ${PORT}`);
  console.log(`📱 VAPID Public Key: ${process.env.VAPID_PUBLIC_KEY}`);
});
