import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import presenceReducer from './slices/presenceSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    presence: presenceReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;