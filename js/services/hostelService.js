import { state } from '../state.js';
import { db, collection, addDoc, updateDoc, doc, deleteDoc } from '../firebase-config.js';

export const hostelService = {
  async allocateBed(studentId, roomId, buildingId) {
    const room = state.rooms.find(r => r.id === roomId);
    if (!room) throw new Error('Room not found');

    const currentAllocations = state.bedAllocations.filter(a => a.roomId === roomId && a.status === 'active');
    
    if (currentAllocations.length >= Number(room.capacity)) {
      throw new Error('Room is at full capacity');
    }

    // Check if student already has an allocation
    const existing = state.bedAllocations.find(a => a.studentId === studentId && a.status === 'active');
    if (existing) throw new Error('Student already assigned to a room');

    return await addDoc(collection(db, 'bed_allocations'), {
      studentId,
      roomId,
      buildingId,
      allocationDate: new Date().toISOString(),
      status: 'active',
      createdAt: new Date().toISOString()
    });
  },

  async deallocateBed(allocationId) {
    return await updateDoc(doc(db, 'bed_allocations', allocationId), {
      status: 'released',
      releaseDate: new Date().toISOString()
    });
  }
};
