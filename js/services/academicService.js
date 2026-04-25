import { db, collection, addDoc, getDocs, serverTimestamp, query, where, limit } from '../firebase-config.js';
import { state } from '../state.js';

export const academicService = {
    /**
     * Seed initial assessment types if they don't exist
     */
    async seedAssessmentTypes() {
        if (state.profile?.role !== 'admin') return;
        
        try {
            const typesRef = collection(db, 'assessment_types');
            const snap = await getDocs(query(typesRef, limit(1)));
            
            if (snap.empty) {
                const initialTypes = [
                    { name: 'Quiz', weight: 10, ar: 'اختبار قصير' },
                    { name: 'Midterm', weight: 30, ar: 'اختبار نصفي' },
                    { name: 'Final', weight: 40, ar: 'اختبار نهائي' },
                    { name: 'Homework', weight: 20, ar: 'واجب منزلي' }
                ];
                
                for (const type of initialTypes) {
                    await addDoc(typesRef, {
                        ...type,
                        createdAt: serverTimestamp()
                    });
                }
                console.log('Assessment types seeded successfully');
            }
        } catch (error) {
            console.error('Error seeding assessment types:', error);
        }
    },

    /**
     * Calculate weighted average for a student in a subject
     */
    calculateWeightedAverage(studentId, subjectId) {
        const studentGrades = state.grades.filter(g => g.studentId === studentId && g.subject === subjectId);
        const weights = state.subjectWeights.filter(w => w.subject === subjectId); // Assuming subject weights are per subject
        
        if (studentGrades.length === 0) return 0;
        
        let totalWeightedScore = 0;
        let totalWeightUsed = 0;
        
        // Group grades by type
        const gradesByType = {};
        studentGrades.forEach(g => {
            if (!gradesByType[g.examType]) gradesByType[g.examType] = [];
            gradesByType[g.examType].push(g.score / g.maxScore);
        });
        
        // Calculate average per type and apply weight
        Object.keys(gradesByType).forEach(type => {
            const typeWeight = weights.find(w => w.examType === type)?.weight || 0;
            const typeAvg = gradesByType[type].reduce((a, b) => a + b, 0) / gradesByType[type].length;
            
            totalWeightedScore += typeAvg * typeWeight;
            totalWeightUsed += typeWeight;
        });
        
        return totalWeightUsed > 0 ? (totalWeightedScore / totalWeightUsed) * 100 : 0;
    },

    /**
     * Process academic alerts for a student
     */
    async processAcademicAlerts(studentId) {
        const attendancePct = this.getStudentAttendancePercentage(studentId);
        const gradeAvg = this.getStudentGradeAverage(studentId);
        const alertsRef = collection(db, 'academic_alerts');

        const alerts = [];
        if (attendancePct < 85) {
            alerts.push({
                studentId,
                type: 'Attendance',
                value: attendancePct,
                threshold: 85,
                message: `Attendance fell below 85% (${attendancePct.toFixed(1)}%)`,
                severity: attendancePct < 70 ? 'critical' : 'warning'
            });
        }

        if (gradeAvg < 60) {
            alerts.push({
                studentId,
                type: 'Grades',
                value: gradeAvg,
                threshold: 60,
                message: `Grade average fell below 60% (${gradeAvg.toFixed(1)}%)`,
                severity: gradeAvg < 50 ? 'critical' : 'warning'
            });
        }

        for (const alert of alerts) {
            // Check if alert already exists recently (last 7 days) to avoid duplicates
            const existing = state.academicAlerts.find(a => a.studentId === studentId && a.type === alert.type);
            if (!existing) {
                await addDoc(alertsRef, {
                    ...alert,
                    status: 'Active',
                    createdAt: serverTimestamp()
                });
            }
        }
    },

    getStudentAttendancePercentage(studentId) {
        const studentAttendance = state.attendance.filter(a => a.studentId === studentId);
        if (studentAttendance.length === 0) return 100;
        const present = studentAttendance.filter(a => a.status === 'present').length;
        return (present / studentAttendance.length) * 100;
    },

    getStudentGradeAverage(studentId) {
        const studentGrades = state.grades.filter(g => g.studentId === studentId);
        if (studentGrades.length === 0) return 100;
        const total = studentGrades.reduce((sum, g) => sum + (g.score / g.maxScore), 0);
        return (total / studentGrades.length) * 100;
    }
};
