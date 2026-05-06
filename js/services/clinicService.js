import { state } from '../state.js';
import { db, collection, doc, setDoc, deleteDoc, writeBatch } from '../firebase-config.js';

// ========================= CLINIC SERVICE =========================
// Uses Firestore batch writes to atomically:
//   1. Write/update a clinic_visits document
//   2. Update the attendance document (composite key: studentId_date)
//      with status = 'medical_excuse' if action is 'home' or 'hospital'

/**
 * Save a clinic visit and — if action warrants it — update attendance atomically.
 * @param {Object} visitData  - { studentId, classId, date, symptoms, diagnosis, action_taken, medicalExcuse, note, nurseId }
 * @param {string|null} existingId - if editing an existing visit
 */
export async function saveClinicVisit(visitData, existingId = null) {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // 1. ── Clinic Visit document ─────────────────────────────────────
  const visitRef = existingId
    ? doc(db, 'clinic_visits', existingId)
    : doc(collection(db, 'clinic_visits'));

  const fullVisitData = {
    ...visitData,
    updatedAt: now,
    ...(existingId ? {} : { createdAt: now }),
  };
  batch.set(visitRef, fullVisitData, { merge: true });

  // 2. ── Attendance document (composite key) ────────────────────────
  // Only write attendance if action sends student away from school
  if (['home', 'hospital'].includes(visitData.action_taken)) {
    const attDocId = `${visitData.studentId}_${visitData.date}`;
    const attRef = doc(db, 'attendance', attDocId);

    const student = state.students.find(s => s.id === visitData.studentId);

    batch.set(attRef, {
      studentId:  visitData.studentId,
      classId:    visitData.classId || student?.classId || '',
      date:       visitData.date,
      status:     'medical_excuse',
      note:       'مُعفى طبياً — تم التحويل من العيادة المدرسية',
      teacherId:  state.profile?.uid || '',
      updatedAt:  now,
    }, { merge: true });
  }

  await batch.commit();
  return visitRef.id;
}

/**
 * Delete a clinic visit.
 * (Does NOT roll back attendance — nurse must manually correct if needed.)
 */
export async function deleteClinicVisit(id) {
  await deleteDoc(doc(db, 'clinic_visits', id));
}

/**
 * Derive quick stats from current state for the clinic dashboard cards.
 */
export function getClinicStats() {
  const visits = state.clinicVisits || [];
  const today = new Date().toISOString().slice(0, 10);
  const todayVisits = visits.filter(v => v.date === today);

  return {
    totalVisits:  visits.length,
    todayVisits:  todayVisits.length,
    sentHome:     visits.filter(v => v.action_taken === 'home').length,
    referred:     visits.filter(v => v.action_taken === 'hospital').length,
    inClinic:     visits.filter(v => v.action_taken === 'rest').length,
    excused:      visits.filter(v => v.medicalExcuse === true).length,
  };
}
