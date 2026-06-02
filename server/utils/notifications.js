const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');

const createNotification = async (io, { recipient, sender, type, title, message, link, expo, metadata }) => {
  try {
    const notification = await Notification.create({
      recipient, sender, type, title, message, link, expo, metadata
    });

    if (io) {
      io.to(`user_${recipient}`).emit('notification', {
        _id: notification._id,
        type, title, message, link,
        createdAt: notification.createdAt,
        isRead: false
      });
    }

    return notification;
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

const logActivity = async ({ user, action, entity, entityId, details, req, status = 'success' }) => {
  try {
    await ActivityLog.create({
      user,
      action,
      entity,
      entityId,
      details,
      ip: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers?.['user-agent'],
      status
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
};

module.exports = { createNotification, logActivity };