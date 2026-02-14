
import { getDb } from "@/lib/firebase";
import type { Student, Faculty } from "@/lib/types";
import { collection, getDocs, addDoc, doc, writeBatch, deleteDoc, updateDoc, query, where, serverTimestamp, setDoc, getDoc, limit } from "firebase/firestore";

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

export async function getOrCreatePairingCode(userId: string): Promise<string> {
    const db = getDb();
    const q = query(collection(db, "pairing_codes"), where("userId", "==", userId), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) return snapshot.docs[0].id;

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    await setDoc(doc(db, "pairing_codes", newCode), { userId, createdAt: serverTimestamp() });
    return newCode;
}

export async function getUserIdFromCode(code: string): Promise<string | null> {
    const db = getDb();
    const docSnap = await getDoc(doc(db, "pairing_codes", code));
    return docSnap.exists() ? docSnap.data().userId : null;
}

export async function getStudents(userId: string): Promise<Student[]> {
  const db = getDb();
  const q = query(collection(db, "students"), where("userId", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
}

export async function addStudent(student: Omit<Student, "id">): Promise<string> {
  const db = getDb();
  const docRef = await addDoc(collection(db, "students"), sanitizeData(student));
  return docRef.id;
}

export async function updateStudent(studentId: string, data: Partial<Omit<Student, 'id'>>): Promise<void> {
    await updateDoc(doc(getDb(), "students", studentId), sanitizeData(data)); 
}

export async function deleteStudent(studentId: string): Promise<void> {
  await deleteDoc(doc(getDb(), "students", studentId));
}

export async function updateStudentsAttendance(updates: { studentId: string; attendance: Record<string, 'present' | 'absent'> }[]) {
  const db = getDb();
  const batch = writeBatch(db);
  updates.forEach(({ studentId, attendance }) => {
    batch.update(doc(db, "students", studentId), { attendance });
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
