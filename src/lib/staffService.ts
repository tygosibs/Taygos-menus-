import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Restaurant,
  StaffAccess,
  StaffActorInfo,
  StaffAuditEventType,
  StaffAuditLog,
  StaffInvite,
  StaffMember,
  StaffRole,
  StaffScreen,
} from '../types/menu';
import {
  auth,
  createStaffSecondaryUser,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  classifyLoginIdentifier,
  deriveInviteBootstrapPassword,
  generateSecureInviteToken,
  getLoginLockoutState,
  normalizeStaffPhone,
  recordLoginFailure,
  resetLoginFailures,
  sanitizeStaffUsername,
  sha256Hex,
  validateStaffPassword,
} from './staffAuthUtils';
import { cleanStationId, screenToStationId } from './stationUtils';

function makeStaffDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

function getTsMillis(ts: unknown): number {
  if (!ts) return 0;
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === 'object' && 'seconds' in ts && typeof (ts as { seconds: number }).seconds === 'number') {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return 0;
}

async function buildLoginIndexId(
  kind: 'u' | 'p' | 'e',
  restaurantId: string,
  normalizedValue: string
): Promise<string> {
  const hash = await sha256Hex(`${kind}:${restaurantId}:${normalizedValue}`);
  return `${kind}_${hash.slice(0, 44)}`;
}

function buildSyntheticStaffAuthEmail(username: string, restaurantId: string, suffix = ''): string {
  const restShort = restaurantId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toLowerCase() || 'rest';
  const userPart = username.replace(/[^a-z0-9._-]/g, '').slice(0, 24) || 'staff';
  const extra = suffix ? `.${suffix}` : '';
  return `${userPart}.${restShort}${extra}@staff.sufra.local`;
}

