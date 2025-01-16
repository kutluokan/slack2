import { useEffect, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { setUser, setLoading, setError } from '../store/slices/authSlice';
import { RootState } from '../store';
import { socket, connectSocket } from '../config/socket';

interface SyncedUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: number;
  lastLogin: number;
}

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, loading, error } = useSelector((state: RootState) => state.auth);
  const [initialAuthCheckDone, setInitialAuthCheckDone] = useState(false);

  const syncUserWithBackend = useCallback((firebaseUser: FirebaseUser) => {
    if (!firebaseUser) return;

    // Connect socket with user ID
    connectSocket(firebaseUser.uid);

    // Wait for socket connection before syncing
    socket.on('connect', () => {
      console.log('Syncing user data after connection...');
      // Only send non-null values
      const userData = {
        userId: firebaseUser.uid,
        ...(firebaseUser.email && { email: firebaseUser.email }),
        ...(firebaseUser.displayName && { displayName: firebaseUser.displayName }),
        ...(firebaseUser.photoURL && { photoURL: firebaseUser.photoURL }),
      };
      socket.emit('sync_user', userData);
    });

    socket.on('user_synced', (syncedUser: SyncedUser) => {
      console.log('User synced with backend:', syncedUser);
    });
  }, []);

  useEffect(() => {
    // Set initial loading state
    if (!initialAuthCheckDone) {
      dispatch(setLoading(true));
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        syncUserWithBackend(firebaseUser);
      } else {
        socket.disconnect();
      }
      dispatch(setUser(firebaseUser));
      
      // Only set loading to false after initial auth check
      if (!initialAuthCheckDone) {
        setInitialAuthCheckDone(true);
        dispatch(setLoading(false));
      }
    });

    return () => {
      unsubscribe();
      socket.off('connect');
      socket.off('user_synced');
    };
  }, [dispatch, syncUserWithBackend, initialAuthCheckDone]);

  const signInWithGoogle = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      dispatch(setError((error as Error).message));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const logout = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      await signOut(auth);
      socket.disconnect();
    } catch (error) {
      dispatch(setError((error as Error).message));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  return {
    user,
    loading: loading || !initialAuthCheckDone,
    error,
    signInWithGoogle,
    logout,
  };
}; 