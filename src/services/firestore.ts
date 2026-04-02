
import { getDb } from "@/lib/firebase";
import type { Student, Faculty, UserProfile } from "@/lib/types";
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  writeBatch, 
  deleteDoc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp, 
  setDoc, 
  getDoc, 
  limit 
} from "firebase/firestore";

function sanitizeData(data: any) {
  const clean: any = {};
  const forbidden = ['id'];
  Object.keys(data).forEach(key => {
    if (!forbidden.includes(key) && data[key] !== undefined) {
      clean[key] = data[key];
    }
  });
  return clean;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const docRef = doc(getDb(), "institutes", userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as UserProfile;
  }
  return null;
}

export async function updateUserProfile(userId: string, data: Partial<Omit<UserProfile, 'id' | 'email'>>): Promise<void> {
  const docRef = doc(getDb(), "institutes", userId);
  await setDoc(docRef, { 
    ...sanitizeData(data), 
    updatedAt: serverTimestamp() 
  }, { merge: true });
}

export async function getStudents(userId: string): Promise<Student[]> {
  const db = getDb();
  const q = collection(db, "institutes", userId, "students");
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
}

export async function addStudent(userId: string, student: Omit<Student, "id">): Promise<string> {
  const db = getDb();
  const docRef = await addDoc(collection(db, "institutes", userId, "students"), sanitizeData(student));
  return docRef.id;
}

export async function updateStudent(userId: string, studentId: string, data: Partial<Omit<Student, 'id'>>): Promise<void> {
    await updateDoc(doc(getDb(), "institutes", userId, "students", studentId), sanitizeData(data)); 
}

export async function deleteStudent(userId: string, studentId: string): Promise<void> {
  await deleteDoc(doc(getDb(), "institutes", userId, "students", studentId));
}

export async function updateStudentsAttendance(userId: string, updates: { studentId: string; attendance: Record<string, 'present' | 'absent'> }[]) {
  const db = getDb();
  const batch = writeBatch(db);
  updates.forEach(({ studentId, attendance }) => {
    batch.update(doc(db, "institutes", userId, "students", studentId), { attendance });
  });
  await batch.commit();
}

export async function getFaculties(userId: string): Promise<Faculty[]> {
  const q = query(collection(getDb(), "faculties"), where("userId", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Faculty));
}

export async function addFaculty(faculty: Omit<Faculty, "id" >): Promise<string> {
  const docRef = await addDoc(collection(getDb(), "faculties"), sanitizeData(faculty));
  return docRef.id;
}

export async function updateFaculty(facultyId: string, data: Partial<Omit<Faculty, 'id'>>): Promise<void> {
    await updateDoc(doc(getDb(), "faculties", facultyId), sanitizeData(data)); 
}

export async function deleteFaculty(facultyId: string): Promise<void> {
  await deleteDoc(doc(getDb(), "faculties", facultyId));
}
