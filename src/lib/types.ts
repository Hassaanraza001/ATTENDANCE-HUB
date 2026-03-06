
export interface Student {
  id: string;
  name: string;
  phone: string;
  fingerprintID: string;
  className: string;
  attendance: Record<string, 'present' | 'absent'>;
  rollNo: number;
  userId: string;
  notificationStatus?: 'pending' | 'sent';
}

export interface Faculty {
  id: string;
  name: string;
  phone: string;
  role: string;
  userId: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  instituteName: string;
  phoneNumber: string;
  updatedAt: any;
}
