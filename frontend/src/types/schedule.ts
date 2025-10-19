export interface Scene {
  number: string;
  description: string;
  location?: string;
  duration: string;
  cast?: string[];
  equipment?: string[];
}

export interface Contacts {
  director?: string;
  cinematographer?: string;
  ad?: string;
  producer?: string;
  productionDesigner?: string;
  locationManager?: string;
  [key: string]: string | undefined;
}

export interface Schedule {
  id: string;
  shootingDate: Date | string;
  callTime: string;
  location: string;
  baseLocation?: string;
  sceneType: string;
  scenes?: Scene[];
  safetyNotes?: string;
  equipment?: string[];
  contacts?: Contacts;
  notes?: string;
  status?: 'confirmed' | 'pending' | 'cancelled';
  weather?: string;
  routeOptimized?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateScheduleRequest {
  shootingDate: Date;
  callTime: string;
  location: string;
  baseLocation?: string;
  sceneType: string;
  scenes?: Scene[];
  safetyNotes?: string;
  equipment?: string[];
  contacts?: Contacts;
  notes?: string;
}

export interface UpdateScheduleRequest extends Partial<CreateScheduleRequest> {
  id: string;
}