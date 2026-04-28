import { state } from '../state.js';
import { db, collection, onSnapshot } from '../firebase-config.js';

class SyncService {
  constructor() {
    this.activeSubscriptions = new Map();
    this.pageCollectionMap = {
      dashboard: ['students', 'teachers', 'classes', 'attendance', 'announcements', 'fees', 'notification_logs', 'schedules', 'rewards', 'homework'],
      students: ['students', 'classes', 'parents'],
      teachers: ['teachers', 'subjects'],
      parents: ['parents', 'students'],
      classes: ['classes', 'teachers', 'students'],
      attendance: ['attendance', 'students', 'classes'],
      grades: ['grades', 'students', 'subjects', 'classes'],
      subjects: ['subjects', 'teachers'],
      schedule: ['schedules', 'classes', 'teachers', 'subjects', 'timeslots', 'classrooms'],
      finance: ['fees', 'students'],
      announcements: ['announcements'],
      messages: ['messages', 'students', 'teachers', 'parents'],
      admissions: ['students', 'parents', 'classes'],
      hr: ['teachers', 'staff', 'leaves', 'salary_slips'],
      library: ['books', 'borrowing_records', 'students'],
      hostel: ['buildings', 'rooms', 'bed_allocations', 'students'],
      'student-profile': ['students', 'attendance', 'grades', 'fees', 'classes'],
      'parent-profile': ['parents', 'students', 'fees', 'notification_logs'],
      'academic-alerts': ['academic_alerts', 'students', 'subjects'],
    };

    // Helper to map DB names to state keys (if different)
    this.stateKeys = {
      schedules: 'schedules',
      fees: 'fees',
      notification_logs: 'notificationLogs',
      academic_alerts: 'academicAlerts',
      salary_slips: 'salarySlips',
      borrowing_records: 'borrowingRecords',
      bed_allocations: 'bedAllocations'
    };
  }

  getStateKey(collName) {
    return this.stateKeys[collName] || collName;
  }

  syncPage(pageName) {
    const collectionsNeeded = this.pageCollectionMap[pageName] || this.pageCollectionMap.dashboard;
    
    // Unsubscribe from no longer needed collections
    for (const [collName, unsub] of this.activeSubscriptions.entries()) {
      if (!collectionsNeeded.includes(collName)) {
        unsub();
        this.activeSubscriptions.delete(collName);
        console.log(`[Sync] Unsubscribed from ${collName}`);
      }
    }

    // Subscribe to new collections
    collectionsNeeded.forEach(collName => {
      if (!this.activeSubscriptions.has(collName)) {
        const key = this.getStateKey(collName);
        const unsub = onSnapshot(collection(db, collName), (snap) => {
          state.update({ [key]: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
          console.log(`[Sync] Updated ${collName}`);
        }, (err) => {
          console.warn(`[Sync] Listener error for ${collName}:`, err);
          state.update({ [key]: [] });
        });
        this.activeSubscriptions.set(collName, unsub);
        console.log(`[Sync] Subscribed to ${collName}`);
      }
    });
  }

  stopAll() {
    this.activeSubscriptions.forEach(unsub => unsub());
    this.activeSubscriptions.clear();
    console.log(`[Sync] All subscriptions stopped`);
  }
}

export const syncService = new SyncService();
