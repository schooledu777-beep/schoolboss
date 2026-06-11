import { state } from '../state.js';
import { tCol } from '../db.js?v=20260611-tenants';
import { onSnapshot } from '../firebase-config.js?v=20260611-tenants';

class SyncService {
  constructor() {
    this.activeSubscriptions = new Map();
    this.pageCollectionMap = {
      dashboard: ['students', 'teachers', 'classes', 'attendance', 'announcements', 'fees', 'notification_logs', 'notification_outbox', 'schedules', 'rewards', 'behavior_logs', 'homework', 'calendar_events', 'exam_schedule'],
      'setup-wizard': ['classes', 'subjects', 'teachers', 'school_settings'],
      students: ['students', 'classes', 'parents', 'custom_fields_schema', 'behavior_logs'],
      teachers: ['teachers', 'subjects'],
      parents: ['parents', 'students', 'notification_outbox'],
      classes: ['classes', 'teachers', 'students', 'schedules', 'attendance', 'grades', 'subjects', 'homework', 'behavior_logs'],
      attendance: ['attendance', 'students', 'classes', 'parents', 'notification_outbox'],
      grades: ['grades', 'students', 'subjects', 'classes'],
      subjects: ['subjects', 'teachers', 'classes', 'schedules', 'grades', 'homework'],
      'annual-plan': ['annual_plans', 'classes', 'subjects', 'schedules', 'calendar_events'],
      schedule: ['schedules', 'classes', 'teachers', 'subjects', 'timeslots', 'classrooms'],
      finance: ['fees', 'students', 'parents', 'discounts', 'notification_outbox'],
      announcements: ['announcements'],
      messages: ['messages', 'students', 'teachers', 'parents'],
      admissions: ['students', 'parents', 'classes'],
      hr: ['teachers', 'staff', 'leaves', 'salary_slips'],
      library: ['books', 'borrowing_records', 'students'],
      hostel: ['buildings', 'rooms', 'bed_allocations', 'students'],
      'student-profile': ['students', 'attendance', 'grades', 'fees', 'classes', 'behavior_logs'],
      'parent-profile': ['parents', 'students', 'fees', 'notification_logs', 'notification_outbox'],
      'academic-alerts': ['academic_alerts', 'students', 'subjects'],
      transportation: ['buses', 'routes', 'route_students', 'transport_fees', 'students'],
      // New pages — round 1
      'report-cards': ['grades', 'students', 'classes', 'attendance'],
      calendar:       ['calendar_events'],
      homework:       ['homework', 'students', 'classes', 'subjects'],
      clinic:         ['clinic_visits', 'health_records', 'students', 'classes'],
      exams:          ['exam_schedule', 'students', 'classes', 'subjects'],
      // New pages — round 2
      analytics:  ['grades', 'students', 'classes', 'attendance', 'fees', 'teachers'],
      'audit-log':['audit_logs'],
      inventory:  ['inventory'],
      settings:   ['settings', 'custom_fields_schema'],
      'notification-outbox': ['notification_outbox', 'parents', 'students'],
    };

    // Helper to map DB names to state keys (if different)
    this.stateKeys = {
      schedules: 'schedules',
      fees: 'fees',
      notification_logs: 'notificationLogs',
      notification_outbox: 'notificationOutbox',
      academic_alerts: 'academicAlerts',
      salary_slips: 'salarySlips',
      borrowing_records: 'borrowingRecords',
      bed_allocations: 'bedAllocations',
      route_students:  'routeStudents',
      transport_fees:  'transportFees',
      calendar_events: 'calendarEvents',
      exam_schedule:   'examSchedule',
      clinic_visits:   'clinicVisits',
      health_records:  'healthRecords',
      audit_logs:      'auditLogs',
      annual_plans:    'annualPlans',
      school_settings: 'schoolSettings',
      custom_fields_schema: 'customFieldsSchema',
      behavior_logs: 'behaviorLogs',
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
        let colRef;
        try { colRef = tCol(collName); }
        catch(e) { console.warn(`[Sync] Cannot subscribe to ${collName}: ${e.message}`); return; }
        const unsub = onSnapshot(colRef, (snap) => {
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

  /** Stop all listeners, then re-subscribe for the current page (use after tenantId is set). */
  restart(pageName) {
    this.stopAll();
    this.syncPage(pageName || state.currentPage || 'dashboard');
  }
}

export const syncService = new SyncService();
