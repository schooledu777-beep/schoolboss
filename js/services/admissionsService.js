import { 
    db, 
    storage,
    collection, 
    addDoc, 
    updateDoc, 
    doc, 
    getDocs, 
    getDoc, 
    query, 
    where, 
    serverTimestamp,
    orderBy,
    ref, 
    uploadBytes, 
    getDownloadURL,
    setDoc
} from '../firebase-config.js';
import { adminCreateUser } from '../auth.js';

const COLLECTION_NAME = 'admission_applications';

export const admissionsService = {
    /**
     * Create a new admission application
     * @param {Object} data 
     * @returns {String} newly created application ID
     */
    async createApplication(data) {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                studentInfo: data.studentInfo,
                parentContact: data.parentContact,
                appliedGradeLevel: data.appliedGradeLevel,
                applicationDate: serverTimestamp(),
                status: 'Inquiry',
                notes: data.notes || '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error creating application: ", error);
            throw error;
        }
    },

    /**
     * Update an existing application
     * @param {String} applicationId 
     * @param {Object} data 
     */
    async updateApplication(applicationId, data) {
        try {
            const docRef = doc(db, COLLECTION_NAME, applicationId);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating application: ", error);
            throw error;
        }
    },

    /**
     * Fetch all applications, optionally filtered
     * @param {Object} filters - e.g. { status: 'Accepted' }
     * @returns {Array} List of applications
     */
    async getApplications(filters = {}) {
        try {
            let q = collection(db, COLLECTION_NAME);
            
            // Basic filtering if needed, though typically we pull all active and sort in UI for Kanban
            if (filters.status) {
                q = query(q, where("status", "==", filters.status));
            }
            
            // We can add orderBy if necessary, assuming indexes are built. 
            // For now, let's keep it simple.
            // q = query(q, orderBy("createdAt", "desc"));
            
            const querySnapshot = await getDocs(q);
            const applications = [];
            querySnapshot.forEach((docSnap) => {
                applications.push({ id: docSnap.id, ...docSnap.data() });
            });
            return applications;
        } catch (error) {
            console.error("Error fetching applications: ", error);
            throw error;
        }
    },

    /**
     * Fetch a single application by ID
     */
    async getApplicationById(applicationId) {
        try {
            const docRef = doc(db, COLLECTION_NAME, applicationId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            return null;
        } catch (error) {
            console.error("Error fetching application: ", error);
            throw error;
        }
    },

    /**
     * Upload a document for an application
     * @param {String} applicationId 
     * @param {File} file 
     * @param {String} documentType 
     */
    async uploadApplicationDocument(applicationId, file, documentType) {
        try {
            // 1. Upload to Storage
            const storageRef = ref(storage, `admissions/${applicationId}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const fileUrl = await getDownloadURL(snapshot.ref);

            // 2. Add to Subcollection
            const docsRef = collection(db, `${COLLECTION_NAME}/${applicationId}/documents`);
            await addDoc(docsRef, {
                documentType: documentType,
                fileName: file.name,
                fileUrl: fileUrl,
                uploadDate: serverTimestamp(),
                verified: false
            });
            
            return fileUrl;
        } catch (error) {
            console.error("Error uploading document: ", error);
            throw error;
        }
    },

    /**
     * Fetch documents for an application
     * @param {String} applicationId 
     */
    async getApplicationDocuments(applicationId) {
        try {
            const docsRef = collection(db, `${COLLECTION_NAME}/${applicationId}/documents`);
            const querySnapshot = await getDocs(docsRef);
            const documents = [];
            querySnapshot.forEach((docSnap) => {
                documents.push({ id: docSnap.id, ...docSnap.data() });
            });
            return documents;
        } catch (error) {
            console.error("Error fetching documents: ", error);
            throw error;
        }
    },

    /**
     * Transition application to a new status
     * @param {String} applicationId 
     * @param {String} newStatus 
     */
    async transitionApplicationStatus(applicationId, newStatus) {
        const validStatuses = [
            'Inquiry', 
            'Interview_Scheduled', 
            'Accepted', 
            'Waitlisted', 
            'Rejected', 
            'Fee_Paid', 
            'Enrolled'
        ];
        
        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Invalid status: ${newStatus}`);
        }

        try {
            const docRef = doc(db, COLLECTION_NAME, applicationId);
            await updateDoc(docRef, {
                status: newStatus,
                updatedAt: serverTimestamp()
            });
            
            // Automation: Trigger account creation when Enrolled
            if (newStatus === 'Enrolled') {
                const docSnap = await getDoc(docRef);
                const appData = docSnap.data();
                
                if (appData && !appData.accountsCreated) {
                    try {
                        const parentEmail = appData.parentContact.email || `parent_${applicationId}@school.local`;
                        const parentPassword = 'Password123!'; // Default password
                        const parentName = appData.parentContact.fullName;
                        const parentPhone = appData.parentContact.phoneNumber;
                        
                        // Create Parent Account
                        const parentUid = await adminCreateUser(parentEmail, parentPassword, 'parent', parentName);
                        await setDoc(doc(db, 'parents', parentUid), {
                            name: parentName,
                            email: parentEmail,
                            phone: parentPhone,
                            role: 'parent',
                            createdAt: new Date().toISOString()
                        });

                        // Create Student Account
                        const studentEmail = `student_${applicationId}@school.local`;
                        const studentPassword = 'Password123!';
                        const studentName = `${appData.studentInfo.firstName} ${appData.studentInfo.lastName}`;
                        
                        const studentUid = await adminCreateUser(studentEmail, studentPassword, 'student', studentName);
                        await setDoc(doc(db, 'students', studentUid), {
                            name: studentName,
                            email: studentEmail,
                            classId: '', // To be assigned later
                            gender: 'unknown',
                            dob: appData.studentInfo.dateOfBirth ? new Date(appData.studentInfo.dateOfBirth.seconds * 1000).toISOString().split('T')[0] : '',
                            parentId: parentUid,
                            role: 'student',
                            createdAt: new Date().toISOString()
                        });
                        
                        // Mark as created
                        await updateDoc(docRef, { accountsCreated: true });
                        console.log('Successfully created parent and student accounts for application:', applicationId);
                    } catch (accErr) {
                        console.error('Error creating automated accounts:', accErr);
                    }
                }
            }
            
        } catch (error) {
            console.error("Error transitioning status: ", error);
            throw error;
        }
    }
};
