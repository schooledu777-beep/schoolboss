import { db, collection, addDoc } from '../firebase-config.js';
import { state } from '../state.js';

export const notificationService = {
  /**
   * Core Log Service
   * @param {Object} payload 
   */
  async logNotification(payload) {
    try {
      const notification = {
        recipientId: payload.recipientId,
        type: payload.type, // 'invoice_overdue' | 'student_absent' | 'grade_published'
        title: payload.title,
        message: payload.message,
        channel: payload.channel || 'system', // 'system' | 'sms' | 'whatsapp'
        status: 'pending',
        metadata: payload.metadata || {},
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'notification_logs'), notification);
      
      // Future Integration Point:
      // if (payload.channel === 'whatsapp') await triggerWhatsAppWebhook(notification);
      
      return docRef.id;
    } catch (error) {
      console.error('Notification log error:', error);
      return null;
    }
  },

  /**
   * Generic trigger for common events
   */
  async triggerEventNotification(eventType, data) {
    let payload = { type: eventType, recipientId: data.recipientId };

    switch (eventType) {
      case 'student_absent':
        payload.title = state.lang === 'ar' ? 'تنبيه غياب' : 'Absence Alert';
        payload.message = state.lang === 'ar' 
          ? `الطالب ${data.studentName} غائب اليوم الموافق ${data.date}` 
          : `Student ${data.studentName} is absent today, ${data.date}`;
        break;

      case 'invoice_overdue':
        payload.title = state.lang === 'ar' ? 'فاتورة متأخرة' : 'Overdue Invoice';
        payload.message = state.lang === 'ar'
          ? `نذكركم بوجود مستحقات مالية متأخرة بقيمة ${data.amount}`
          : `Reminder: You have an overdue balance of ${data.amount}`;
        break;

      default:
        return;
    }

    return this.logNotification(payload);
  }
};
