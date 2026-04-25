import { state, t } from '../state.js';
import { db, collection, getDocs, query, where, onSnapshot, addDoc, doc, setDoc } from '../firebase-config.js';
import { formatCurrency, showToast } from '../ui.js';
import { adminCreateUser } from '../auth.js';
import { portalService } from '../services/portalService.js';

export function renderDashboard() {
  const role = state.profile?.role || 'student';
  const renderers = { admin: renderAdminDash, teacher: renderTeacherDash, parent: renderParentDash, student: renderStudentDash };
  return (renderers[role] || renderStudentDash)();
}

function renderAdminDash() {
  const totalStudents = state.students.length;
  const totalTeachers = state.teachers.length;
  const totalClasses = state.classes.length;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAtt = state.attendance.filter(a => a.date === todayStr);
  const presentCount = todayAtt.filter(a => a.status === 'present').length;
  const attRate = todayAtt.length > 0 ? Math.round((presentCount / todayAtt.length) * 100) : 0;
  const isPrivate = state.schoolType === 'private';
  const totalFees = state.fees.reduce((s, f) => s + (f.amount || 0), 0);
  const paidFees = state.fees.reduce((s, f) => s + (f.paidAmount || 0), 0);

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('dashboard')}</h2>
      <p class="text-muted">${state.lang === 'ar' ? 'مرحباً بك، ' : 'Welcome, '}${state.profile?.name}</p>
    </div>
    <div class="stats-grid">
      <div class="stat-card gradient-purple">
        <div class="stat-icon">👨‍🎓</div>
        <div class="stat-info"><h3>${totalStudents}</h3><p>${t('totalStudents')}</p></div>
      </div>
      <div class="stat-card gradient-cyan">
        <div class="stat-icon">👨‍🏫</div>
        <div class="stat-info"><h3>${totalTeachers}</h3><p>${t('totalTeachers')}</p></div>
      </div>
      <div class="stat-card gradient-green">
        <div class="stat-icon">🏫</div>
        <div class="stat-info"><h3>${totalClasses}</h3><p>${t('totalClasses')}</p></div>
      </div>
      <div class="stat-card gradient-amber">
        <div class="stat-icon">📋</div>
        <div class="stat-info"><h3>${attRate}%</h3><p>${t('attendanceRate')}</p></div>
      </div>
    </div>
    ${isPrivate ? `
    <div class="stats-grid grid-2">
      <div class="stat-card gradient-emerald">
        <div class="stat-icon">💰</div>
        <div class="stat-info"><h3>${formatCurrency(paidFees)}</h3><p>${t('revenue')}</p></div>
      </div>
      <div class="stat-card gradient-red">
        <div class="stat-icon">⏰</div>
        <div class="stat-info"><h3>${formatCurrency(totalFees - paidFees)}</h3><p>${t('pending')}</p></div>
      </div>
    </div>` : ''}
    <div class="grid-2">
      <div class="card glass-card">
        <h3 class="card-title">${state.lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}</h3>
        <div class="quick-actions">
          <a href="#students" class="quick-action-btn"><span>👨‍🎓</span><span>${state.lang === 'ar' ? 'إضافة طالب' : 'Add Student'}</span></a>
          <a href="#teachers" class="quick-action-btn"><span>👨‍🏫</span><span>${state.lang === 'ar' ? 'إضافة معلم' : 'Add Teacher'}</span></a>
          <a href="#attendance" class="quick-action-btn"><span>📋</span><span>${state.lang === 'ar' ? 'تسجيل حضور' : 'Take Attendance'}</span></a>
          <a href="#announcements" class="quick-action-btn"><span>📢</span><span>${state.lang === 'ar' ? 'إعلان جديد' : 'New Announcement'}</span></a>
          <a href="#" id="btn-mock-data" class="quick-action-btn"><span>🧪</span><span>${state.lang === 'ar' ? 'بيانات تجريبية' : 'Mock Data'}</span></a>
        </div>
      </div>
      <div class="card glass-card">
        <h3 class="card-title">${state.lang === 'ar' ? 'آخر الإعلانات' : 'Recent Announcements'}</h3>
        <div class="recent-list">
          ${state.announcements.slice(0, 5).map(a => `
            <div class="recent-item">
              <span class="recent-icon">📢</span>
              <div><strong>${a.title}</strong><p class="text-muted text-sm">${a.body?.substring(0, 60) || ''}...</p></div>
            </div>`).join('') || `<p class="text-muted text-center">${t('noData')}</p>`}
        </div>
      </div>
    </div>
  </div>`;
}

  const teacherId = state.profile?.uid;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const dailySchedule = state.schedules.filter(s => s.teacherId === teacherId && s.day === today);

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('dashboard')}</h2>
      <p class="text-muted">${state.lang === 'ar' ? 'مرحباً أستاذ/ة ' : 'Welcome, '}${state.profile?.name}</p>
    </div>
    <div class="stats-grid grid-3">
      <div class="stat-card gradient-purple"><div class="stat-icon">🏫</div><div class="stat-info"><h3>${myClasses.length}</h3><p>${t('myClasses')}</p></div></div>
      <div class="stat-card gradient-cyan"><div class="stat-icon">👨‍🎓</div><div class="stat-info"><h3>${myStudentIds.length}</h3><p>${t('totalStudents')}</p></div></div>
      <div class="stat-card gradient-green"><div class="stat-icon">✅</div><div class="stat-info"><h3>${presentCount}/${todayAtt.length || myStudentIds.length}</h3><p>${t('todayAttendance')}</p></div></div>
    </div>
    
    <div class="grid-2">
      <div class="card glass-card">
        <h3 class="card-title">${t('todaySchedule')}</h3>
        <div class="recent-list">
          ${dailySchedule.map(s => `
            <div class="recent-item">
              <span class="recent-icon">⏰</span>
              <div>
                <strong>${s.subject}</strong>
                <p class="text-muted text-sm">${s.startTime || ''} - ${s.endTime || ''} | ${state.classes.find(c => c.id === s.classId)?.name || ''}</p>
              </div>
            </div>
          `).join('') || `<p class="text-muted text-center">${t('noData')}</p>`}
        </div>
      </div>
      <div class="card glass-card">
        <h3 class="card-title">${state.lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}</h3>
        <div class="quick-actions">
          <a href="#attendance" class="quick-action-btn"><span>📋</span><span>${state.lang === 'ar' ? 'تسجيل حضور' : 'Take Attendance'}</span></a>
          <a href="#grades" class="quick-action-btn"><span>📝</span><span>${state.lang === 'ar' ? 'إدخال درجات' : 'Enter Grades'}</span></a>
          <a href="#" id="bulk-grading-btn" class="quick-action-btn"><span>📊</span><span>${t('bulkGrading')}</span></a>
          <a href="#messages" class="quick-action-btn"><span>✉️</span><span>${state.lang === 'ar' ? 'إرسال رسالة' : 'Send Message'}</span></a>
        </div>
      </div>
    </div>
  </div>`;
}

