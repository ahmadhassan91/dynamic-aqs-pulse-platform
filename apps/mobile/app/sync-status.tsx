import { Stack } from 'expo-router';
import { SyncStatusContent } from '@/components/sync-status-content';

export default function SyncStatusScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Sync Status', headerShown: true }} />
      <SyncStatusContent />
    </>
  );
}
