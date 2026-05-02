import { db, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from '../firebase-config.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';

// ========================= BUSES =========================
export async function saveBus(data, id = null) {
  if (id) {
    await updateDoc(doc(db, 'buses', id), data);
  } else {
    await addDoc(collection(db, 'buses'), data);
  }
}

export async function deleteBus(id) {
  await deleteDoc(doc(db, 'buses', id));
}

// ========================= ROUTES =========================
export async function saveRoute(data, id = null) {
  if (id) {
    await updateDoc(doc(db, 'routes', id), data);
  } else {
    await addDoc(collection(db, 'routes'), data);
  }
}

export async function deleteRoute(id) {
  await deleteDoc(doc(db, 'routes', id));
}

// ========================= ROUTE STUDENTS =========================
export async function assignStudent(data) {
  // Check if already assigned to this route
  const existing = state.routeStudents.find(rs => rs.studentId === data.studentId && rs.routeId === data.routeId);
  if (existing) throw new Error('already_assigned');
  return await addDoc(collection(db, 'route_students'), data);
}

export async function updateRouteStudent(id, data) {
  await updateDoc(doc(db, 'route_students', id), data);
}

export async function removeRouteStudent(id) {
  await deleteDoc(doc(db, 'route_students', id));
}

// ========================= TRANSPORT FEES =========================
export async function saveTransportFee(data, id = null) {
  if (id) {
    await updateDoc(doc(db, 'transport_fees', id), data);
  } else {
    await addDoc(collection(db, 'transport_fees'), data);
  }
}

export async function deleteTransportFee(id) {
  await deleteDoc(doc(db, 'transport_fees', id));
}

// Generate monthly fees for all active route students
export async function generateMonthlyFees(month, year) {
  const activeStudents = state.routeStudents.filter(rs => rs.status === 'active');
  let generated = 0;
  for (const rs of activeStudents) {
    const exists = state.transportFees.find(f =>
      f.studentId === rs.studentId && f.routeId === rs.routeId &&
      f.month === month && f.year === year
    );
    if (!exists) {
      const route = state.routes.find(r => r.id === rs.routeId);
      if (route) {
        await addDoc(collection(db, 'transport_fees'), {
          studentId: rs.studentId,
          routeId: rs.routeId,
          month, year,
          amount: route.monthlyCost || 0,
          paidAmount: 0,
          status: 'unpaid',
          createdAt: new Date().toISOString()
        });
        generated++;
      }
    }
  }
  return generated;
}

// ========================= STATS =========================
export function getTransportStats() {
  const totalBuses = state.buses.length;
  const activeBuses = state.buses.filter(b => b.status === 'active').length;
  const totalRoutes = state.routes.length;
  const totalStudents = state.routeStudents.filter(rs => rs.status === 'active').length;

  const fees = state.transportFees;
  const totalFees = fees.reduce((s, f) => s + (f.amount || 0), 0);
  const paidFees = fees.reduce((s, f) => s + (f.paidAmount || 0), 0);
  const collRate = totalFees > 0 ? Math.round((paidFees / totalFees) * 100) : 0;

  return { totalBuses, activeBuses, totalRoutes, totalStudents, totalFees, paidFees, collRate };
}
