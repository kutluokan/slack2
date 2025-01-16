import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type PresenceStatus = 'online' | 'away' | 'offline';

interface PresenceState {
  status: PresenceStatus;
  lastChanged: number | null;
}

const initialState: PresenceState = {
  status: 'offline',
  lastChanged: null,
};

const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    setPresenceStatus: (state, action: PayloadAction<PresenceStatus>) => {
      state.status = action.payload;
      state.lastChanged = Date.now();
    },
  },
});

export const { setPresenceStatus } = presenceSlice.actions;
export default presenceSlice.reducer; 