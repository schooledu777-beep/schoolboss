import { db, collection, doc, addDoc, writeBatch, serverTimestamp } from '../firebase-config.js';
import { state } from '../state.js';

function getParentContact(parentId) {
  const parent = (state.parents || []).find(item => item.id === parentId || item.uid === parentId);
  const preferences = parent?.notificationPreferences || {};
  const preferredChannel = preferences.telegram?.enabled ? 'telegram'
    : preferences.sms?.enabled ? 'sms'
    : preferences.push?.enabled ? 'push'
    : 'push';

  const contactInfo = preferredChannel === 'telegram'
    ? (preferences.telegram?.chatId || parent?.telegramChatId || '')
    : preferredChannel === 'sms'
      ? (parent?.phone || '')
      : (parent?.email || parent?.uid || parentId);

  return { parent, preferredChannel, contactInfo, preferences };
}

function makeOutboxPayload(payload) {
  const contact = getParentContact(payload.recipientId);
  return {
    recipient_id: payload.recipientId,
    recipient_name: contact.parent?.name || '',
    type: payload.channel || contact.preferredChannel,
    contact_info: payload.contactInfo || contact.contactInfo || '',
    title: payload.title,
    body: payload.message || payload.body,
    status: 'pending',
    attempts: 0,
    error_message: '',
    metadata: payload.metadata || {},
    created_at: serverTimestamp(),
    createdAt: new Date().toISOString()
  };
}

function makeLogPayload(payload) {
  return {
    recipientId: payload.recipientId,
    type: payload.type,
    title: payload.title,
    message: payload.message || payload.body,
    channel: payload.channel || 'outbox',
    status: 'pending',
    metadata: payload.metadata || {},
    createdAt: new Date().toISOString()
  };
}

export const notificationService = {
  /**
   * Core Log Service
   * @param {Object} payload 
   */
  async logNotification(payload) {
    try {
      const batch = writeBatch(db);
      const logRef = doc(collection(db, 'notification_logs'));
      const outboxRef = doc(collection(db, 'notification_outbox'));
      batch.set(logRef, makeLogPayload(payload));
      batch.set(outboxRef, makeOutboxPayload(payload));
      await batch.commit();
      return outboxRef.id;
    } catch (error) {
      console.error('Notification log error:', error);
      return null;
    }
  },

  queueOutboxInBatch(batch, payload) {
    const logRef = doc(collection(db, 'notification_logs'));
    const outboxRef = doc(collection(db, 'notification_outbox'));
    batch.set(logRef, makeLogPayload(payload));
    batch.set(outboxRef, makeOutboxPayload(payload));
    return outboxRef.id;
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
        payload.metadata = {
          studentId: data.studentId || '',
          studentName: data.studentName,
          date: data.date,
          event: 'attendance_absent'
        };
        break;

      case 'invoice_overdue':
        payload.title = state.lang === 'ar' ? 'فاتورة متأخرة' : 'Overdue Invoice';
        payload.message = state.lang === 'ar'
          ? `نذكركم بوجود مستحقات مالية متأخرة بقيمة ${data.amount}`
          : `Reminder: You have an overdue balance of ${data.amount}`;
        payload.metadata = {
          studentId: data.studentId || '',
          feeId: data.feeId || '',
          amount: data.amount,
          dueDate: data.dueDate || '',
          event: 'fee_due'
        };
        break;

      default:
        return;
    }

    return this.logNotification(payload);
  },

  buildEventPayload(eventType, data) {
    let payload = { type: eventType, recipientId: data.recipientId };
    if (eventType === 'student_absent') {
      payload.title = state.lang === 'ar' ? 'إشعار غياب' : 'Absence Alert';
      payload.message = state.lang === 'ar'
        ? `نود إعلامكم بغياب الطالب ${data.studentName} بتاريخ ${data.date}.`
        : `Student ${data.studentName} was marked absent on ${data.date}.`;
      payload.metadata = { studentId: data.studentId || '', studentName: data.studentName, date: data.date };
    }
    if (eventType === 'invoice_overdue') {
      payload.title = state.lang === 'ar' ? 'تذكير رسوم مدرسية' : 'School Fee Reminder';
      payload.message = state.lang === 'ar'
        ? `نذكركم بوجود قسط مستحق بقيمة ${data.amount}${data.dueDate ? `، تاريخ الاستحقاق ${data.dueDate}` : ''}.`
        : `Reminder: a school fee of ${data.amount} is due${data.dueDate ? ` on ${data.dueDate}` : ''}.`;
      payload.metadata = { studentId: data.studentId || '', feeId: data.feeId || '', amount: data.amount, dueDate: data.dueDate || '' };
    }
    return payload.title ? payload : null;
  }
};
