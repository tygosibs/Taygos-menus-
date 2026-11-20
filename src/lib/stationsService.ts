import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  cleanStationId,
  DEFAULT_SEED_STATIONS,
  screenToStationId,
  StationTemplate,
} from './stationUtils';
import {
  Category,
  MenuItem,
  RestaurantStation,
  StaffActorInfo,
  StaffAuditEventType,
  StaffMember,
  StationIconName,
} from '../types/menu';

function makeStationDocId(name: string, nameEn?: string): string {
  const asciiSource = cleanStationId(nameEn || name);
  if (asciiSource && asciiSource.length >= 2) {
    return asciiSource;
  }
  return `st_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function makeAuditId(): string {
  return `slog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function subscribeRestaurantStations(
  restaurantId: string,
  onData: (stations: RestaurantStation[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!restaurantId) {
    onData([]);
    return () => {};
  }
  const ref = collection(db, 'restaurants', restaurantId, 'stations');
  return onSnapshot(
    ref,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as RestaurantStation), id: d.id }))
        .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function seedStarterStationsForRestaurant(params: {
  restaurantId: string;
  ownerId: string;
  actor: StaffActorInfo;
  templates?: StationTemplate[];
}): Promise<RestaurantStation[]> {
  const { restaurantId, ownerId, actor, templates = DEFAULT_SEED_STATIONS } = params;
  try {
    const existingSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'stations'));
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));
    const batch = writeBatch(db);
    const created: RestaurantStation[] = [];
    let orderCounter = existingSnap.size;

    templates.forEach((tpl) => {
      const stId = cleanStationId(tpl.suggestedId);
      if (!stId || existingIds.has(stId)) return;
      orderCounter += 1;
      const payload: RestaurantStation = {
        id: stId,
        stationId: stId,
        restaurantId,
        ownerId,
        name: tpl.name,
        nameEn: tpl.nameEn,
        color: tpl.color,
        icon: tpl.icon,
        isActive: true,
        sortOrder: orderCounter,
        createdBy: actor.uid,
      };
      batch.set(doc(db, 'restaurants', restaurantId, 'stations', stId), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      created.push(payload);
    });

    if (created.length > 0) {
      const logId = makeAuditId();
      batch.set(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
        id: logId,
        restaurantId,
        ownerId,
        eventType: 'station_created' satisfies StaffAuditEventType,
        actorUid: actor.uid,
        actorName: actor.name.slice(0, 100),
        actorRole: actor.role,
        screen: 'stations',
        details: `تمت تهيئة ${created.length} محطة تحضير أساسية`,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    }
    return created;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `restaurants/${restaurantId}/stations`);
  }
}

export async function saveRestaurantStation(params: {
  restaurantId: string;
  ownerId: string;
  actor: StaffActorInfo;
  station: {
    id?: string;
    stationId?: string;
    name: string;
    nameEn?: string;
    color: string;
    icon: StationIconName;
    isActive: boolean;
    sortOrder: number;
  };
}): Promise<RestaurantStation> {
  const { restaurantId, ownerId, actor, station } = params;
  const cleanName = station.name.trim().slice(0, 80);
  if (cleanName.length < 2) {
    throw new Error('اسم القسم الرئيسي يجب أن لا يقل عن حرفين.');
  }
  const cleanNameEn = (station.nameEn || '').trim().slice(0, 80);
  const cleanColor = /^#[0-9a-fA-F]{6}$/.test(station.color) ? station.color : '#EA580C';
  const isNew = !station.id;

  let stId = cleanStationId(station.id || station.stationId || makeStationDocId(cleanName, cleanNameEn));
  if (!stId) {
    stId = `st_${Date.now().toString(36)}`;
  }

  if (isNew) {
    const existingSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'stations'));
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));
    if (existingIds.has(stId)) {
      stId = `${stId}_${Math.random().toString(36).slice(2, 5)}`;
    }
  }

  const ref = doc(db, 'restaurants', restaurantId, 'stations', stId);

  try {
    if (isNew) {
      await setDoc(ref, {
        id: stId,
        stationId: stId,
        restaurantId,
        ownerId,
        name: cleanName,
        nameEn: cleanNameEn,
        color: cleanColor,
        icon: station.icon || 'chef-hat',
        isActive: Boolean(station.isActive),
        sortOrder: Number(station.sortOrder) || 1,
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: cleanName,
        nameEn: cleanNameEn,
        color: cleanColor,
        icon: station.icon || 'chef-hat',
        isActive: Boolean(station.isActive),
        sortOrder: Number(station.sortOrder) || 1,
        updatedAt: serverTimestamp(),
      });
    }

    const logId = makeAuditId();
    await setDoc(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId,
      ownerId,
      eventType: (isNew ? 'station_created' : 'station_updated') satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      screen: stId,
      details: isNew
        ? `تم إنشاء قسم رئيسي جديد: ${cleanName} (${stId})`
        : `تم تحديث القسم الرئيسي: ${cleanName} (${station.isActive ? 'نشط' : 'موقف'})`,
      createdAt: serverTimestamp(),
    });

    return {
      id: stId,
      stationId: stId,
      restaurantId,
      ownerId,
      name: cleanName,
      nameEn: cleanNameEn,
      color: cleanColor,
      icon: station.icon || 'chef-hat',
      isActive: Boolean(station.isActive),
      sortOrder: Number(station.sortOrder) || 1,
      createdBy: actor.uid,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `restaurants/${restaurantId}/stations/${stId}`);
  }
}