export async function fetchRestaurantBySlugForStaff(slug: string): Promise<Restaurant | null> {
  const cleanSlug = (slug || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (!cleanSlug) return null;
  try {
    const slugSnap = await getDoc(doc(db, 'slugs', cleanSlug));
    if (!slugSnap.exists()) return null;
    const { restaurantId } = slugSnap.data() as { restaurantId: string };
    const restSnap = await getDoc(doc(db, 'restaurants', restaurantId));
    if (!restSnap.exists()) return null;
    return { ...(restSnap.data() as Restaurant), id: restSnap.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `slugs/${cleanSlug}`);
  }
}

export async function resolveStaffAuthEmail(
  restaurantId: string,
  rawIdentifier: string
): Promise<{ authEmail: string; staffUid?: string; isActive?: boolean; identifierType: 'email' | 'phone' | 'username' }> {
  const classified = classifyLoginIdentifier(rawIdentifier);
  if (!classified.normalized) {
    throw new Error('يرجى إدخال اسم المستخدم أو رقم الهاتف أو البريد الإلكتروني.');
  }

  if (classified.type === 'email') {
    const lookupId = await buildLoginIndexId('e', restaurantId, classified.normalized);
    try {
      const snap = await getDoc(doc(db, 'restaurants', restaurantId, 'staff_login_index', lookupId));
      if (snap.exists()) {
        const data = snap.data() as { authEmail: string; staffUid: string; isActive: boolean };
        return {
          authEmail: data.authEmail,
          staffUid: data.staffUid,
          isActive: data.isActive,
          identifierType: 'email',
        };
      }
    } catch {
      // Fallback to direct Auth attempt with entered email
    }
    return {
      authEmail: classified.normalized,
      identifierType: 'email',
    };
  }

  const kind = classified.type === 'phone' ? 'p' : 'u';
  const lookupId = await buildLoginIndexId(kind, restaurantId, classified.normalized);
  const lookupSnap = await getDoc(
    doc(db, 'restaurants', restaurantId, 'staff_login_index', lookupId)
  );
  if (!lookupSnap.exists()) {
    throw new Error(
      classified.type === 'phone'
        ? 'بيانات الدخول غير صحيحة أو رقم الهاتف غير مسجل في هذا المطعم.'
        : 'بيانات الدخول غير صحيحة أو اسم المستخدم غير مسجل في هذا المطعم.'
    );
  }
  const data = lookupSnap.data() as { authEmail: string; staffUid: string; isActive: boolean };
  return {
    authEmail: data.authEmail,
    staffUid: data.staffUid,
    isActive: data.isActive,
    identifierType: classified.type,
  };
}

export interface CreateStaffInput {
  restaurant: Restaurant;
  actor: StaffActorInfo;
  name: string;
  username: string;
  phone: string;
  email?: string;
  jobTitle?: string;
  role: StaffRole;
  allowedScreens: StaffScreen[];
  allowedStations?: string[];
  defaultScreen: StaffScreen;
  defaultStationId?: string;
  hallId?: string;
  hallName?: string;
  useOneTimeInvite: boolean;
  directPassword?: string;
}

export interface CreatedStaffResult {
  staff: StaffMember;
  inviteToken?: string;
  inviteUrl?: string;
  expiresAtMs?: number;
}

export async function createManagerOrStaffAccount(
  input: CreateStaffInput
): Promise<CreatedStaffResult> {
  const cleanName = input.name.trim().slice(0, 100);
  const cleanUsername = sanitizeStaffUsername(input.username);
  const cleanPhone = normalizeStaffPhone(input.phone);
  const cleanEmail = (input.email || '').trim().toLowerCase().slice(0, 254);
  const cleanJobTitle = (input.jobTitle || '').trim().slice(0, 80);

  if (cleanName.length < 2) {
    throw new Error('يرجى إدخال اسم الموظف (حرفين على الأقل).');
  }
  if (cleanUsername.length < 3) {
    throw new Error('اسم المستخدم يجب أن يكون بالإنجليزية والأرقام (3 أحرف على الأقل).');
  }
  if (cleanPhone.length < 6) {
    throw new Error('يرجى إدخال رقم هاتف صحيح (6 أرقام على الأقل).');
  }
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('صيغة البريد الإلكتروني غير صحيحة.');
  }

  if (!input.useOneTimeInvite) {
    const pwCheck = validateStaffPassword(input.directPassword || '');
    if (!pwCheck.valid) {
      throw new Error(pwCheck.error || 'كلمة المرور غير مطابقة لشروط الأمان.');
    }
  }

  const allowedScreens = Array.from(
    new Set<StaffScreen>(
      input.role === 'manager'
        ? input.allowedScreens.length > 0
          ? input.allowedScreens
          : ['staff_management', 'cashier', 'kitchen', 'bar', 'pastry', 'captain', 'halls']
        : input.allowedScreens.filter((s) => s !== 'staff_management')
    )
  ).slice(0, 30);

  if (allowedScreens.length === 0) {
    throw new Error('يرجى اختيار شاشة واحدة على الأقل للموظف.');
  }
  const defaultScreen: StaffScreen = allowedScreens.includes(input.defaultScreen)
    ? input.defaultScreen
    : allowedScreens[0];

  const derivedStations = new Set<string>();
  (input.allowedStations || []).forEach((s) => {
    const clean = cleanStationId(s);
    if (clean) derivedStations.add(clean);
  });
  allowedScreens.forEach((scr) => {
    const st = screenToStationId(scr);
    if (st) derivedStations.add(st);
  });
  const allowedStations = Array.from(derivedStations).slice(0, 30);
  const defaultStationId =
    cleanStationId(input.defaultStationId) ||
    screenToStationId(defaultScreen) ||
    allowedStations[0] ||
    '';

  const [uLookupId, pLookupId, eLookupId] = await Promise.all([
    buildLoginIndexId('u', input.restaurant.id, cleanUsername),
    buildLoginIndexId('p', input.restaurant.id, cleanPhone),
    cleanEmail ? buildLoginIndexId('e', input.restaurant.id, cleanEmail) : Promise.resolve(''),
  ]);

  const [uSnap, pSnap, eSnap] = await Promise.all([
    getDoc(doc(db, 'restaurants', input.restaurant.id, 'staff_login_index', uLookupId)),
    getDoc(doc(db, 'restaurants', input.restaurant.id, 'staff_login_index', pLookupId)),
    eLookupId
      ? getDoc(doc(db, 'restaurants', input.restaurant.id, 'staff_login_index', eLookupId))
      : Promise.resolve(null),
  ]);

  if (uSnap.exists()) {
    throw new Error('اسم المستخدم مسجل بالفعل لموظف آخر في هذا المطعم. اختر اسماً مختلفاً.');
  }
  if (pSnap.exists()) {
    throw new Error('رقم الهاتف مسجل بالفعل لموظف آخر في هذا المطعم.');
  }
  if (eSnap && eSnap.exists()) {
    throw new Error('البريد الإلكتروني مسجل بالفعل لموظف آخر في هذا المطعم.');
  }

  const inviteToken = input.useOneTimeInvite ? generateSecureInviteToken() : undefined;
  const tokenHash = inviteToken ? await sha256Hex(inviteToken) : undefined;
  const initialPassword = inviteToken
    ? await deriveInviteBootstrapPassword(inviteToken, input.restaurant.id)
    : (input.directPassword || '').trim();

  // If manager supplied a real email AND uses direct password, we can use that email OR a collision-safe synthetic email mapped via e_ index.
  // Using synthetic authEmail avoids "auth/email-already-in-use" across multi-restaurant tenants while still supporting login via real email using staff_login_index!
  const authEmail =
    cleanEmail && !input.useOneTimeInvite
      ? cleanEmail
      : buildSyntheticStaffAuthEmail(cleanUsername, input.restaurant.id);

  let staffUid: string;
  try {
    const authUser = await createStaffSecondaryUser({
      email: authEmail,
      password: initialPassword,
      displayName: cleanName,
    });
    staffUid = authUser.uid;
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('email-already-in-use')) {
      throw new Error(
        'هذا البريد الإلكتروني مستخدم بالفعل في Firebase Auth. اترك البريد اختيارياً أو استخدم دعوة QR لمرة واحدة.'
      );
    }
    throw err;
  }

  const expiresAtMs = Date.now() + 24 * 60 * 60 * 1000;
  const isActiveInitial = !input.useOneTimeInvite;

  const staffPayload: Record<string, unknown> = {
    uid: staffUid,
    restaurantId: input.restaurant.id,
    ownerId: input.restaurant.ownerId,
    name: cleanName,
    username: cleanUsername,
    phone: cleanPhone,
    email: cleanEmail,
    authEmail,
    jobTitle: cleanJobTitle,
    role: input.role,
    allowedScreens,
    allowedStations,
    defaultScreen,
    defaultStationId,
    hallId: (input.hallId || '').trim().slice(0, 128),
    hallName: (input.hallName || '').trim().slice(0, 80),
    isActive: isActiveInitial,
    mustChangePassword: input.useOneTimeInvite,
    activeInviteHash: tokenHash || '',
    createdBy: input.actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const accessPayload: Record<string, unknown> = {
    uid: staffUid,
    restaurantId: input.restaurant.id,
    ownerId: input.restaurant.ownerId,
    role: input.role,
    allowedScreens,
    allowedStations,
    defaultScreen,
    defaultStationId,
    hallId: (input.hallId || '').trim().slice(0, 128),
    isActive: isActiveInitial,
    mustChangePassword: input.useOneTimeInvite,
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'restaurants', input.restaurant.id, 'staff', staffUid),
      staffPayload
    );
    batch.set(doc(db, 'staff_access', staffUid), accessPayload);

    const commonLookup = {
      restaurantId: input.restaurant.id,
      ownerId: input.restaurant.ownerId,
      staffUid,
      authEmail,
      isActive: isActiveInitial,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    batch.set(
      doc(db, 'restaurants', input.restaurant.id, 'staff_login_index', uLookupId),
      { id: uLookupId, ...commonLookup }
    );
    batch.set(
      doc(db, 'restaurants', input.restaurant.id, 'staff_login_index', pLookupId),
      { id: pLookupId, ...commonLookup }
    );
    if (eLookupId) {
      batch.set(
        doc(db, 'restaurants', input.restaurant.id, 'staff_login_index', eLookupId),
        { id: eLookupId, ...commonLookup }
      );
    }

    if (tokenHash) {
      batch.set(
        doc(db, 'restaurants', input.restaurant.id, 'staff_invites', tokenHash),
        {
          id: tokenHash,
          staffId: staffUid,
          restaurantId: input.restaurant.id,
          ownerId: input.restaurant.ownerId,
          restaurantSlug: input.restaurant.slug,
          restaurantName: input.restaurant.name.slice(0, 120),
          restaurantName_en: (input.restaurant.name_en || '').slice(0, 120),
          tokenHash,
          authEmail,
          staffName: cleanName,
          staffUsername: cleanUsername,
          staffPhone: cleanPhone,
          staffEmail: cleanEmail,
          staffRole: input.role,
          staffJobTitle: cleanJobTitle,
          staffHallId: (input.hallId || '').trim().slice(0, 128),
          staffHallName: (input.hallName || '').trim().slice(0, 80),
          allowedScreens,
          allowedStations,
          defaultScreen,
          defaultStationId,
          expiresAt: Timestamp.fromMillis(expiresAtMs),
          createdBy: input.actor.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
    }

    const logId = makeStaffDocId('slog');
    batch.set(
      doc(db, 'restaurants', input.restaurant.id, 'staff_audit_logs', logId),
      {
        id: logId,
        restaurantId: input.restaurant.id,
        ownerId: input.restaurant.ownerId,
        eventType: 'staff_created' satisfies StaffAuditEventType,
        actorUid: input.actor.uid,
        actorName: input.actor.name.slice(0, 100),
        actorRole: input.actor.role,
        targetUid: staffUid,
        targetName: cleanName,
        screen: 'staff_management',
        details: `تم إنشاء حساب ${input.role} (${cleanUsername})`,
        ...(tokenHash ? { inviteHash: tokenHash } : {}),
        createdAt: serverTimestamp(),
      }
    );

    if (tokenHash) {
      const inviteLogId = makeStaffDocId('slog');
      batch.set(
        doc(db, 'restaurants', input.restaurant.id, 'staff_audit_logs', inviteLogId),
        {
          id: inviteLogId,
          restaurantId: input.restaurant.id,
          ownerId: input.restaurant.ownerId,
          eventType: 'invite_created' satisfies StaffAuditEventType,
          actorUid: input.actor.uid,
          actorName: input.actor.name.slice(0, 100),
          actorRole: input.actor.role,
          targetUid: staffUid,
          targetName: cleanName,
          screen: 'staff_management',
          details: 'تم إنشاء رابط دعوة QR صالح لمرة واحدة ولمدة 24 ساعة',
          inviteHash: tokenHash,
          createdAt: serverTimestamp(),
        }
      );
    }

    await batch.commit();

    const staffMember: StaffMember = {
      uid: staffUid,
      restaurantId: input.restaurant.id,
      ownerId: input.restaurant.ownerId,
      name: cleanName,
      username: cleanUsername,
      phone: cleanPhone,
      email: cleanEmail,
      authEmail,
      jobTitle: cleanJobTitle,
      role: input.role,
      allowedScreens,
      allowedStations,
      defaultScreen,
      defaultStationId,
      hallId: input.hallId || '',
      hallName: input.hallName || '',
      isActive: isActiveInitial,
      mustChangePassword: input.useOneTimeInvite,
      activeInviteHash: tokenHash || '',
      createdBy: input.actor.uid,
    };

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = inviteToken
      ? `${origin}/staff/${input.restaurant.slug}/onboarding?invite=${encodeURIComponent(inviteToken)}`
      : undefined;

    return {
      staff: staffMember,
      inviteToken,
      inviteUrl,
      expiresAtMs: inviteToken ? expiresAtMs : undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `restaurants/${input.restaurant.id}/staff/${staffUid}`);
  }
}

export async function regenerateStaffInvite(params: {
  restaurant: Restaurant;
  existingStaff: StaffMember;
  actor: StaffActorInfo;
}): Promise<CreatedStaffResult> {
  const { restaurant, existingStaff, actor } = params;
  const inviteToken = generateSecureInviteToken();
  const tokenHash = await sha256Hex(inviteToken);
  const bootstrapPassword = await deriveInviteBootstrapPassword(inviteToken, restaurant.id);
  const nonce = Math.random().toString(36).slice(2, 6);
  const newAuthEmail = buildSyntheticStaffAuthEmail(
    existingStaff.username,
    restaurant.id,
    nonce
  );

  const authUser = await createStaffSecondaryUser({
    email: newAuthEmail,
    password: bootstrapPassword,
    displayName: existingStaff.name,
  });
  const newUid = authUser.uid;
  const expiresAtMs = Date.now() + 24 * 60 * 60 * 1000;

  let oldInviteExists = false;
  if (existingStaff.activeInviteHash) {
    try {
      const oldInviteSnap = await getDoc(
        doc(db, 'restaurants', restaurant.id, 'staff_invites', existingStaff.activeInviteHash)
      );
      oldInviteExists = oldInviteSnap.exists();
    } catch {
      oldInviteExists = false;
    }
  }

  const [uLookupId, pLookupId, eLookupId] = await Promise.all([
    buildLoginIndexId('u', restaurant.id, existingStaff.username),
    buildLoginIndexId('p', restaurant.id, existingStaff.phone),
    existingStaff.email
      ? buildLoginIndexId('e', restaurant.id, existingStaff.email.toLowerCase())
      : Promise.resolve(''),
  ]);

  try {
    const batch = writeBatch(db);

    if (oldInviteExists && existingStaff.activeInviteHash) {
      batch.update(
        doc(db, 'restaurants', restaurant.id, 'staff_invites', existingStaff.activeInviteHash),
        {
          revokedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
    }

    // Remove old staff + access docs so old UID loses access immediately and list stays 1:1 clean
    batch.delete(doc(db, 'restaurants', restaurant.id, 'staff', existingStaff.uid));
    batch.delete(doc(db, 'staff_access', existingStaff.uid));

    const newStaffPayload: Record<string, unknown> = {
      uid: newUid,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      name: existingStaff.name,
      username: existingStaff.username,
      phone: existingStaff.phone,
      email: existingStaff.email || '',
      authEmail: newAuthEmail,
      jobTitle: existingStaff.jobTitle || '',
      role: existingStaff.role,
      allowedScreens: existingStaff.allowedScreens,
      allowedStations: existingStaff.allowedStations || [],
      defaultScreen: existingStaff.defaultScreen,
      defaultStationId: existingStaff.defaultStationId || '',
      hallId: existingStaff.hallId || '',
      hallName: existingStaff.hallName || '',
      isActive: false,
      mustChangePassword: true,
      activeInviteHash: tokenHash,
      createdBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    batch.set(doc(db, 'restaurants', restaurant.id, 'staff', newUid), newStaffPayload);
    batch.set(doc(db, 'staff_access', newUid), {
      uid: newUid,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      role: existingStaff.role,
      allowedScreens: existingStaff.allowedScreens,
      allowedStations: existingStaff.allowedStations || [],
      defaultScreen: existingStaff.defaultScreen,
      defaultStationId: existingStaff.defaultStationId || '',
      hallId: existingStaff.hallId || '',
      isActive: false,
      mustChangePassword: true,
      updatedAt: serverTimestamp(),
    });

    const commonLookup = {
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      staffUid: newUid,
      authEmail: newAuthEmail,
      isActive: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    batch.set(
      doc(db, 'restaurants', restaurant.id, 'staff_login_index', uLookupId),
      { id: uLookupId, ...commonLookup }
    );
    batch.set(
      doc(db, 'restaurants', restaurant.id, 'staff_login_index', pLookupId),
      { id: pLookupId, ...commonLookup }
    );
    if (eLookupId) {
      batch.set(
        doc(db, 'restaurants', restaurant.id, 'staff_login_index', eLookupId),
        { id: eLookupId, ...commonLookup }
      );
    }

    batch.set(doc(db, 'restaurants', restaurant.id, 'staff_invites', tokenHash), {
      id: tokenHash,
      staffId: newUid,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      restaurantSlug: restaurant.slug,
      restaurantName: restaurant.name.slice(0, 120),
      restaurantName_en: (restaurant.name_en || '').slice(0, 120),
      tokenHash,
      authEmail: newAuthEmail,
      staffName: existingStaff.name,
      staffUsername: existingStaff.username,
      staffPhone: existingStaff.phone,
      staffEmail: existingStaff.email || '',
      staffRole: existingStaff.role,
      staffJobTitle: existingStaff.jobTitle || '',
      staffHallId: existingStaff.hallId || '',
      staffHallName: existingStaff.hallName || '',
      allowedScreens: existingStaff.allowedScreens,
      allowedStations: existingStaff.allowedStations || [],
      defaultScreen: existingStaff.defaultScreen,
      defaultStationId: existingStaff.defaultStationId || '',
      expiresAt: Timestamp.fromMillis(expiresAtMs),
      createdBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const logId = makeStaffDocId('slog');
    batch.set(doc(db, 'restaurants', restaurant.id, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      eventType: 'invite_created' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      targetUid: newUid,
      targetName: existingStaff.name,
      screen: 'staff_management',
      details: 'تمت إعادة إصدار رابط دعوة QR جديد وإلغاء الوصول السابق',
      inviteHash: tokenHash,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${origin}/staff/${restaurant.slug}/onboarding?invite=${encodeURIComponent(inviteToken)}`;

    return {
      staff: {
        ...existingStaff,
        uid: newUid,
        authEmail: newAuthEmail,
        isActive: false,
        mustChangePassword: true,
        activeInviteHash: tokenHash,
      },
      inviteToken,
      inviteUrl,
      expiresAtMs,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `restaurants/${restaurant.id}/staff_invites/${tokenHash}`);
  }
}

export function canResetStaffViaEmail(
  member: Pick<StaffMember, 'email' | 'authEmail'>
): boolean {
  const cleanEmail = (member.email || '').trim().toLowerCase();
  const cleanAuthEmail = (member.authEmail || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return false;
  }
  if (!cleanAuthEmail || cleanAuthEmail.endsWith('@staff.sufra.local')) {
    return false;
  }
  return cleanAuthEmail === cleanEmail;
}

export async function sendStaffPasswordResetByEmail(
  email: string,
  authEmail?: string
): Promise<void> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('لا يوجد بريد إلكتروني صالح مسجل لهذا الموظف.');
  }
  if (authEmail !== undefined) {
    const cleanAuth = authEmail.trim().toLowerCase();
    if (!cleanAuth || cleanAuth.endsWith('@staff.sufra.local') || cleanAuth !== cleanEmail) {
      throw new Error(
        'هذا الحساب مفعّل بدعوة QR برقم/اسم مستخدم داخلي (@staff.sufra.local). لإعادة تعيين كلمة المرور استخدم زر "دعوة QR جديد / تصفير".'
      );
    }
  }
  await sendPasswordResetEmail(auth, cleanEmail);
}

export async function updateStaffPermissionsAndProfile(params: {
  restaurantId: string;
  staff: StaffMember;
  actor: StaffActorInfo;
  updates: {
    name?: string;
    phone?: string;
    email?: string;
    jobTitle?: string;
    role?: StaffRole;
    allowedScreens?: StaffScreen[];
    allowedStations?: string[];
    defaultScreen?: StaffScreen;
    defaultStationId?: string;
    hallId?: string;
    hallName?: string;
    isActive?: boolean;
  };
}): Promise<void> {
  const { restaurantId, staff, actor, updates } = params;
  const nextName = (updates.name ?? staff.name).trim().slice(0, 100);
  const nextPhone = normalizeStaffPhone(updates.phone ?? staff.phone);
  const nextEmail = (updates.email ?? staff.email ?? '').trim().toLowerCase().slice(0, 254);
  const nextJobTitle = (updates.jobTitle ?? staff.jobTitle ?? '').trim().slice(0, 80);
  const nextRole = updates.role ?? staff.role;
  const rawScreens = updates.allowedScreens ?? staff.allowedScreens;
  const nextScreens = Array.from(
    new Set<StaffScreen>(
      nextRole === 'manager'
        ? rawScreens.length > 0
          ? rawScreens
          : ['staff_management', 'cashier', 'kitchen', 'bar', 'pastry', 'captain', 'halls']
        : rawScreens.filter((s) => s !== 'staff_management')
    )
  ).slice(0, 30);

  if (nextScreens.length === 0) {
    throw new Error('يجب تحديد شاشة واحدة على الأقل للموظف.');
  }
  const candidateDefault = updates.defaultScreen ?? staff.defaultScreen;
  const nextDefault = nextScreens.includes(candidateDefault) ? candidateDefault : nextScreens[0];

  const derivedStations = new Set<string>();
  (updates.allowedStations ?? staff.allowedStations ?? []).forEach((s) => {
    const clean = cleanStationId(s);
    if (clean) derivedStations.add(clean);
  });
  nextScreens.forEach((scr) => {
    const st = screenToStationId(scr);
    if (st) derivedStations.add(st);
  });
  const nextStations = Array.from(derivedStations).slice(0, 30);
  const nextDefaultStation =
    cleanStationId(updates.defaultStationId ?? staff.defaultStationId) ||
    screenToStationId(nextDefault) ||
    nextStations[0] ||
    '';

  const nextHallId = (updates.hallId ?? staff.hallId ?? '').trim().slice(0, 128);
  const nextHallName = (updates.hallName ?? staff.hallName ?? '').trim().slice(0, 80);
  const nextActive = updates.isActive ?? staff.isActive;

  if (nextPhone.length < 6) {
    throw new Error('يرجى إدخال رقم هاتف صحيح.');
  }

  let newPhoneLookupId = '';
  let oldPhoneLookupId = '';
  if (nextPhone !== staff.phone) {
    newPhoneLookupId = await buildLoginIndexId('p', restaurantId, nextPhone);
    oldPhoneLookupId = await buildLoginIndexId('p', restaurantId, staff.phone);
    const existingPhoneSnap = await getDoc(
      doc(db, 'restaurants', restaurantId, 'staff_login_index', newPhoneLookupId)
    );
    if (existingPhoneSnap.exists() && existingPhoneSnap.data()?.staffUid !== staff.uid) {
      throw new Error('رقم الهاتف الجديد مسجل لموظف آخر بالفعل.');
    }
  } else {
    oldPhoneLookupId = await buildLoginIndexId('p', restaurantId, staff.phone);
  }

  const uLookupId = await buildLoginIndexId('u', restaurantId, staff.username);
  const batch = writeBatch(db);

  batch.update(doc(db, 'restaurants', restaurantId, 'staff', staff.uid), {
    name: nextName,
    phone: nextPhone,
    email: nextEmail,
    jobTitle: nextJobTitle,
    role: nextRole,
    allowedScreens: nextScreens,
    allowedStations: nextStations,
    defaultScreen: nextDefault,
    defaultStationId: nextDefaultStation,
    hallId: nextHallId,
    hallName: nextHallName,
    isActive: Boolean(nextActive),
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'staff_access', staff.uid), {
    role: nextRole,
    allowedScreens: nextScreens,
    allowedStations: nextStations,
    defaultScreen: nextDefault,
    defaultStationId: nextDefaultStation,
    hallId: nextHallId,
    isActive: Boolean(nextActive),
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'restaurants', restaurantId, 'staff_login_index', uLookupId), {
    isActive: Boolean(nextActive),
    updatedAt: serverTimestamp(),
  });

  if (newPhoneLookupId) {
    batch.delete(doc(db, 'restaurants', restaurantId, 'staff_login_index', oldPhoneLookupId));
    batch.set(doc(db, 'restaurants', restaurantId, 'staff_login_index', newPhoneLookupId), {
      id: newPhoneLookupId,
      restaurantId,
      ownerId: staff.ownerId,
      staffUid: staff.uid,
      authEmail: staff.authEmail,
      isActive: Boolean(nextActive),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.update(doc(db, 'restaurants', restaurantId, 'staff_login_index', oldPhoneLookupId), {
      isActive: Boolean(nextActive),
      updatedAt: serverTimestamp(),
    });
  }

  if (nextEmail && nextEmail !== (staff.email || '').toLowerCase()) {
    const newEmailLookup = await buildLoginIndexId('e', restaurantId, nextEmail);
    const newEmailRef = doc(db, 'restaurants', restaurantId, 'staff_login_index', newEmailLookup);
    const existingEmailSnap = await getDoc(newEmailRef);
    if (existingEmailSnap.exists() && existingEmailSnap.data()?.staffUid !== staff.uid) {
      throw new Error('البريد الإلكتروني مسجل لموظف آخر في نفس المطعم بالفعل.');
    }
    if (existingEmailSnap.exists()) {
      batch.update(newEmailRef, {
        isActive: Boolean(nextActive),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(newEmailRef, {
        id: newEmailLookup,
        restaurantId,
        ownerId: staff.ownerId,
        staffUid: staff.uid,
        authEmail: staff.authEmail,
        isActive: Boolean(nextActive),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  const logId = makeStaffDocId('slog');
  batch.set(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
    id: logId,
    restaurantId,
    ownerId: staff.ownerId,
    eventType: 'staff_updated' satisfies StaffAuditEventType,
    actorUid: actor.uid,
    actorName: actor.name.slice(0, 100),
    actorRole: actor.role,
    targetUid: staff.uid,
    targetName: nextName,
    screen: 'staff_management',
    details: nextActive
      ? `تم تحديث صلاحيات وبيانات ${nextName} (${nextRole})`
      : `تم إيقاف حساب ${nextName} مؤقتاً`,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function fetchStaffInvitePreview(
  restaurantId: string,
  rawInviteToken: string
): Promise<{
  status: 'valid' | 'expired' | 'used' | 'revoked' | 'not_found';
  invite?: StaffInvite;
}> {
  const cleanToken = (rawInviteToken || '').trim();
  if (!cleanToken) return { status: 'not_found' };
  const tokenHash = await sha256Hex(cleanToken);
  const snap = await getDoc(
    doc(db, 'restaurants', restaurantId, 'staff_invites', tokenHash)
  );
  if (!snap.exists()) {
    return { status: 'not_found' };
  }
  const invite = { ...(snap.data() as StaffInvite), id: snap.id };
  if (invite.revokedAt) {
    return { status: 'revoked', invite };
  }
  if (invite.usedAt) {
    return { status: 'used', invite };
  }
  const expMs = getTsMillis(invite.expiresAt);
  if (expMs > 0 && expMs < Date.now()) {
    return { status: 'expired', invite };
  }
  return { status: 'valid', invite };
}

export async function completeStaffOnboarding(params: {
  restaurant: Restaurant;
  rawInviteToken: string;
  invite: StaffInvite;
  newPassword: string;
  confirmPassword: string;
  name: string;
  phone: string;
  email?: string;
  jobTitle?: string;
  hallId?: string;
  hallName?: string;
}): Promise<StaffMember> {
  const pwCheck = validateStaffPassword(params.newPassword, params.confirmPassword);
  if (!pwCheck.valid) {
    throw new Error(pwCheck.error || 'كلمة المرور غير صالحة.');
  }

  const cleanName = params.name.trim().slice(0, 100);
  const cleanPhone = normalizeStaffPhone(params.phone || params.invite.staffPhone);
  const cleanEmail = (params.email ?? params.invite.staffEmail ?? '').trim().toLowerCase().slice(0, 254);
  const cleanJobTitle = (params.jobTitle ?? params.invite.staffJobTitle ?? '').trim().slice(0, 80);
  const cleanHallId = (params.hallId ?? params.invite.staffHallId ?? '').trim().slice(0, 128);
  const cleanHallName = (params.hallName ?? params.invite.staffHallName ?? '').trim().slice(0, 80);

  if (cleanName.length < 2) {
    throw new Error('يرجى إدخال الاسم الكامل (حرفين على الأقل).');
  }
  if (cleanPhone.length < 6) {
    throw new Error('يرجى إدخال رقم هاتف صحيح (6 أرقام على الأقل).');
  }
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('صيغة البريد الإلكتروني غير صحيحة.');
  }

  // Re-verify invite state right before auth & update
  const tokenHash = await sha256Hex(params.rawInviteToken.trim());
  const latestInviteSnap = await getDoc(
    doc(db, 'restaurants', params.restaurant.id, 'staff_invites', tokenHash)
  );
  if (!latestInviteSnap.exists()) {
    throw new Error('رابط الدعوة غير موجود أو تم حذفه.');
  }
  const latestInvite = latestInviteSnap.data() as StaffInvite;
  if (latestInvite.revokedAt) {
    throw new Error('تم إلغاء رابط الدعوة هذا. اطلب من المدير رابط دعوة جديداً.');
  }
  if (latestInvite.usedAt) {
    throw new Error('تم استخدام رابط الدعوة هذا مسبقاً. يمكنك تسجيل الدخول بكلمة مرورك.');
  }
  if (getTsMillis(latestInvite.expiresAt) < Date.now()) {
    throw new Error('انتهت صلاحية رابط الدعوة (24 ساعة). اطلب من المدير إنشاء دعوة جديدة.');
  }

  // Pre-compute and verify login index uniqueness BEFORE mutating Firebase Auth credentials
  const oldCleanEmail = (latestInvite.staffEmail || '').trim().toLowerCase();
  const [uLookupId, oldPhoneLookupId, newPhoneLookupId, oldEmailLookupId, eLookupId] = await Promise.all([
    buildLoginIndexId('u', params.restaurant.id, latestInvite.staffUsername),
    buildLoginIndexId('p', params.restaurant.id, latestInvite.staffPhone),
    buildLoginIndexId('p', params.restaurant.id, cleanPhone),
    oldCleanEmail ? buildLoginIndexId('e', params.restaurant.id, oldCleanEmail) : Promise.resolve(''),
    cleanEmail ? buildLoginIndexId('e', params.restaurant.id, cleanEmail) : Promise.resolve(''),
  ]);

  const allowPhoneChange = cleanPhone !== latestInvite.staffPhone;
  if (allowPhoneChange) {
    const checkSnap = await getDoc(
      doc(db, 'restaurants', params.restaurant.id, 'staff_login_index', newPhoneLookupId)
    );
    if (checkSnap.exists() && checkSnap.data()?.staffUid !== latestInvite.staffId) {
      throw new Error('رقم الهاتف المدخل مسجل لموظف آخر في نفس المطعم.');
    }
  }

  let emailLookupExistsForSelf = false;
  if (eLookupId) {
    const emailCheckSnap = await getDoc(
      doc(db, 'restaurants', params.restaurant.id, 'staff_login_index', eLookupId)
    );
    if (emailCheckSnap.exists()) {
      if (emailCheckSnap.data()?.staffUid !== latestInvite.staffId) {
        throw new Error('البريد الإلكتروني المدخل مسجل لموظف آخر في نفس المطعم.');
      }
      emailLookupExistsForSelf = true;
    }
  }

  const bootstrapPassword = await deriveInviteBootstrapPassword(
    params.rawInviteToken.trim(),
    params.restaurant.id
  );

  let cred;
  let usedBootstrapPassword = true;
  try {
    cred = await signInWithEmailAndPassword(auth, latestInvite.authEmail, bootstrapPassword);
  } catch (bootstrapErr) {
    const msg = bootstrapErr instanceof Error ? bootstrapErr.message : '';
    const isCredentialMismatch =
      msg.includes('auth/invalid-credential') ||
      msg.includes('auth/wrong-password') ||
      msg.includes('auth/user-not-found');
    if (isCredentialMismatch) {
      // Recover safely if a prior failed attempt already updated Auth password while invite remained unused
      try {
        cred = await signInWithEmailAndPassword(auth, latestInvite.authEmail, params.newPassword);
        usedBootstrapPassword = false;
      } catch {
        throw new Error(
          'تعذّر التحقق من بيانات اعتماد رابط الدعوة (قد يكون الحساب حُذف من المصادقة أو انتهت صلاحية بياناته المؤقتة). اطلب من صاحب المطعم أو المدير إصدار رابط دعوة QR جديد.'
        );
      }
    } else {
      throw bootstrapErr;
    }
  }

  if (cred.user.uid !== latestInvite.staffId) {
    await signOut(auth);
    throw new Error('حدث تعارض في هوية الحساب. اطلب من المدير إعادة إنشاء الدعوة.');
  }

  if (usedBootstrapPassword) {
    await updatePassword(cred.user, params.newPassword);
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'restaurants', params.restaurant.id, 'staff_invites', tokenHash), {
    usedAt: serverTimestamp(),
    usedByUid: cred.user.uid,
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'restaurants', params.restaurant.id, 'staff', cred.user.uid), {
    name: cleanName,
    phone: cleanPhone,
    email: cleanEmail,
    jobTitle: cleanJobTitle,
    hallId: cleanHallId,
    hallName: cleanHallName,
    isActive: true,
    mustChangePassword: false,
    passwordChangedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'staff_access', cred.user.uid), {
    hallId: cleanHallId,
    isActive: true,
    mustChangePassword: false,
    updatedAt: serverTimestamp(),
  });

  batch.update(
    doc(db, 'restaurants', params.restaurant.id, 'staff_login_index', uLookupId),
    { isActive: true, updatedAt: serverTimestamp() }
  );

  if (allowPhoneChange) {
    batch.delete(
      doc(db, 'restaurants', params.restaurant.id, 'staff_login_index', oldPhoneLookupId)
    );
    batch.set(
      doc(db, 'restaurants', params.restaurant.id, 'staff_login_index', newPhoneLookupId),
      {
        id: newPhoneLookupId,
        restaurantId: params.restaurant.id,
        ownerId: params.restaurant.ownerId,
        staffUid: cred.user.uid,
        authEmail: latestInvite.authEmail,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
  } else {
    batch.update(
      doc(db, 'restaurants', params.restaurant.id, 'staff_login_index', oldPhoneLookupId),
      { isActive: true, updatedAt: serverTimestamp() }
    );
  }

  if (oldEmailLookupId && oldEmailLookupId !== eLookupId) {
    batch.delete(
      doc(db, 'restaurants', params.restaurant.id, 'staff_login_index', oldEmailLookupId)
    );
  }

  if (eLookupId) {
    const emailRef = doc(db, 'restaurants', params.restaurant.id, 'staff_login_index', eLookupId);
    if (emailLookupExistsForSelf) {
      batch.update(emailRef, {
        isActive: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(emailRef, {
        id: eLookupId,
        restaurantId: params.restaurant.id,
        ownerId: params.restaurant.ownerId,
        staffUid: cred.user.uid,
        authEmail: latestInvite.authEmail,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  const logInviteUsed = makeStaffDocId('slog');
  batch.set(doc(db, 'restaurants', params.restaurant.id, 'staff_audit_logs', logInviteUsed), {
    id: logInviteUsed,
    restaurantId: params.restaurant.id,
    ownerId: params.restaurant.ownerId,
    eventType: 'invite_used' satisfies StaffAuditEventType,
    actorUid: cred.user.uid,
    actorName: cleanName,
    actorRole: latestInvite.staffRole,
    targetUid: cred.user.uid,
    targetName: cleanName,
    screen: latestInvite.defaultScreen,
    details: 'تم تفعيل الحساب عبر رابط الدعوة QR لمرة واحدة',
    inviteHash: tokenHash,
    createdAt: serverTimestamp(),
  });

  const logPwChanged = makeStaffDocId('slog');
  batch.set(doc(db, 'restaurants', params.restaurant.id, 'staff_audit_logs', logPwChanged), {
    id: logPwChanged,
    restaurantId: params.restaurant.id,
    ownerId: params.restaurant.ownerId,
    eventType: 'password_changed' satisfies StaffAuditEventType,
    actorUid: cred.user.uid,
    actorName: cleanName,
    actorRole: latestInvite.staffRole,
    targetUid: cred.user.uid,
    targetName: cleanName,
    screen: latestInvite.defaultScreen,
    details: 'تم تعيين كلمة المرور الدائمة من قِبل الموظف',
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (batchError) {
    if (usedBootstrapPassword) {
      await updatePassword(cred.user, bootstrapPassword).catch(() => {});
    }
    await signOut(auth).catch(() => {});
    handleFirestoreError(
      batchError,
      OperationType.WRITE,
      `restaurants/${params.restaurant.id}/staff/${cred.user.uid}`
    );
  }

  const staffSnap = await getDoc(
    doc(db, 'restaurants', params.restaurant.id, 'staff', cred.user.uid)
  );
  if (staffSnap.exists()) {
    return { ...(staffSnap.data() as StaffMember), uid: staffSnap.id };
  }
  return {
    uid: cred.user.uid,
    restaurantId: params.restaurant.id,
    ownerId: params.restaurant.ownerId,
    name: cleanName,
    username: latestInvite.staffUsername,
    phone: cleanPhone,
    email: cleanEmail,
    authEmail: latestInvite.authEmail,
    jobTitle: cleanJobTitle,
    role: latestInvite.staffRole,
    allowedScreens: latestInvite.allowedScreens,
    allowedStations: latestInvite.allowedStations || [],
    defaultScreen: latestInvite.defaultScreen,
    defaultStationId: latestInvite.defaultStationId || '',
    hallId: cleanHallId,
    hallName: cleanHallName,
    isActive: true,
    mustChangePassword: false,
    createdBy: latestInvite.createdBy,
  };
}

export async function loginStaffMember(params: {
  restaurant: Restaurant;
  rawIdentifier: string;
  password: string;
}): Promise<StaffMember> {
  const { restaurant, rawIdentifier, password } = params;
  const classified = classifyLoginIdentifier(rawIdentifier);
  if (!classified.normalized || !password) {
    throw new Error('يرجى إدخال بيانات الدخول وكلمة المرور.');
  }

  const lockKey = (await sha256Hex(classified.normalized)).slice(0, 16);
  const lockout = getLoginLockoutState(restaurant.slug, lockKey);
  if (lockout.isLocked) {
    throw new Error(
      `تم إيقاف المحاولات مؤقتاً لحماية الحساب. انتظر ${lockout.remainingSeconds} ثانية ثم حاول مجدداً.`
    );
  }

  let resolved: Awaited<ReturnType<typeof resolveStaffAuthEmail>>;
  try {
    resolved = await resolveStaffAuthEmail(restaurant.id, rawIdentifier);
  } catch (err) {
    recordLoginFailure(restaurant.slug, lockKey);
    throw err;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, resolved.authEmail, password);
    const staffSnap = await getDoc(
      doc(db, 'restaurants', restaurant.id, 'staff', cred.user.uid)
    );
    if (!staffSnap.exists()) {
      await signOut(auth);
      recordLoginFailure(restaurant.slug, lockKey);
      throw new Error('هذا الحساب لا ينتمي إلى كادر هذا المطعم.');
    }

    const staff = { ...(staffSnap.data() as StaffMember), uid: staffSnap.id };
    if (staff.restaurantId !== restaurant.id) {
      await signOut(auth);
      throw new Error('عزل المطاعم: لا يمكن فتح مطعم آخر بهذا الحساب.');
    }
    if (!staff.isActive) {
      await signOut(auth);
      throw new Error('هذا الحساب موقوف حالياً أو بانتظار التفعيل عبر رابط الدعوة.');
    }

    resetLoginFailures(restaurant.slug, lockKey);

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'restaurants', restaurant.id, 'staff', staff.uid), {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const logId = makeStaffDocId('slog');
      batch.set(doc(db, 'restaurants', restaurant.id, 'staff_audit_logs', logId), {
        id: logId,
        restaurantId: restaurant.id,
        ownerId: restaurant.ownerId,
        eventType: 'staff_login' satisfies StaffAuditEventType,
        actorUid: staff.uid,
        actorName: staff.name,
        actorRole: staff.role,
        screen: staff.defaultScreen,
        details: `تسجيل دخول عبر ${resolved.identifierType === 'email' ? 'البريد الإلكتروني' : resolved.identifierType === 'phone' ? 'رقم الهاتف' : 'اسم المستخدم'}`,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    } catch {
      // Non-fatal login audit update
    }

    return staff;
  } catch (err) {
    const codeOrMsg = err instanceof Error ? err.message : '';
    if (
      codeOrMsg.includes('auth/wrong-password') ||
      codeOrMsg.includes('auth/invalid-credential') ||
      codeOrMsg.includes('auth/user-not-found') ||
      codeOrMsg.includes('auth/invalid-email')
    ) {
      const nextLock = recordLoginFailure(restaurant.slug, lockKey);
      if (nextLock.isLocked) {
        throw new Error(
          `كلمة المرور غير صحيحة. تم تفعيل حماية مؤقتة لمدة ${nextLock.remainingSeconds} ثانية.`
        );
      }
      throw new Error('بيانات الدخول أو كلمة المرور غير صحيحة.');
    }
    throw err;
  }
}

export async function getMyStaffProfile(
  restaurantId: string,
  uid: string
): Promise<StaffMember | null> {
  try {
    const snap = await getDoc(doc(db, 'restaurants', restaurantId, 'staff', uid));
    if (!snap.exists()) return null;
    return { ...(snap.data() as StaffMember), uid: snap.id };
  } catch {
    return null;
  }
}

export async function getStaffAccessForUid(uid: string): Promise<StaffAccess | null> {
  try {
    const snap = await getDoc(doc(db, 'staff_access', uid));
    if (!snap.exists()) return null;
    const access = { ...(snap.data() as StaffAccess), uid: snap.id };
    const restSnap = await getDoc(doc(db, 'restaurants', access.restaurantId));
    return restSnap.exists() ? access : null;
  } catch {
    return null;
  }
}

export async function fetchRestaurantSlugById(restaurantId: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'restaurants', restaurantId));
    if (!snap.exists()) return null;
    return (snap.data() as Restaurant).slug || null;
  } catch {
    return null;
  }
}

export function subscribeRestaurantStaff(
  restaurantId: string,
  onData: (staff: StaffMember[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `restaurants/${restaurantId}/staff`;
  const q = query(collection(db, 'restaurants', restaurantId, 'staff'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as StaffMember), uid: d.id }))
        .sort((a, b) => {
          if (a.role === 'manager' && b.role !== 'manager') return -1;
          if (a.role !== 'manager' && b.role === 'manager') return 1;
          return getTsMillis(b.createdAt) - getTsMillis(a.createdAt);
        });
      onData(list);
    },
    (error) => {
      if (onError) {
        onError(error instanceof Error ? error : new Error('تعذر تحميل قائمة الكادر'));
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}

export function subscribeStaffAuditLogs(
  restaurantId: string,
  onData: (logs: StaffAuditLog[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `restaurants/${restaurantId}/staff_audit_logs`;
  const q = query(collection(db, 'restaurants', restaurantId, 'staff_audit_logs'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as StaffAuditLog), id: d.id }))
        .sort((a, b) => getTsMillis(b.createdAt) - getTsMillis(a.createdAt))
        .slice(0, 120);
      onData(list);
    },
    (error) => {
      if (onError) {
        onError(error instanceof Error ? error : new Error('تعذر تحميل سجل التتبع'));
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  );
}

export async function completeForcedPasswordChange(params: {
  restaurantId: string;
  staff: StaffMember;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  const pwCheck = validateStaffPassword(params.newPassword, params.confirmPassword);
  if (!pwCheck.valid) {
    throw new Error(pwCheck.error || 'كلمة المرور غير صالحة.');
  }
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== params.staff.uid) {
    throw new Error('انتهت جلسة الدخول. أعد تسجيل الدخول أولاً.');
  }
  await updatePassword(currentUser, params.newPassword);

  const batch = writeBatch(db);
  batch.update(doc(db, 'restaurants', params.restaurantId, 'staff', params.staff.uid), {
    mustChangePassword: false,
    passwordChangedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'staff_access', params.staff.uid), {
    mustChangePassword: false,
    updatedAt: serverTimestamp(),
  });
  const logId = makeStaffDocId('slog');
  batch.set(doc(db, 'restaurants', params.restaurantId, 'staff_audit_logs', logId), {
    id: logId,
    restaurantId: params.restaurantId,
    ownerId: params.staff.ownerId,
    eventType: 'password_changed' satisfies StaffAuditEventType,
    actorUid: params.staff.uid,
    actorName: params.staff.name,
    actorRole: params.staff.role,
    targetUid: params.staff.uid,
    targetName: params.staff.name,
    details: 'تم تحديث كلمة المرور',
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function countRestaurantManagers(restaurantId: string): Promise<number> {
  try {
    const snap = await getDocs(
      query(collection(db, 'restaurants', restaurantId, 'staff'), where('role', '==', 'manager'))
    );
    return snap.size;
  } catch {
    return 0;
  }
}

export async function deleteRestaurantStaffMember(params: {
  restaurantId: string;
  staff: StaffMember;
  actor: StaffActorInfo;
}): Promise<void> {
  const { restaurantId, staff, actor } = params;
  const [uLookupId, pLookupId, eLookupId] = await Promise.all([
    buildLoginIndexId('u', restaurantId, staff.username),
    buildLoginIndexId('p', restaurantId, staff.phone),
    staff.email ? buildLoginIndexId('e', restaurantId, staff.email.toLowerCase()) : Promise.resolve(''),
  ]);

  let inviteExists = false;
  if (staff.activeInviteHash) {
    try {
      const invSnap = await getDoc(
        doc(db, 'restaurants', restaurantId, 'staff_invites', staff.activeInviteHash)
      );
      inviteExists = invSnap.exists();
    } catch {
      inviteExists = false;
    }
  }

  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'restaurants', restaurantId, 'staff', staff.uid));
    batch.delete(doc(db, 'staff_access', staff.uid));
    batch.delete(doc(db, 'restaurants', restaurantId, 'staff_login_index', uLookupId));
    batch.delete(doc(db, 'restaurants', restaurantId, 'staff_login_index', pLookupId));
    if (eLookupId) {
      batch.delete(doc(db, 'restaurants', restaurantId, 'staff_login_index', eLookupId));
    }
    if (inviteExists && staff.activeInviteHash) {
      batch.update(doc(db, 'restaurants', restaurantId, 'staff_invites', staff.activeInviteHash), {
        revokedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    const logId = makeStaffDocId('slog');
    batch.set(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId,
      ownerId: staff.ownerId,
      eventType: 'staff_deleted' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      targetUid: staff.uid,
      targetName: staff.name,
      screen: 'staff_management',
      details: `تم حذف حساب الموظف: ${staff.name} (${staff.username})`,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `restaurants/${restaurantId}/staff/${staff.uid}`);
  }
}
