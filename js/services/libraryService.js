import { state } from '../state.js';
import { db, collection, addDoc, updateDoc, doc, deleteDoc } from '../firebase-config.js';

export const libraryService = {
  async borrowBook(studentId, bookId, dueDate) {
    // Check if book is available
    const book = state.books.find(b => b.id === bookId);
    if (!book || book.status === 'borrowed') throw new Error('Book not available');

    await updateDoc(doc(db, 'books', bookId), { status: 'borrowed' });
    
    return await addDoc(collection(db, 'borrowing_records'), {
      studentId,
      bookId,
      borrowDate: new Date().toISOString().split('T')[0],
      dueDate,
      status: 'active',
      createdAt: new Date().toISOString()
    });
  },

  async returnBook(recordId) {
    const record = state.borrowingRecords.find(r => r.id === recordId);
    if (!record) return;

    const returnDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date(record.dueDate);
    const today = new Date(returnDate);

    // Update record
    await updateDoc(doc(db, 'borrowing_records', recordId), {
      status: 'returned',
      returnDate
    });

    // Mark book as available
    await updateDoc(doc(db, 'books', record.bookId), { status: 'available' });

    // Check for late fee
    if (today > dueDate) {
      const diffTime = Math.abs(today - dueDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const lateFeePerDay = 1.0; // Configurable
      const totalFee = diffDays * lateFeePerDay;

      // Add to student's primary financial ledger (fees table)
      await addDoc(collection(db, 'fees'), {
        studentId: record.studentId,
        amount: totalFee,
        paidAmount: 0,
        type: 'library_late_fee',
        description: `Late fee for book return (Record: ${recordId})`,
        dueDate: returnDate,
        createdAt: new Date().toISOString()
      });
    }
  },

  /**
   * Periodically check for late returns and generate fee records if not already generated.
   * This would typically be a Cloud Function, but here we can trigger it on Admin login.
   */
  async processOverdueFees() {
    const today = new Date();
    const overdueRecords = state.borrowingRecords.filter(r => 
      r.status === 'active' && 
      new Date(r.dueDate) < today &&
      !r.feeGenerated
    );

    for (const record of overdueRecords) {
      // Logic similar to returnBook but for active overdue items
      // For now, we'll wait until they return it to calculate the full fee,
      // OR we can generate a running fee. The requirement says "if a book is not returned by the due_date".
      // I'll implement a flat fee or daily trigger.
      
      // Implementation: Mark as "late" and notify.
      // The prompt says "generate a late fee record and append it directly to the student's primary financial ledger"
      // I'll do it when it becomes overdue (initial fine) or daily. 
      // Let's do a one-time late fee of $5 when it passes the due date.
      
      await addDoc(collection(db, 'fees'), {
        studentId: record.studentId,
        amount: 5.0, // Base late fee
        paidAmount: 0,
        type: 'library_late_fee',
        description: `Late return penalty for book (Overdue since ${record.dueDate})`,
        dueDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'borrowing_records', record.id), { feeGenerated: true });
    }
  }
};