export async function reorderRestaurantStations(
  restaurantId: string,
  stations: RestaurantStation[]
): Promise<void> {
  if (!restaurantId || stations.length === 0) return;
  try {
    const batch = writeBatch(db);
    stations.forEach((st, idx) => {
      batch.update(doc(db, 'restaurants', restaurantId, 'stations', st.id), {
        sortOrder: idx + 1,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `restaurants/${restaurantId}/stations`);
  }
}

export async function deleteRestaurantStationChecked(params: {
  restaurantId: string;
  ownerId: string;
  station: RestaurantStation;
  actor: StaffActorInfo;
}): Promise<void> {
  const { restaurantId, ownerId, station, actor } = params;
  const targetId = cleanStationId(station.stationId || station.id);

  // Verify no linked categories, items, or staff members
  const [catsSnap, itemsSnap, staffSnap] = await Promise.all([
    getDocs(query(collection(db, 'categories'), where('restaurantId', '==', restaurantId))),
    getDocs(query(collection(db, 'menu_items'), where('restaurantId', '==', restaurantId))),
    getDocs(collection(db, 'restaurants', restaurantId, 'staff')),
  ]);

  const linkedCategories = catsSnap.docs
    .map((d) => d.data() as Category)
    .filter((c) => cleanStationId(c.stationId || c.station) === targetId);

  if (linkedCategories.length > 0) {
    throw new Error(
      `لا يمكن حذف قسم "${station.name}" لأنه مرتبط بـ ${linkedCategories.length} قسم في المنيو (${linkedCategories
        .slice(0, 2)
        .map((c) => c.name)
        .join('، ')}). انقل تلك الأقسام لمحطة أخرى أولاً.`
    );
  }

  const linkedItems = itemsSnap.docs
    .map((d) => d.data() as MenuItem)
    .filter((it) => cleanStationId(it.stationId || it.station) === targetId);

  if (linkedItems.length > 0) {
    throw new Error(
      `لا يمكن حذف قسم "${station.name}" لوجود ${linkedItems.length} صنف من المنيو مرتبط به حالياً. عدّل تصنيف الأصناف أولاً.`
    );
  }

  const linkedStaff = staffSnap.docs
    .map((d) => d.data() as StaffMember)
    .filter((m) => {
      if (m.role === 'manager') return false;
      const explicitStations = (m.allowedStations || []).map((s) => cleanStationId(s));
      const screenStations = (m.allowedScreens || [])
        .map((scr) => screenToStationId(scr))
        .filter((x): x is string => Boolean(x));
      return explicitStations.includes(targetId) || screenStations.includes(targetId);
    });

  if (linkedStaff.length > 0) {
    throw new Error(
      `لا يمكن حذف قسم "${station.name}" لوجود ${linkedStaff.length} موظف مرتبط به (${linkedStaff
        .slice(0, 2)
        .map((s) => s.name)
        .join('، ')}). أزل الصلاحية عنهم أولاً.`
    );
  }

  try {
    await deleteDoc(doc(db, 'restaurants', restaurantId, 'stations', station.id));
    const logId = makeAuditId();
    await setDoc(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId,
      ownerId,
      eventType: 'station_deleted' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      screen: targetId,
      details: `تم حذف القسم الرئيسي: ${station.name}`,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `restaurants/${restaurantId}/stations/${station.id}`);
  }
}
