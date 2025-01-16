import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getDatabase, ref, onDisconnect, set, onValue } from 'firebase/database';
import { RootState } from '../store';
import { setPresenceStatus, PresenceStatus } from '../store/slices/presenceSlice';

export const usePresence = (userId: string | undefined) => {
  const dispatch = useDispatch();
  const status = useSelector((state: RootState) => state.presence.status);

  useEffect(() => {
    if (!userId) return;

    console.log('Setting up presence for user:', userId);
    const db = getDatabase();
    const presenceRef = ref(db, `presence/${userId}`);
    const userStatusRef = ref(db, `.info/connected`);

    // Set initial presence
    set(presenceRef, {
      status: 'online',
      lastChanged: new Date().toISOString(),
    });
    dispatch(setPresenceStatus('online'));

    // When the client's connection state changes
    const unsubscribe = onValue(userStatusRef, (snapshot) => {
      console.log('Connection state changed:', snapshot.val());
      if (snapshot.val() === false) {
        return;
      }

      // When the client disconnects, update the presence data
      onDisconnect(presenceRef)
        .set({
          status: 'offline',
          lastChanged: new Date().toISOString(),
        })
        .then(() => {
          console.log('Setting online status for:', userId);
          // Client is connected (or reconnected)
          // Update presence data
          set(presenceRef, {
            status: 'online',
            lastChanged: new Date().toISOString(),
          });
          dispatch(setPresenceStatus('online'));
        });
    });

    return () => {
      console.log('Cleaning up presence for user:', userId);
      unsubscribe();
      // Clean up presence when component unmounts
      set(presenceRef, {
        status: 'offline',
        lastChanged: new Date().toISOString(),
      });
    };
  }, [userId, dispatch]);

  const updatePresence = async (newStatus: PresenceStatus) => {
    if (!userId) return;

    console.log('Manually updating presence for user:', userId, 'to status:', newStatus);
    const db = getDatabase();
    const presenceRef = ref(db, `presence/${userId}`);

    await set(presenceRef, {
      status: newStatus,
      lastChanged: new Date().toISOString(),
    });
    dispatch(setPresenceStatus(newStatus));
  };

  return {
    status,
    updatePresence,
  };
}; 