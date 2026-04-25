import { state } from '../state.js';
import { db, collection, addDoc, query, where, getDocs, orderBy, limit } from '../firebase-config.js';

export const portalService = {
  // --- PARENT PORTAL API ---
  async getParentDashboardData(parentId) {
    if (!parentId) return null;

    // 1. Get Children
    const children = state.students.filter(s => s.parentId === parentId);
    const childrenIds = children.map(c => c.id);

    // 2. Aggregate Balance Due
    const unpaidFees = state.fees.filter(f => childrenIds.includes(f.studentId) && f.status === 'unpaid');
    const totalBalance = unpaidFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

    // 3. Weekly Attendance Summary
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyAttendance = state.attendance.filter(a => 
      childrenIds.includes(a.studentId) && 
      new Date(a.date) >= oneWeekAgo
    );

    // 4. Latest Grades
    const latestGrades = state.grades
      .filter(g => childrenIds.includes(g.studentId))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    return {
      childrenCount: children.length,
      totalBalance,
      unpaidCount: unpaidFees.length,
      weeklyAttendanceSummary: {
        present: weeklyAttendance.filter(a => a.status === 'present').length,
        absent: weeklyAttendance.filter(a => a.status === 'absent').length,
        total: weeklyAttendance.length
      },
      latestGrades
    };
  },

  // --- TEACHER PORTAL API ---
  async getTeacherDashboardData(teacherId) {
    if (!teacherId) return null;

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    // 1. Daily Schedule
    const dailySchedule = state.schedules.filter(s => 
      s.teacherId === teacherId && 
      s.day === today
    ).sort((a, b) => a.startTime.localeCompare(b.startTime));

    return {
      dailySchedule,
      activeClasses: [...new Set(dailySchedule.map(s => s.classId))].length
    };
  },

  // Offline-capable bulk grading
  async bulkUpdateGrades(gradesArray) {
    const results = { success: [], failed: [] };
    
    for (const gradeData of gradesArray) {
      try {
        await addDoc(collection(db, 'grades'), {
          ...gradeData,
          date: gradeData.date || new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
        results.success.push(gradeData.studentId);
      } catch (error) {
        console.error('Bulk update error:', error);
        results.failed.push({ studentId: gradeData.studentId, error: error.message });
      }
    }
    return results;
  }
};
