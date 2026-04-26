import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export function useAchievementEnforcer() {
  const userData = useStore(state => state.userData);
  const unlockAchievement = useStore(state => state.unlockAchievement);
  const tutorialStepCompleted = useStore(state => state.tutorialStepCompleted); // or better: check if tutorial is finished
  const tutorialLevel = useStore(state => state.tutorialLevel);

  useEffect(() => {
    if (!userData) return;

    // Early Adopter
    unlockAchievement('early_adopter');

    // VIP
    if (userData.role === 'admin' || userData.role === 'developer') {
      unlockAchievement('vip_member');
    }

    // Code Trainer
    if (tutorialLevel >= 3) { // assume 3 is finish or so
      unlockAchievement('code_trainer');
    }

    // Others like First Publish and Popular Creator require fetching apps authored by this user
    const checkAppAchievements = async () => {
      try {
        const appsRef = collection(db, 'apps');
        const q = query(appsRef, where("authorId", "==", userData.uid));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          unlockAchievement('first_publish');
          
          let totalDownloads = 0;
          snapshot.forEach(doc => {
            const data = doc.data();
            totalDownloads += (data.downloads || 0);
          });

          if (totalDownloads >= 10) {
            unlockAchievement('popular_creator');
          }
        }

        const assetsRef = collection(db, 'assets');
        const qAssets = query(assetsRef, where("authorId", "==", userData.uid));
        const assetsSnapshot = await getDocs(qAssets);
        if (!assetsSnapshot.empty) {
          unlockAchievement('trader');
        }
      } catch (err) {
        console.error("Failed to check app achievements", err);
      }
    };

    checkAppAchievements();
    
    // Gamer
    if (userData.installedApps && Object.keys(userData.installedApps).length > 0) {
      unlockAchievement('gamer');
    }
  }, [userData?.uid, userData?.role, tutorialLevel, userData?.installedApps, unlockAchievement]);
}
