
export interface User {
  id: number | string;
  name: string;
  email: string;
  phoneNumber?: string;
  password?: string;
  admin: boolean;
  verified: boolean;
  totalFollowers?: number;
  totalFollowing?: number;
}

export interface Bot {
  id: string | number;
  name: string;
  slogan?: string;
  greeting?: string;
  personality: string;
  image: string; // Base64
  creatorName: string;
  creatorEmail: string;
  creatorId: string | number;
  isVerifiedCreator: boolean;
  isAdminCreator: boolean;
  timestamp: number;
  followers?: number;
  chatCount?: number;
  voice?: string;
  isColab?: boolean;
  collaborators?: string[]; // IDs/Names of collaborators
}

export interface ChatMessage {
  id?: string;
  content: string;
  senderName: string;
  creatorEmail: string;
  isVerified: boolean;
  isAdmin: boolean;
  timestamp: number;
  isPinned?: boolean;
  type?: 'text' | 'voice';
  audioUrl?: string;
}

export interface ColabDraft {
  id: string;
  name: string;
  slogan: string;
  personality: string;
  greeting: string;
  image: string | null;
  lastEditedBy: string;
  activeEditors: Record<string, boolean>;
}

export interface Character {
  id: string;
  name: string;
  tagline: string;
  bio: string;
  avatar: string;
  greeting: string;
  personality: string;
}

export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface Message {
  role: Role;
  content: string;
}

export interface SafetyResult {
  isIllegal: boolean;
  reason?: string;
}
