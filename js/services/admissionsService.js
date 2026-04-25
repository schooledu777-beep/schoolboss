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
    getDownloadURL 
} from '../firebase-config.js';

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
            querySnapshot.forEach((doc) => {
                applications.push({ id: doc.id, ...doc.data() });
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
            
            // Future: Webhook/Notification trigger logic goes here
            // if (newStatus === 'Enrolled') { ... }
            
        } catch (error) {
            console.error("Error transitioning status: ", error);
            throw error;
        }
    }
};
