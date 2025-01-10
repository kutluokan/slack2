import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { setUser, setLoading, setError } from '../store/slices/authSlice';
import { RootState } from '../store';

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, loading, error } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    dispatch(setLoading(true));
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      dispatch(setUser(user));
    });

    return () => unsubscribe();
  }, [dispatch]);

  const signInWithGoogle = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      dispatch(setError((error as Error).message));
    }
  }, [dispatch]);

  const logout = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      await signOut(auth);
    } catch (error) {
      dispatch(setError((error as Error).message));
    }
  }, [dispatch]);

  return {
    user,
    loading,
    error,
    signInWithGoogle,
    logout,
  };
}; 