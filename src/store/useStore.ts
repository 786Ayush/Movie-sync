import { create } from 'zustand';

interface VideoState {
  url: string;
  playing: boolean;
  currentTime: number;
}

interface User {
  name: string;
  socketId: string;
}

interface AppState {
  userName: string;
  roomId: string;
  users: User[];
  messages: Array<{ id: string; senderId: string; senderName: string; text: string; timestamp: number }>;
  videoState: VideoState;
  
  hostId: string;
  
  setUserName: (val: string) => void;
  setRoomId: (val: string) => void;
  setUsers: (users: User[]) => void;
  setHostId: (id: string) => void;
  addUser: (user: User) => void;
  removeUser: (socketId: string) => void;
  addMessage: (msg: any) => void;
  setVideoState: (state: Partial<VideoState>) => void;
}

export const useStore = create<AppState>((set) => ({
  userName: '',
  roomId: '',
  users: [],
  hostId: '',
  messages: [],
  videoState: {
    url: '',
    playing: false,
    currentTime: 0,
  },

  setUserName: (val) => set({ userName: val }),
  setRoomId: (val) => set({ roomId: val }),
  setUsers: (users) => set({ users }),
  setHostId: (id) => set({ hostId: id }),
  addUser: (user) => set((state) => ({ users: [...state.users, user] })),
  removeUser: (socketId) => set((state) => ({ users: state.users.filter(u => u.socketId !== socketId) })),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setVideoState: (newState) => set((state) => ({ videoState: { ...state.videoState, ...newState } })),
}));
