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

// Store subscriptions and scheduled notifications (in production, use a database)
let subscriptions = [];
let scheduledNotifications = new Map(); // Map of timeoutId -> notification details

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

  const promises = subscriptions.map((subscription, index) => {
    console.log(`Sending to subscription ${index + 1}/${subscriptions.length}`);
    return webpush.sendNotification(subscription, payload)
      .then(() => {
        console.log(`✓ Notification sent successfully to subscription ${index + 1}`);
        return { success: true, subscription };
      })
      .catch(error => {
        console.error(`✗ Failed to send to subscription ${index + 1}:`, error.message);
        console.error('Full error details:', {
          statusCode: error.statusCode,
          body: error.body,
          headers: error.headers,
          endpoint: subscription.endpoint
        });
        
        // Remove invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log('Removing invalid subscription');
          subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
          return { success: false, subscription, removed: true };
        }
        
        return { success: false, subscription, error: error.message };
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
    
    const promises = subscriptions.map((subscription, index) => {
      console.log(`Sending scheduled notification to subscription ${index + 1}/${subscriptions.length}`);
      return webpush.sendNotification(subscription, payload)
        .then(() => {
          console.log(`✓ Scheduled notification sent successfully to subscription ${index + 1}`);
          return { success: true };
        })
        .catch(error => {
          console.error(`✗ Failed to send scheduled notification to subscription ${index + 1}:`, error.message);
          console.error('Scheduled notification error details:', {
            statusCode: error.statusCode,
            body: error.body,
            headers: error.headers,
            endpoint: subscription.endpoint
          });
          
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log('Removing invalid subscription from scheduled notification');
            subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
          }
          
          return { success: false, error: error.message };
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

// Bulk schedule notifications endpoint
app.post('/schedule-bulk', async (req, res) => {
  const { notifications } = req.body;
  
  if (!Array.isArray(notifications)) {
    return res.status(400).json({ error: 'notifications must be an array' });
  }
  
  const results = [];
  const now = new Date();
  
  for (const notif of notifications) {
    const { id, title, body, scheduledTime, blockId, isEarlyWarning } = notif;
    const scheduleDate = new Date(scheduledTime);
    const delay = scheduleDate.getTime() - now.getTime();
    
    if (delay <= 0) {
      results.push({ id, error: 'Scheduled time must be in the future', scheduledTime });
      continue;
    }
    
    // Schedule the notification
    const timeoutId = setTimeout(async () => {
      const payload = JSON.stringify({
        title: title || 'Time Diet Reminder',
        body: body || 'Time to start your next block!',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: { blockId, type: isEarlyWarning ? 'early-warning' : 'time-block', id }
      });
      
      console.log(`🔔 Sending scheduled notification: ${title}`);
      
      const promises = subscriptions.map((subscription, index) => {
        return webpush.sendNotification(subscription, payload)
          .then(() => {
            console.log(`✓ Scheduled notification sent to subscription ${index + 1}`);
            return { success: true };
          })
          .catch(error => {
            console.error(`✗ Failed to send scheduled notification:`, error.message);
            
            if (error.statusCode === 410 || error.statusCode === 404) {
              subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
            }
            
            return { success: false, error: error.message };
          });
      });
      
      await Promise.all(promises);
      scheduledNotifications.delete(timeoutId);
      console.log(`📱 Scheduled notification completed: ${title}`);
    }, delay);
    
    // Store the scheduled notification details
    scheduledNotifications.set(timeoutId, {
      id,
      title,
      body,
      scheduledTime: scheduleDate.toISOString(),
      blockId,
      isEarlyWarning
    });
    
    results.push({
      id,
      message: 'Notification scheduled successfully',
      scheduledFor: scheduleDate.toISOString(),
      delay: `${Math.round(delay / 1000)} seconds`
    });
  }
  
  console.log(`📅 Bulk scheduled ${results.length} notifications`);
  res.json({ 
    message: `${results.length} notifications processed`,
    results,
    totalScheduled: scheduledNotifications.size
  });
});

// Clear all scheduled notifications
app.post('/clear-scheduled', (req, res) => {
  let clearedCount = 0;
  
  for (const [timeoutId, notification] of scheduledNotifications) {
    clearTimeout(timeoutId);
    clearedCount++;
  }
  
  scheduledNotifications.clear();
  
  console.log(`🗑️ Cleared ${clearedCount} scheduled notifications`);
  res.json({ 
    message: `Cleared ${clearedCount} scheduled notifications`,
    clearedCount
  });
});

// Get scheduled notifications status
app.get('/scheduled', (req, res) => {
  const scheduled = Array.from(scheduledNotifications.values());
  res.json({
    count: scheduled.length,
    notifications: scheduled
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
  console.log(`🔑 VAPID Private Key: ${process.env.VAPID_PRIVATE_KEY ? 'SET' : 'MISSING'}`);
  console.log(`📧 VAPID Email: ${process.env.VAPID_EMAIL}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Validate VAPID keys
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.error('❌ MISSING VAPID KEYS! Push notifications will not work.');
    console.error('Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.');
  } else {
    console.log('✅ VAPID keys configured successfully');
  }
});
