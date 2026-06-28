import {
  db, rootCollection, doc, getDocs, writeBatch
} from '../firebase-config.js?v=20260628-perf2';

const LEGACY_COLLECTIONS = [
  'settings', 'custom_fields_schema', 'school_settings', 'roles',
  'students', 'parents', 'teachers', 'classes', 'subjects', 'annual_plans',
  'attendance', 'grades', 'fees', 'schedules', 'announcements', 'messages',
  'admission_applications', 'books', 'borrowing_records', 'academic_alerts',
  'staff', 'leaves', 'salary_slips', 'buildings', 'rooms', 'bed_allocations',
  'notification_logs', 'notification_outbox', 'transfers', 'homework',
  'rewards', 'behavior_logs', 'assessment_types', 'subject_weights',
  'timeslots', 'classrooms', 'teacherAvailability', 'calendar_events',
  'exam_schedule', 'clinic_visits', 'health_records', 'discounts',
  'audit_logs', 'inventory', 'buses', 'routes', 'route_students',
  'transport_fees'
];

export async function inspectLegacyData() {
  const results = [];
  for (const collectionName of LEGACY_COLLECTIONS) {
    const snapshot = await getDocs(rootCollection(collectionName));
    if (!snapshot.empty) {
      results.push({ collection: collectionName, count: snapshot.size });
    }
  }
  return results;
}

export async function migrateLegacyDataToMain() {
  const report = [];

  for (const collectionName of LEGACY_COLLECTIONS) {
    const snapshot = await getDocs(rootCollection(collectionName));
    if (snapshot.empty) continue;

    for (let start = 0; start < snapshot.docs.length; start += 400) {
      const batch = writeBatch(db);
      snapshot.docs.slice(start, start + 400).forEach((legacyDoc) => {
        const target = doc(db, 'tenants', 'main', collectionName, legacyDoc.id);
        batch.set(target, {
          ...legacyDoc.data(),
          migratedFromLegacyRoot: true,
          migratedAt: new Date().toISOString(),
        }, { merge: true });
      });
      await batch.commit();
    }

    report.push({ collection: collectionName, count: snapshot.size });
  }

  const applications = await getDocs(rootCollection('admission_applications'));
  let migratedDocuments = 0;
  for (const application of applications.docs) {
    const documents = await getDocs(
      rootCollection('admission_applications', application.id, 'documents')
    );
    if (documents.empty) continue;

    for (let start = 0; start < documents.docs.length; start += 400) {
      const batch = writeBatch(db);
      documents.docs.slice(start, start + 400).forEach((legacyDoc) => {
        batch.set(
          doc(
            db,
            'tenants', 'main',
            'admission_applications', application.id,
            'documents', legacyDoc.id
          ),
          {
            ...legacyDoc.data(),
            migratedFromLegacyRoot: true,
            migratedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      });
      await batch.commit();
    }
    migratedDocuments += documents.size;
  }
  if (migratedDocuments) {
    report.push({
      collection: 'admission_applications/documents',
      count: migratedDocuments,
    });
  }

  return report;
}

export { LEGACY_COLLECTIONS };
