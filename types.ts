export enum Subject {
  ENGLISH = 'English',
  URDU = 'Urdu',
  MATHS = 'Mathematics',
  PHYSICS = 'Physics',
  CHEMISTRY = 'Chemistry',
  BIOLOGY = 'Biology',
  COMPUTER = 'Computer Science',
  GENERAL = 'General Help'
}

export interface Source {
  title: string;
  uri: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: Source[]; // For search grounding results
  imageUrl?: string; // For generated 3D visualizations
  imageError?: boolean; // Indicates if image generation failed
  isError?: boolean;
}

export type ImageStyle = 'Scientific' | 'Cartoon' | 'Realistic' | 'Blueprint' | 'Low Poly';

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  selectedSubject: Subject | null;
}