function renderParentDash() {
  const parentId = state.profile?.uid;
  const myStudents = state.students.filter(s => state.profile?.studentIds?.includes(s.id) || s.parentId === parentId);
  const childrenIds = myStudents.map(s => s.id);

  // Quick aggregation
  const unpaidFees = state.fees.filter(f => childrenIds.includes(f.studentId) && f.status === 'unpaid');
  const totalBalance = unpaidFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  
  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('dashboard')}</h2>
      <p class="text-muted">${state.lang === 'ar' ? 'مرحباً ' : 'Welcome, '}${state.profile?.name}</p>
    </div>
    <div class="stats-grid grid-3">
      <div class="stat-card gradient-purple">
        <div class="stat-icon">💰</div>
        <div class="stat-info"><h3>${formatCurrency(totalBalance)}</h3><p>${t('balanceDue')}</p></div>
      </div>
      <div class="stat-card gradient-cyan">
        <div class="stat-icon">👨‍👩‍👧</div>
        <div class="stat-info"><h3>${myStudents.length}</h3><p>${t('myChildren')}</p></div>
      </div>
      <div class="stat-card gradient-green">
        <div class="stat-icon">🔔</div>
        <div class="stat-info"><h3>${state.notificationLogs.filter(n => n.recipientId === parentId && n.status === 'pending').length}</h3><p>${state.lang === 'ar' ? 'تنبيهات جديدة' : 'New Alerts'}</p></div>
      </div>
    </div>
    <div class="grid-2">
      <div class="card glass-card">
        <h3 class="card-title">${t('myChildren')}</h3>
        <div class="children-grid">
          ${myStudents.map(s => {
            const cls = state.classes.find(c => c.id === s.classId);
            return `<div class="child-card glass-card"><div class="avatar avatar-md gradient-purple">${s.name?.[0] || '?'}</div><h4>${s.name}</h4><p class="text-muted">${cls?.name || ''}</p><div class="child-actions"><a href="#grades" class="btn btn-sm btn-outline">📝</a><a href="#attendance" class="btn btn-sm btn-outline">📋</a></div></div>`;
          }).join('') || `<p class="text-muted text-center">${t('noData')}</p>`}
        </div>
      </div>
      <div class="card glass-card">
        <h3 class="card-title">${t('notificationHistory')}</h3>
        <div class="recent-list">
          ${state.notificationLogs.filter(n => n.recipientId === parentId).slice(0, 5).map(n => `
            <div class="recent-item">
              <span class="recent-icon">🔔</span>
              <div><strong>${n.title}</strong><p class="text-muted text-sm">${n.message}</p></div>
            </div>
          `).join('') || `<p class="text-muted text-center">${t('noData')}</p>`}
        </div>
      </div>
    </div>
  </div>`;
}

function renderStudentDash() {
  const myRewards = state.rewards.filter(r => r.studentId === state.profile?.uid);
  const totalPoints = myRewards.reduce((s, r) => s + (r.points || 0), 0);
  const myHomework = state.homework.filter(h => {
    const cls = state.classes.find(c => c.studentIds?.includes(state.profile?.uid));
    return cls && h.classId === cls.id;
  });
  const pendingHw = myHomework.filter(h => !h.submissions?.find(s => s.studentId === state.profile?.uid));

  return `
  <div class="page-content animate-in">
    <div class="page-header">
      <h2>${t('dashboard')}</h2>
      <p class="text-muted">${state.lang === 'ar' ? 'مرحباً ' : 'Welcome, '}${state.profile?.name}</p>
    </div>
    <div class="stats-grid grid-3">
      <div class="stat-card gradient-purple"><div class="stat-icon">⭐</div><div class="stat-info"><h3>${totalPoints}</h3><p>${state.lang === 'ar' ? 'نقاطي' : 'My Points'}</p></div></div>
      <div class="stat-card gradient-cyan"><div class="stat-icon">📚</div><div class="stat-info"><h3>${pendingHw.length}</h3><p>${state.lang === 'ar' ? 'واجبات معلقة' : 'Pending Homework'}</p></div></div>
      <div class="stat-card gradient-green"><div class="stat-icon">🏆</div><div class="stat-info"><h3>${myRewards.length}</h3><p>${t('myRewards')}</p></div></div>
    </div>
    <div class="grid-2">
      <div class="card glass-card">
        <h3 class="card-title">${state.lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}</h3>
        <div class="quick-actions">
          <a href="#schedule" class="quick-action-btn"><span>📅</span><span>${t('mySchedule')}</span></a>
          <a href="#grades" class="quick-action-btn"><span>📝</span><span>${t('myGrades')}</span></a>
          <a href="#homework" class="quick-action-btn"><span>📚</span><span>${t('myHomework')}</span></a>
          <a href="#rewards" class="quick-action-btn"><span>⭐</span><span>${t('myRewards')}</span></a>
        </div>
      </div>
      <div class="card glass-card">
        <h3 class="card-title">${state.lang === 'ar' ? 'آخر الإعلانات' : 'Recent Announcements'}</h3>
        <div class="recent-list">
          ${state.announcements.slice(0, 4).map(a => `<div class="recent-item"><span class="recent-icon">📢</span><div><strong>${a.title}</strong></div></div>`).join('') || `<p class="text-muted text-center">${t('noData')}</p>`}
        </div>
      </div>
    </div>
  </div>`;
}

export function attachDashboardEvents() {
  document.getElementById('btn-mock-data')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const msg = state.lang === 'ar' ? 'هل أنت متأكد من إضافة بيانات تجريبية شاملة لجميع الأقسام؟' : 'Add comprehensive mock data for all modules?';
    if (confirm(msg)) {
      try {
        const btn = e.currentTarget;
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<span>⏳</span><span>جاري الإضافة...</span>';
        btn.style.pointerEvents = 'none';

        const { adminCreateUser } = await import('../services/adminService.js');
        const { setDoc, doc, addDoc, collection } = await import('../firebase-config.js');
        const { db } = await import('../firebase-config.js');

        // 1. Add Teachers
        const teachersData = [
          { name: 'أحمد محمود', email: 'ahmad@school.com', subjects: ['رياضيات', 'علوم'], phone: '0501234567', role: 'teacher', baseSalary: 5000 },
          { name: 'سارة خالد', email: 'sara@school.com', subjects: ['لغة عربية', 'تاريخ'], phone: '0501234568', role: 'teacher', baseSalary: 4500 }
        ];
        const teacherIds = [];
        for (let t of teachersData) {
          const uid = await adminCreateUser(t.email, '123456', 'teacher', t.name);
          await setDoc(doc(db, 'teachers', uid), { ...t, createdAt: new Date().toISOString() });
          teacherIds.push(uid);
        }

        // 2. Add Parents
        const parentsData = [
          { name: 'خالد عبدالله', email: 'khaled@parent.com', phone: '0509876543', role: 'parent' },
          { name: 'فاطمة علي', email: 'fatima@parent.com', phone: '0509876544', role: 'parent' }
        ];
        const parentIds = [];
        for (let p of parentsData) {
          const uid = await adminCreateUser(p.email, '123456', 'parent', p.name);
          await setDoc(doc(db, 'parents', uid), { ...p, createdAt: new Date().toISOString() });
          parentIds.push(uid);
        }

        // 3. Add Subjects
        const subjectsData = ['رياضيات', 'لغة عربية', 'علوم', 'لغة إنجليزية', 'تاريخ'];
        for (let s of subjectsData) {
          await addDoc(collection(db, 'subjects'), { name: s, code: 'SUBJ-'+Math.floor(Math.random()*1000) });
        }

        // 4. Add Students
        const studentsData = [
          { name: 'عمر خالد', email: 'omar@student.com', parentId: parentIds[0], role: 'student' },
          { name: 'محمد علي', email: 'mohammed@student.com', parentId: parentIds[1], role: 'student' }
        ];
        const studentIds = [];
        for (let s of studentsData) {
          const uid = await adminCreateUser(s.email, '123456', 'student', s.name);
          await setDoc(doc(db, 'students', uid), { ...s, createdAt: new Date().toISOString() });
          studentIds.push(uid);
        }

        // 5. Add Classes
        const classesData = [
          { name: 'الصف الأول - أ', grade: 'الصف الأول', teacherId: teacherIds[0] || '', studentIds: [studentIds[0], studentIds[1]] }
        ];
        const classIds = [];
        for (let c of classesData) {
          const docRef = await addDoc(collection(db, 'classes'), { ...c, createdAt: new Date().toISOString() });
          classIds.push(docRef.id);
        }

        // 6. Add Schedules
        const days = ['الاحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
        for (let day of days) {
          await addDoc(collection(db, 'schedules'), {
            classId: classIds[0],
            day: day,
            period: 'الحصة الأولى',
            subject: 'رياضيات',
            teacherId: teacherIds[0] || '',
            createdAt: new Date().toISOString()
          });
        }

        // 7. Add Library Books
        const booksData = [
          { title: 'العبرات', author: 'المنفلوطي', category: 'أدب', isbn: '978-1', total: 5, available: 5 },
          { title: 'مقدمة ابن خلدون', author: 'ابن خلدون', category: 'تاريخ', isbn: '978-2', total: 2, available: 2 }
        ];
        for (let b of booksData) await addDoc(collection(db, 'books'), { ...b, createdAt: new Date().toISOString() });

        // 8. Add Hostel Data
        const buildingRef = await addDoc(collection(db, 'buildings'), { name: 'مبنى أ', gender: 'male', createdAt: new Date().toISOString() });
        await addDoc(collection(db, 'rooms'), { buildingId: buildingRef.id, roomNumber: '101', capacity: 4, gender: 'male', bedAllocations: [], createdAt: new Date().toISOString() });

        // 9. Add Financial Data
        for (let sid of studentIds) {
          await addDoc(collection(db, 'fees'), { 
            studentId: sid, 
            amount: 5000, 
            paidAmount: 1000, 
            dueDate: new Date().toISOString().split('T')[0], 
            status: 'partial',
            createdAt: new Date().toISOString()
          });
        }

        // 10. Add Announcement
        await addDoc(collection(db, 'announcements'), {
          title: 'ترحيب بالعام الدراسي الجديد',
          body: 'نرحب بجميع الطلاب وأولياء الأمور والمعلمين في العام الدراسي الجديد.',
          targetRole: '',
          priority: 'high',
          sender: 'الإدارة',
          date: new Date().toISOString()
        });

        showToast(state.lang === 'ar' ? 'تمت إضافة البيانات التجريبية بنجاح لجميع الأقسام' : 'Comprehensive mock data added successfully', 'success');
        btn.innerHTML = oldHtml;
        btn.style.pointerEvents = 'auto';
      } catch (err) {
        console.error(err);
        showToast(t('errorOccurred'), 'error');
      }
    }
  });
}
