import { state } from '../state.js';
import { db, collection, addDoc, updateDoc, doc } from '../firebase-config.js';

export const hrService = {
  /**
   * Calculates the monthly payroll for a staff member.
   * Logic: Base Salary - (Unpaid Leave Days * Daily Rate)
   */
  calculateMonthlyPayroll(staffId, month, year) {
    const staff = state.teachers.find(s => s.id === staffId); // Using teachers collection as requested to extend
    if (!staff || !staff.baseSalary) return null;

    const baseSalary = Number(staff.baseSalary);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyRate = baseSalary / daysInMonth;

    // Find unpaid leaves for this month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const unpaidLeaves = state.leaves.filter(l => 
      l.staffId === staffId && 
      l.status === 'approved' && 
      l.type === 'unpaid' &&
      new Date(l.startDate) <= monthEnd && 
      new Date(l.endDate) >= monthStart
    );

    let deductionDays = 0;
    unpaidLeaves.forEach(l => {
      const start = Math.max(new Date(l.startDate), monthStart);
      const end = Math.min(new Date(l.endDate), monthEnd);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      deductionDays += diffDays;
    });

    const deductions = deductionDays * dailyRate;
    const finalSalary = baseSalary - deductions;

    return {
      staffId,
      staffName: staff.name,
      month,
      year,
      baseSalary,
      deductionDays,
      deductions,
      finalSalary: Math.max(0, finalSalary),
      generatedAt: new Date().toISOString()
    };
  },

  async requestLeave(data) {
    return await addDoc(collection(db, 'leaves'), {
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  },

  async approveLeave(leaveId) {
    return await updateDoc(doc(db, 'leaves', leaveId), { status: 'approved' });
  },

  async rejectLeave(leaveId) {
    return await updateDoc(doc(db, 'leaves', leaveId), { status: 'rejected' });
  }
};
