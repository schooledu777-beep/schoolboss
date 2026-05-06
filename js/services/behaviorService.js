import { state } from '../state.js';
import { db, collection, doc, writeBatch, increment, serverTimestamp } from '../firebase-config.js';
import { escapeHTML } from '../ui.js?v=20260502-photo-sync';

export const BEHAVIOR_BADGES = [
  { min: 200, key: 'ambassador', icon: '🏅', ar: 'سفير المدرسة', en: 'School Ambassador', tone: 'gold' },
  { min: 100, key: 'leader', icon: '🥈', ar: 'قائد الصف', en: 'Class Leader', tone: 'silver' },
  { min: 50, key: 'star', icon: '🥉', ar: 'نجم الأسبوع', en: 'Weekly Star', tone: 'bronze' }
];

export const QUICK_BEHAVIOR_ACTIONS = [
  { points: 1, category: 'مشاركة', labelAr: '+1 مشاركة', labelEn: '+1 Participation', tone: 'positive' },
  { points: 5, category: 'واجب مميز', labelAr: '+5 واجب مميز', labelEn: '+5 Great Homework', tone: 'positive' },
  { points: -2, category: 'تأخير أو تشتيت', labelAr: '-2 تنبيه', labelEn: '-2 Reminder', tone: 'negative' }
];

export function getBehaviorBadge(totalPoints = 0) {
  const points = Number(totalPoints || 0);
  return BEHAVIOR_BADGES.find(badge => points >= badge.min) || null;
}

export function renderBehaviorBadge(student, compact = false) {
  const total = Number(student?.total_points || 0);
  const badge = getBehaviorBadge(total);
  if (!badge) {
    return `<span class="behavior-badge empty">${total} ${state.lang === 'ar' ? 'نقطة' : 'pts'}</span>`;
  }
  return `
    <span class="behavior-badge ${badge.tone} ${compact ? 'compact' : ''}" title="${escapeHTML(badge[state.lang] || badge.en)}">
      <span>${badge.icon}</span>
      ${compact ? '' : `<strong>${escapeHTML(badge[state.lang] || badge.en)}</strong>`}
      <em>${total}</em>
    </span>`;
}

export function getClassLeaderboard(classId, limit = 5) {
  return (state.students || [])
    .filter(student => student.classId === classId)
    .sort((a, b) => Number(b.total_points || 0) - Number(a.total_points || 0))
    .slice(0, limit);
}

export function getStudentBehaviorLogs(studentId, limit = 8) {
  return (state.behaviorLogs || [])
    .filter(log => log.student_id === studentId)
    .sort((a, b) => {
      const ad = a.created_at?.seconds ? a.created_at.seconds * 1000 : new Date(a.created_at || a.timestamp || 0).getTime();
      const bd = b.created_at?.seconds ? b.created_at.seconds * 1000 : new Date(b.created_at || b.timestamp || 0).getTime();
      return bd - ad;
    })
    .slice(0, limit);
}

export async function awardBehaviorPoints(studentId, points, category, note = '') {
  const student = state.students.find(item => item.id === studentId);
  if (!student) throw new Error('Student not found');

  const batch = writeBatch(db);
  const logRef = doc(collection(db, 'behavior_logs'));
  const now = new Date().toISOString();

  batch.set(logRef, {
    student_id: studentId,
    student_name: student.name || '',
    class_id: student.classId || '',
    teacher_id: state.profile?.uid || state.user?.uid || '',
    teacher_name: state.profile?.name || state.profile?.email || '',
    points: Number(points || 0),
    category,
    note,
    created_at: serverTimestamp(),
    timestamp: now
  });

  batch.update(doc(db, 'students', studentId), {
    total_points: increment(Number(points || 0)),
    updatedAt: now
  });

  await batch.commit();
}

export function renderQuickBehaviorActions(studentId) {
  return `
    <div class="behavior-actions" data-student-id="${studentId}">
      ${QUICK_BEHAVIOR_ACTIONS.map(action => `
        <button class="behavior-quick-action ${action.tone}" data-student-id="${studentId}" data-points="${action.points}" data-category="${escapeHTML(action.category)}">
          ${state.lang === 'ar' ? action.labelAr : action.labelEn}
        </button>
      `).join('')}
    </div>`;
}
