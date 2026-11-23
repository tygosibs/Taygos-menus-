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
  updateDoc,
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
import { getActiveLang } from '../data/translations';
import { cleanStationId, cleanStationIdList, screenToStationId } from './stationUtils';

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
  const isEn = getActiveLang() === 'en';
  const classified = classifyLoginIdentifier(rawIdentifier);
  if (!classified.normalized) {
    throw new Error(
      isEn
        ? 'Please enter your username, phone number, or email address.'
        : 'يرجى إدخال اسم المستخدم أو رقم الهاتف أو البريد الإلكتروني.'
    );
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
        ? isEn
          ? 'Invalid credentials or phone number is not registered at this restaurant.'
          : 'بيانات الدخول غير صحيحة أو رقم الهاتف غير مسجل في هذا المطعم.'
        : isEn
          ? 'Invalid credentials or username is not registered at this restaurant.'
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
  allowedCaptainScreens?: string[];
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

  const isEn = getActiveLang() === 'en';
  if (cleanName.length < 2) {
    throw new Error(
      isEn ? 'Please enter the staff member name (at least 2 characters).' : 'يرجى إدخال اسم الموظف (حرفين على الأقل).'
    );
  }
  if (cleanUsername.length < 3) {
    throw new Error(
      isEn
        ? 'Username must use English letters and numbers (at least 3 characters).'
        : 'اسم المستخدم يجب أن يكون بالإنجليزية والأرقام (3 أحرف على الأقل).'
    );
  }
  if (cleanPhone.length < 6) {
    throw new Error(
      isEn ? 'Please enter a valid phone number (at least 6 digits).' : 'يرجى إدخال رقم هاتف صحيح (6 أرقام على الأقل).'
    );
  }
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error(isEn ? 'Invalid email address format.' : 'صيغة البريد الإلكتروني غير صحيحة.');
  }

  if (!input.useOneTimeInvite) {
    const pwCheck = validateStaffPassword(input.directPassword || '');
    if (!pwCheck.valid) {
      throw new Error(
        pwCheck.error || (isEn ? 'Password does not meet security requirements.' : 'كلمة المرور غير مطابقة لشروط الأمان.')
      );
    }
  }

  const allowedCaptainScreens = cleanStationIdList(input.allowedCaptainScreens).slice(0, 30);
  const rawInputScreens =
    allowedCaptainScreens.length > 0 && !input.allowedScreens.includes('captain')
      ? ([...input.allowedScreens, 'captain'] as StaffScreen[])
      : input.allowedScreens;

  const allowedScreens = Array.from(
    new Set<StaffScreen>(
      input.role === 'manager'
        ? rawInputScreens.length > 0
          ? rawInputScreens
          : ['staff_management', 'cashier', 'kitchen', 'bar', 'pastry', 'captain', 'halls']
        : rawInputScreens.filter((s) => s !== 'staff_management' && s !== 'halls')
    )
  ).slice(0, 30);

  if (allowedScreens.length === 0) {
    throw new Error(
      isEn ? 'Please select at least one screen for this staff member.' : 'يرجى اختيار شاشة واحدة على الأقل للموظف.'
    );
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
    throw new Error(
      isEn
        ? 'Username is already taken by another staff member in this restaurant.'
        : 'اسم المستخدم مسجل بالفعل لموظف آخر في هذا المطعم. اختر اسماً مختلفاً.'
    );
  }
  if (pSnap.exists()) {
    throw new Error(
      isEn
        ? 'Phone number is already registered for another staff member.'
        : 'رقم الهاتف مسجل بالفعل لموظف آخر في هذا المطعم.'
    );
  }
  if (eSnap && eSnap.exists()) {
    throw new Error(
      isEn
        ? 'Email address is already registered for another staff member.'
        : 'البريد الإلكتروني مسجل بالفعل لموظف آخر في هذا المطعم.'
    );
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
        isEn
          ? 'This email is already used in Authentication. Leave email optional or use a one-time QR invite.'
          : 'هذا البريد الإلكتروني مستخدم بالفعل. اترك البريد اختيارياً أو استخدم دعوة رمز الاستجابة لمرة واحدة.'
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
    allowedCaptainScreens,
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
    allowedCaptainScreens,
    defaultScreen,
    defaultStationId,
    hallId: (input.hallId || '').trim().slice(0, 128),
    isActive: isActiveInitial,
    mustChangePassword: input.useOneTimeInvite,
    updatedAt: serverTimestamp(),
  };

  try {
    const staffRef = doc(db, 'restaurants', input.restaurant.id, 'staff', staffUid);
    const accessRef = doc(db, 'staff_access', staffUid);
    const inviteRef = tokenHash
      ? doc(db, 'restaurants', input.restaurant.id, 'staff_invites', tokenHash)
      : null;

    // Batch 1: Core identity & invite docs (<= 3 writes -> stays well under Firestore 20 rule-read limit)
    const coreBatch = writeBatch(db);
    coreBatch.set(staffRef, staffPayload);
    coreBatch.set(accessRef, accessPayload);
    if (inviteRef && tokenHash) {
      coreBatch.set(inviteRef, {
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
        allowedCaptainScreens,
        defaultScreen,
        defaultStationId,
        expiresAt: Timestamp.fromMillis(expiresAtMs),
        createdBy: input.actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await coreBatch.commit();

    // Batch 2: Login lookup index docs (<= 3 writes)
    const commonLookup = {
      restaurantId: input.restaurant.id,
      ownerId: input.restaurant.ownerId,
      staffUid,
      authEmail,
      isActive: isActiveInitial,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const indexBatch = writeBatch(db);
    indexBatch.set(
      doc(db, 'restaurants', input.restaurant.id, 'staff_login_index', uLookupId),
      { id: uLookupId, ...commonLookup }
    );
    indexBatch.set(
      doc(db, 'restaurants', input.restaurant.id, 'staff_login_index', pLookupId),
      { id: pLookupId, ...commonLookup }
    );
    if (eLookupId) {
      indexBatch.set(
        doc(db, 'restaurants', input.restaurant.id, 'staff_login_index', eLookupId),
        { id: eLookupId, ...commonLookup }
      );
    }
    try {
      await indexBatch.commit();
    } catch (indexError) {
      const rollbackBatch = writeBatch(db);
      rollbackBatch.delete(staffRef);
      rollbackBatch.delete(accessRef);
      if (inviteRef) {
        rollbackBatch.delete(inviteRef);
      }
      await rollbackBatch.commit().catch(() => {});
      throw indexError;
    }

    // Batch 3: Non-fatal security audit logs
    try {
      const auditBatch = writeBatch(db);
      const logId = makeStaffDocId('slog');
      auditBatch.set(
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
          details:
            getActiveLang() === 'en'
              ? `Created ${input.role} account (${cleanUsername})`
              : `تم إنشاء حساب ${input.role} (${cleanUsername})`,
          ...(tokenHash ? { inviteHash: tokenHash } : {}),
          createdAt: serverTimestamp(),
        }
      );

      if (tokenHash) {
        const inviteLogId = makeStaffDocId('slog');
        auditBatch.set(
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
            details:
              getActiveLang() === 'en'
                ? 'Generated one-time QR invite link valid for 24 hours'
                : 'تم إنشاء رابط دعوة QR صالح لمرة واحدة ولمدة 24 ساعة',
            inviteHash: tokenHash,
            createdAt: serverTimestamp(),
          }
        );
      }
      await auditBatch.commit();
    } catch {
      // Non-fatal audit logging
    }

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
      allowedCaptainScreens,
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

  const [uLookupId, pLookupId, eLookupId] = await Promise.all([
    buildLoginIndexId('u', restaurant.id, existingStaff.username),
    buildLoginIndexId('p', restaurant.id, existingStaff.phone),
    existingStaff.email
      ? buildLoginIndexId('e', restaurant.id, existingStaff.email.toLowerCase())
      : Promise.resolve(''),
  ]);

  const uLookupRef = doc(db, 'restaurants', restaurant.id, 'staff_login_index', uLookupId);
  const pLookupRef = doc(db, 'restaurants', restaurant.id, 'staff_login_index', pLookupId);
  const eLookupRef = eLookupId
    ? doc(db, 'restaurants', restaurant.id, 'staff_login_index', eLookupId)
    : null;
  const oldStaffRef = doc(db, 'restaurants', restaurant.id, 'staff', existingStaff.uid);
  const oldAccessRef = doc(db, 'staff_access', existingStaff.uid);
  const oldInviteRef = existingStaff.activeInviteHash
    ? doc(db, 'restaurants', restaurant.id, 'staff_invites', existingStaff.activeInviteHash)
    : null;

  const [oldInviteSnap, oldStaffSnap, oldAccessSnap, uSnap, pSnap, eSnap] = await Promise.all([
    oldInviteRef ? getDoc(oldInviteRef).catch(() => null) : Promise.resolve(null),
    getDoc(oldStaffRef).catch(() => null),
    getDoc(oldAccessRef).catch(() => null),
    getDoc(uLookupRef).catch(() => null),
    getDoc(pLookupRef).catch(() => null),
    eLookupRef ? getDoc(eLookupRef).catch(() => null) : Promise.resolve(null),
  ]);

  const newStaffRef = doc(db, 'restaurants', restaurant.id, 'staff', newUid);
  const newAccessRef = doc(db, 'staff_access', newUid);
  const newInviteRef = doc(db, 'restaurants', restaurant.id, 'staff_invites', tokenHash);

  try {
    // Batch 1: Create new staff + access + invite (3 writes)
    const coreBatch = writeBatch(db);
    coreBatch.set(newStaffRef, {
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
      allowedCaptainScreens: existingStaff.allowedCaptainScreens || [],
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
    });
    coreBatch.set(newAccessRef, {
      uid: newUid,
      restaurantId: restaurant.id,
      ownerId: restaurant.ownerId,
      role: existingStaff.role,
      allowedScreens: existingStaff.allowedScreens,
      allowedStations: existingStaff.allowedStations || [],
      allowedCaptainScreens: existingStaff.allowedCaptainScreens || [],
      defaultScreen: existingStaff.defaultScreen,
      defaultStationId: existingStaff.defaultStationId || '',
      hallId: existingStaff.hallId || '',
      isActive: false,
      mustChangePassword: true,
      updatedAt: serverTimestamp(),
    });
    coreBatch.set(newInviteRef, {
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
      allowedCaptainScreens: existingStaff.allowedCaptainScreens || [],
      defaultScreen: existingStaff.defaultScreen,
      defaultStationId: existingStaff.defaultStationId || '',
      expiresAt: Timestamp.fromMillis(expiresAtMs),
      createdBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await coreBatch.commit();

    // Batch 2: Update existing login index docs WITHOUT overwriting createdAt, or create if absent
    const indexBatch = writeBatch(db);
    const applyLookup = (
      ref: ReturnType<typeof doc>,
      id: string,
      exists: boolean
    ) => {
      if (exists) {
        indexBatch.update(ref, {
          staffUid: newUid,
          authEmail: newAuthEmail,
          isActive: false,
          updatedAt: serverTimestamp(),
        });
      } else {
        indexBatch.set(ref, {
          id,
          restaurantId: restaurant.id,
          ownerId: restaurant.ownerId,
          staffUid: newUid,
          authEmail: newAuthEmail,
          isActive: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    };
    applyLookup(uLookupRef, uLookupId, Boolean(uSnap?.exists()));
    applyLookup(pLookupRef, pLookupId, Boolean(pSnap?.exists()));
    if (eLookupRef && eLookupId) {
      applyLookup(eLookupRef, eLookupId, Boolean(eSnap?.exists()));
    }
    try {
      await indexBatch.commit();
    } catch (indexErr) {
      const rollbackBatch = writeBatch(db);
      rollbackBatch.delete(newStaffRef);
      rollbackBatch.delete(newAccessRef);
      rollbackBatch.delete(newInviteRef);
      await rollbackBatch.commit().catch(() => {});
      throw indexErr;
    }

    // Batch 3: Revoke old invite & remove old UID docs (<= 3 writes)
    const cleanupBatch = writeBatch(db);
    let hasCleanup = false;
    if (oldInviteRef && oldInviteSnap?.exists()) {
      cleanupBatch.update(oldInviteRef, {
        revokedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      hasCleanup = true;
    }
    if (oldStaffSnap?.exists()) {
      cleanupBatch.delete(oldStaffRef);
      hasCleanup = true;
    }
    if (oldAccessSnap?.exists()) {
      cleanupBatch.delete(oldAccessRef);
      hasCleanup = true;
    }
    if (hasCleanup) {
      await cleanupBatch.commit();
    }

    // Batch 4: Non-fatal audit log
    try {
      const auditBatch = writeBatch(db);
      const logId = makeStaffDocId('slog');
      auditBatch.set(doc(db, 'restaurants', restaurant.id, 'staff_audit_logs', logId), {
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
        details:
          getActiveLang() === 'en'
            ? 'Reissued a new QR invite link and revoked previous access'
            : 'تمت إعادة إصدار رابط دعوة QR جديد وإلغاء الوصول السابق',
        inviteHash: tokenHash,
        createdAt: serverTimestamp(),
      });
      await auditBatch.commit();
    } catch {
      // Non-fatal audit logging
    }

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
  const isEn = getActiveLang() === 'en';
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error(
      isEn ? 'No valid email address is registered for this staff member.' : 'لا يوجد بريد إلكتروني صالح مسجل لهذا الموظف.'
    );
  }
  if (authEmail !== undefined) {
    const cleanAuth = authEmail.trim().toLowerCase();
    if (!cleanAuth || cleanAuth.endsWith('@staff.sufra.local') || cleanAuth !== cleanEmail) {
      throw new Error(
        isEn
          ? 'This account was activated via an internal QR invite (@staff.sufra.local). Use "New QR Invite / Reset" to issue a new password setup link.'
          : 'هذا الحساب مفعّل بدعوة رمز استجابة برقم/اسم مستخدم داخلي (@staff.sufra.local). لإعادة تعيين كلمة المرور استخدم زر "دعوة جديدة / تصفير".'
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
    allowedCaptainScreens?: string[];
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
  const nextCaptainScreens = cleanStationIdList(
    updates.allowedCaptainScreens ?? staff.allowedCaptainScreens ?? []
  ).slice(0, 30);
  const baseScreens = updates.allowedScreens ?? staff.allowedScreens;
  const rawScreens =
    nextCaptainScreens.length > 0 && !baseScreens.includes('captain')
      ? ([...baseScreens, 'captain'] as StaffScreen[])
      : baseScreens;
  const nextScreens = Array.from(
    new Set<StaffScreen>(
      nextRole === 'manager'
        ? rawScreens.length > 0
          ? rawScreens
          : ['staff_management', 'cashier', 'kitchen', 'bar', 'pastry', 'captain', 'halls']
        : rawScreens.filter((s) => s !== 'staff_management' && s !== 'halls')
    )
  ).slice(0, 30);

  const isEn = getActiveLang() === 'en';
  if (nextScreens.length === 0) {
    throw new Error(
      isEn ? 'At least one screen must be selected for this staff member.' : 'يجب تحديد شاشة واحدة على الأقل للموظف.'
    );
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
    throw new Error(isEn ? 'Please enter a valid phone number.' : 'يرجى إدخال رقم هاتف صحيح.');
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
      throw new Error(
        isEn ? 'The new phone number is already used by another staff member.' : 'رقم الهاتف الجديد مسجل لموظف آخر بالفعل.'
      );
    }
  } else {
    oldPhoneLookupId = await buildLoginIndexId('p', restaurantId, staff.phone);
  }

  const activeChanged = Boolean(nextActive) !== Boolean(staff.isActive);
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
    allowedCaptainScreens: nextCaptainScreens,
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
    allowedCaptainScreens: nextCaptainScreens,
    defaultScreen: nextDefault,
    defaultStationId: nextDefaultStation,
    hallId: nextHallId,
    isActive: Boolean(nextActive),
    updatedAt: serverTimestamp(),
  });

  if (activeChanged) {
    const uSnap = await getDoc(doc(db, 'restaurants', restaurantId, 'staff_login_index', uLookupId));
    if (uSnap.exists()) {
      batch.update(doc(db, 'restaurants', restaurantId, 'staff_login_index', uLookupId), {
        isActive: Boolean(nextActive),
        updatedAt: serverTimestamp(),
      });
    }
  }

  if (newPhoneLookupId) {
    const oldPhoneRef = doc(db, 'restaurants', restaurantId, 'staff_login_index', oldPhoneLookupId);
    const oldPhoneSnap = await getDoc(oldPhoneRef);
    if (oldPhoneSnap.exists()) {
      batch.delete(oldPhoneRef);
    }
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
  } else if (activeChanged) {
    const oldPhoneRef = doc(db, 'restaurants', restaurantId, 'staff_login_index', oldPhoneLookupId);
    const oldPhoneSnap = await getDoc(oldPhoneRef);
    if (oldPhoneSnap.exists()) {
      batch.update(oldPhoneRef, {
        isActive: Boolean(nextActive),
        updatedAt: serverTimestamp(),
      });
    }
  }

  if (nextEmail && nextEmail !== (staff.email || '').toLowerCase()) {
    const newEmailLookup = await buildLoginIndexId('e', restaurantId, nextEmail);
    const newEmailRef = doc(db, 'restaurants', restaurantId, 'staff_login_index', newEmailLookup);
    const existingEmailSnap = await getDoc(newEmailRef);
    if (existingEmailSnap.exists() && existingEmailSnap.data()?.staffUid !== staff.uid) {
      throw new Error(
        isEn ? 'Email address is already registered for another staff member.' : 'البريد الإلكتروني مسجل لموظف آخر في نفس المطعم بالفعل.'
      );
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

  await batch.commit();

  const roleChanged = nextRole !== staff.role;
  try {
    const auditBatch = writeBatch(db);
    const logId = makeStaffDocId('slog');
    auditBatch.set(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId,
      ownerId: staff.ownerId,
      eventType: (roleChanged ? 'staff_promoted' : 'staff_updated') satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      targetUid: staff.uid,
      targetName: nextName,
      screen: 'staff_management',
      details: roleChanged
        ? isEn
          ? `Updated/promoted role for ${nextName} to (${nextRole}${nextJobTitle ? ` - ${nextJobTitle}` : ''})`
          : `تم تعديل/ترقية المسمى الوظيفي للموظف ${nextName} إلى (${nextRole}${nextJobTitle ? ` - ${nextJobTitle}` : ''})`
        : nextActive
        ? isEn
          ? `Updated permissions & profile for ${nextName} (${nextRole})`
          : `تم تحديث صلاحيات وبيانات ${nextName} (${nextRole})`
        : isEn
        ? `Temporarily suspended ${nextName}'s account`
        : `تم إيقاف حساب ${nextName} مؤقتاً`,
      createdAt: serverTimestamp(),
    });
    await auditBatch.commit();
  } catch {
    // Non-fatal audit logging
  }
}

export function resolveStaffSuspensionState(staff: StaffMember): {
  isSuspended: boolean;
  isExpiredTimed: boolean;
  message: string;
} {
  const isEn = getActiveLang() === 'en';
  const actorLabel =
    staff.suspendedByRole === 'owner'
      ? isEn
        ? 'the restaurant owner'
        : 'صاحب المطعم'
      : staff.suspendedByRole === 'manager'
      ? isEn
        ? 'the manager'
        : 'المدير'
      : isEn
      ? 'restaurant management'
      : 'إدارة المطعم';
  const actorNamePart = staff.suspendedByName ? ` (${staff.suspendedByName})` : '';
  const reasonPart = staff.suspendedReason?.trim()
    ? isEn
      ? ` — Reason: ${staff.suspendedReason.trim()}`
      : ` — السبب: ${staff.suspendedReason.trim()}`
    : '';

  if (staff.suspendedType === 'indefinite' && !staff.isActive) {
    return {
      isSuspended: true,
      isExpiredTimed: false,
      message: isEn
        ? `Your screen was suspended indefinitely by ${actorLabel}${actorNamePart}${reasonPart}. Please contact management.`
        : `تم إيقاف شاشتك بواسطة ${actorLabel}${actorNamePart} لأجل غير مسمى${reasonPart} — برجاء مراجعته.`,
    };
  }

  if (staff.suspendedType === 'timed') {
    const untilMs = getTsMillis(staff.suspendedUntil);
    if (untilMs > Date.now() && !staff.isActive) {
      const formatted = new Date(untilMs).toLocaleString(isEn ? 'en-US' : 'ar-EG-u-nu-latn', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      return {
        isSuspended: true,
        isExpiredTimed: false,
        message: isEn
          ? `Your screen is suspended by ${actorLabel}${actorNamePart} until ${formatted}${reasonPart}. Please contact management.`
          : `تم إيقاف شاشتك بواسطة ${actorLabel}${actorNamePart} حتى ${formatted}${reasonPart} — برجاء مراجعته.`,
      };
    }
    if (!staff.isActive && untilMs > 0 && untilMs <= Date.now()) {
      return {
        isSuspended: false,
        isExpiredTimed: true,
        message: '',
      };
    }
  }

  if (!staff.isActive) {
    return {
      isSuspended: true,
      isExpiredTimed: false,
      message: staff.mustChangePassword
        ? isEn
          ? 'This account is waiting for activation via the QR invite link.'
          : 'هذا الحساب بانتظار التفعيل عبر رابط الدعوة.'
        : isEn
          ? `Your screen was suspended by ${actorLabel}${actorNamePart}${reasonPart}. Please contact management.`
          : `تم إيقاف شاشتك بواسطة ${actorLabel}${actorNamePart}${reasonPart} — برجاء مراجعته.`,
    };
  }

  return {
    isSuspended: false,
    isExpiredTimed: false,
    message: '',
  };
}

export async function suspendStaffMember(params: {
  restaurantId: string;
  staff: StaffMember;
  actor: StaffActorInfo;
  suspendedType: 'timed' | 'indefinite';
  durationHours?: number;
  suspendedUntilMs?: number;
  reason: string;
}): Promise<void> {
  const { restaurantId, staff, actor, suspendedType, reason } = params;
  const isEn = getActiveLang() === 'en';
  const cleanReason = reason.trim().slice(0, 300);
  if (!cleanReason) {
    throw new Error(isEn ? 'Please provide a suspension reason.' : 'يرجى كتابة سبب إيقاف الموظف.');
  }

  let untilTs: Timestamp | null = null;
  let durationLabel = isEn ? 'Indefinite' : 'لأجل غير مسمى';
  if (suspendedType === 'timed') {
    const targetMs =
      typeof params.suspendedUntilMs === 'number' && params.suspendedUntilMs > Date.now()
        ? params.suspendedUntilMs
        : Date.now() + Math.max(1, Number(params.durationHours) || 24) * 60 * 60 * 1000;
    untilTs = Timestamp.fromMillis(targetMs);
    durationLabel = `${isEn ? 'Until' : 'حتى'} ${new Date(targetMs).toLocaleString(
      isEn ? 'en-US' : 'ar-EG-u-nu-latn',
      {
        dateStyle: 'medium',
        timeStyle: 'short',
      }
    )}`;
  }

  const byRole: 'owner' | 'manager' = actor.role === 'owner' ? 'owner' : 'manager';
  const batch = writeBatch(db);
  batch.update(doc(db, 'restaurants', restaurantId, 'staff', staff.uid), {
    isActive: false,
    suspendedType,
    suspendedUntil: untilTs,
    suspendedReason: cleanReason,
    suspendedByRole: byRole,
    suspendedByName: actor.name.trim().slice(0, 100),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'staff_access', staff.uid), {
    isActive: false,
    suspendedType,
    suspendedUntil: untilTs,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  try {
    const logId = makeStaffDocId('slog');
    const logBatch = writeBatch(db);
    logBatch.set(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId,
      ownerId: staff.ownerId,
      eventType: 'staff_suspended' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      targetUid: staff.uid,
      targetName: staff.name,
      screen: 'staff_management',
      details: isEn
        ? `Suspended ${staff.name} (${durationLabel}) — Reason: ${cleanReason}`
        : `إيقاف ${staff.name} (${durationLabel}) — السبب: ${cleanReason}`,
      createdAt: serverTimestamp(),
    });
    await logBatch.commit();
  } catch {
    // Non-fatal
  }
}

export async function unsuspendStaffMember(params: {
  restaurantId: string;
  staff: StaffMember;
  actor: StaffActorInfo;
}): Promise<void> {
  const { restaurantId, staff, actor } = params;
  const batch = writeBatch(db);
  batch.update(doc(db, 'restaurants', restaurantId, 'staff', staff.uid), {
    isActive: true,
    suspendedType: '',
    suspendedUntil: null,
    suspendedReason: '',
    suspendedByRole: '',
    suspendedByName: '',
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'staff_access', staff.uid), {
    isActive: true,
    suspendedType: '',
    suspendedUntil: null,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  try {
    const logId = makeStaffDocId('slog');
    const logBatch = writeBatch(db);
    logBatch.set(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
      id: logId,
      restaurantId,
      ownerId: staff.ownerId,
      eventType: 'staff_unsuspended' satisfies StaffAuditEventType,
      actorUid: actor.uid,
      actorName: actor.name.slice(0, 100),
      actorRole: actor.role,
      targetUid: staff.uid,
      targetName: staff.name,
      screen: 'staff_management',
      details:
        getActiveLang() === 'en'
          ? `Lifted suspension and reactivated ${staff.name}'s screen`
          : `تم رفع الإيقاف وإعادة تفعيل شاشة ${staff.name}`,
      createdAt: serverTimestamp(),
    });
    await logBatch.commit();
  } catch {
    // Non-fatal
  }
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
  const isEn = getActiveLang() === 'en';
  const pwCheck = validateStaffPassword(params.newPassword, params.confirmPassword);
  if (!pwCheck.valid) {
    throw new Error(pwCheck.error || (isEn ? 'Invalid password.' : 'كلمة المرور غير صالحة.'));
  }

  const cleanName = params.name.trim().slice(0, 100);
  const cleanPhone = normalizeStaffPhone(params.phone || params.invite.staffPhone);
  const cleanEmail = (params.email ?? params.invite.staffEmail ?? '').trim().toLowerCase().slice(0, 254);
  const cleanJobTitle = (params.jobTitle ?? params.invite.staffJobTitle ?? '').trim().slice(0, 80);
  const cleanHallId = (params.hallId ?? params.invite.staffHallId ?? '').trim().slice(0, 128);
  const cleanHallName = (params.hallName ?? params.invite.staffHallName ?? '').trim().slice(0, 80);

  if (cleanName.length < 2) {
    throw new Error(
      isEn ? 'Please enter your full name (at least 2 characters).' : 'يرجى إدخال الاسم الكامل (حرفين على الأقل).'
    );
  }
  if (cleanPhone.length < 6) {
    throw new Error(
      isEn ? 'Please enter a valid phone number (at least 6 digits).' : 'يرجى إدخال رقم هاتف صحيح (6 أرقام على الأقل).'
    );
  }
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error(isEn ? 'Invalid email address format.' : 'صيغة البريد الإلكتروني غير صحيحة.');
  }

  // Re-verify invite state right before auth & update
  const tokenHash = await sha256Hex(params.rawInviteToken.trim());
  const latestInviteSnap = await getDoc(
    doc(db, 'restaurants', params.restaurant.id, 'staff_invites', tokenHash)
  );
  if (!latestInviteSnap.exists()) {
    throw new Error(isEn ? 'Invite link not found or deleted.' : 'رابط الدعوة غير موجود أو تم حذفه.');
  }
  const latestInvite = latestInviteSnap.data() as StaffInvite;
  if (latestInvite.revokedAt) {
    throw new Error(
      isEn
        ? 'This invite link was revoked. Request a new invite from the manager.'
        : 'تم إلغاء رابط الدعوة هذا. اطلب من المدير رابط دعوة جديداً.'
    );
  }
  if (latestInvite.usedAt) {
    throw new Error(
      isEn
        ? 'This invite link has already been used. You can sign in with your password.'
        : 'تم استخدام رابط الدعوة هذا مسبقاً. يمكنك تسجيل الدخول بكلمة مرورك.'
    );
  }
  if (getTsMillis(latestInvite.expiresAt) < Date.now()) {
    throw new Error(
      isEn
        ? 'This invite link expired (24 hours). Ask the manager for a new invite.'
        : 'انتهت صلاحية رابط الدعوة (24 ساعة). اطلب من المدير إنشاء دعوة جديدة.'
    );
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

  const uLookupRef = doc(db, 'restaurants', params.restaurant.id, 'staff_login_index', uLookupId);
  const oldPhoneRef = doc(db, 'restaurants', params.restaurant.id, 'staff_login_index', oldPhoneLookupId);
  const oldEmailRef =
    oldEmailLookupId && oldEmailLookupId !== eLookupId
      ? doc(db, 'restaurants', params.restaurant.id, 'staff_login_index', oldEmailLookupId)
      : null;

  const [uLookupSnap, oldPhoneSnap, oldEmailSnap] = await Promise.all([
    getDoc(uLookupRef).catch(() => null),
    getDoc(oldPhoneRef).catch(() => null),
    oldEmailRef ? getDoc(oldEmailRef).catch(() => null) : Promise.resolve(null),
  ]);

  const allowPhoneChange = cleanPhone !== latestInvite.staffPhone;
  if (allowPhoneChange) {
    const checkSnap = await getDoc(
      doc(db, 'restaurants', params.restaurant.id, 'staff_login_index', newPhoneLookupId)
    );
    if (checkSnap.exists() && checkSnap.data()?.staffUid !== latestInvite.staffId) {
      throw new Error(
        isEn
          ? 'The entered phone number is already registered for another staff member.'
          : 'رقم الهاتف المدخل مسجل لموظف آخر في نفس المطعم.'
      );
    }
  }

  let emailLookupExistsForSelf = false;
  if (eLookupId) {
    const emailCheckSnap = await getDoc(
      doc(db, 'restaurants', params.restaurant.id, 'staff_login_index', eLookupId)
    );
    if (emailCheckSnap.exists()) {
      if (emailCheckSnap.data()?.staffUid !== latestInvite.staffId) {
        throw new Error(
          isEn
            ? 'The entered email is already registered for another staff member.'
            : 'البريد الإلكتروني المدخل مسجل لموظف آخر في نفس المطعم.'
        );
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
          isEn
            ? 'Could not verify invite credentials (account may have been deleted or temporary link expired). Ask the owner or manager to issue a new QR invite.'
            : 'تعذّر التحقق من بيانات اعتماد رابط الدعوة (قد يكون الحساب حُذف أو انتهت صلاحية بياناته المؤقتة). اطلب من صاحب المطعم أو المدير إصدار رابط دعوة جديد.'
        );
      }
    } else {
      throw bootstrapErr;
    }
  }

  if (cred.user.uid !== latestInvite.staffId) {
    await signOut(auth);
    throw new Error(
      isEn
        ? 'Account identity mismatch. Ask the manager to reissue the invite.'
        : 'حدث تعارض في هوية الحساب. اطلب من المدير إعادة إنشاء الدعوة.'
    );
  }

  if (usedBootstrapPassword) {
    await updatePassword(cred.user, params.newPassword);
  }

  // Phase 1: Core atomic activation batch (only 2-4 rule reads total!)
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

  if (uLookupSnap?.exists()) {
    batch.update(uLookupRef, { isActive: true, updatedAt: serverTimestamp() });
  } else {
    batch.set(uLookupRef, {
      id: uLookupId,
      restaurantId: params.restaurant.id,
      ownerId: params.restaurant.ownerId,
      staffUid: cred.user.uid,
      authEmail: latestInvite.authEmail,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  if (allowPhoneChange) {
    if (oldPhoneSnap?.exists()) {
      batch.delete(oldPhoneRef);
    }
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
  } else if (oldPhoneSnap?.exists()) {
    batch.update(oldPhoneRef, { isActive: true, updatedAt: serverTimestamp() });
  } else {
    batch.set(oldPhoneRef, {
      id: oldPhoneLookupId,
      restaurantId: params.restaurant.id,
      ownerId: params.restaurant.ownerId,
      staffUid: cred.user.uid,
      authEmail: latestInvite.authEmail,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  if (oldEmailRef && oldEmailSnap?.exists()) {
    batch.delete(oldEmailRef);
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

  // Phase 2: Post-activation audit logs (now staff_access isActive == true; non-fatal)
  try {
    const auditBatch = writeBatch(db);
    const logInviteUsed = makeStaffDocId('slog');
    auditBatch.set(doc(db, 'restaurants', params.restaurant.id, 'staff_audit_logs', logInviteUsed), {
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
      details:
        getActiveLang() === 'en'
          ? 'Account activated via one-time QR invite link'
          : 'تم تفعيل الحساب عبر رابط الدعوة QR لمرة واحدة',
      inviteHash: tokenHash,
      createdAt: serverTimestamp(),
    });

    const logPwChanged = makeStaffDocId('slog');
    auditBatch.set(doc(db, 'restaurants', params.restaurant.id, 'staff_audit_logs', logPwChanged), {
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
      details:
        getActiveLang() === 'en'
          ? 'Permanent password set by staff member'
          : 'تم تعيين كلمة المرور الدائمة من قِبل الموظف',
      createdAt: serverTimestamp(),
    });
    await auditBatch.commit();
  } catch {
    // Non-fatal audit logging
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
    allowedCaptainScreens: latestInvite.allowedCaptainScreens || [],
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
  const isEn = getActiveLang() === 'en';
  const classified = classifyLoginIdentifier(rawIdentifier);
  if (!classified.normalized || !password) {
    throw new Error(
      isEn ? 'Please enter your login credentials and password.' : 'يرجى إدخال بيانات الدخول وكلمة المرور.'
    );
  }

  const lockKey = (await sha256Hex(classified.normalized)).slice(0, 16);
  const lockout = getLoginLockoutState(restaurant.slug, lockKey);
  if (lockout.isLocked) {
    throw new Error(
      isEn
        ? `Login temporarily locked for security. Wait ${lockout.remainingSeconds} seconds before trying again.`
        : `تم إيقاف المحاولات مؤقتاً لحماية الحساب. انتظر ${lockout.remainingSeconds} ثانية ثم حاول مجدداً.`
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
      throw new Error(
        isEn
          ? 'This account does not belong to this restaurant staff.'
          : 'هذا الحساب لا ينتمي إلى كادر هذا المطعم.'
      );
    }

    let staff = { ...(staffSnap.data() as StaffMember), uid: staffSnap.id };
    if (staff.restaurantId !== restaurant.id) {
      await signOut(auth);
      throw new Error(
        isEn
          ? 'Tenant isolation: cannot open another restaurant with this account.'
          : 'عزل المطاعم: لا يمكن فتح مطعم آخر بهذا الحساب.'
      );
    }

    const suspState = resolveStaffSuspensionState(staff);
    if (suspState.isExpiredTimed) {
      // Timed suspension expired: lift it atomically so worker can resume immediately
      const liftBatch = writeBatch(db);
      liftBatch.update(doc(db, 'restaurants', restaurant.id, 'staff', staff.uid), {
        isActive: true,
        suspendedType: '',
        suspendedUntil: null,
        suspendedReason: '',
        suspendedByRole: '',
        suspendedByName: '',
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      liftBatch.update(doc(db, 'staff_access', staff.uid), {
        isActive: true,
        suspendedType: '',
        suspendedUntil: null,
        updatedAt: serverTimestamp(),
      });
      await liftBatch.commit();
      staff = {
        ...staff,
        isActive: true,
        suspendedType: '',
        suspendedUntil: null,
        suspendedReason: '',
        suspendedByRole: '',
        suspendedByName: '',
      };
    } else if (suspState.isSuspended) {
      await signOut(auth);
      throw new Error(suspState.message);
    }

    resetLoginFailures(restaurant.slug, lockKey);

    try {
      if (!suspState.isExpiredTimed) {
        await updateDoc(doc(db, 'restaurants', restaurant.id, 'staff', staff.uid), {
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      const batch = writeBatch(db);
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
        details: isEn
          ? `Signed in via ${resolved.identifierType === 'email' ? 'email' : resolved.identifierType === 'phone' ? 'phone number' : 'username'}`
          : `تسجيل دخول عبر ${resolved.identifierType === 'email' ? 'البريد الإلكتروني' : resolved.identifierType === 'phone' ? 'رقم الهاتف' : 'اسم المستخدم'}`,
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
          isEn
            ? `Incorrect password. Temporary protection enabled for ${nextLock.remainingSeconds} seconds.`
            : `كلمة المرور غير صحيحة. تم تفعيل حماية مؤقتة لمدة ${nextLock.remainingSeconds} ثانية.`
        );
      }
      throw new Error(
        isEn ? 'Invalid login credentials or password.' : 'بيانات الدخول أو كلمة المرور غير صحيحة.'
      );
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
        onError(
          error instanceof Error
            ? error
            : new Error(getActiveLang() === 'en' ? 'Failed to load staff directory' : 'تعذر تحميل قائمة الكادر')
        );
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
        onError(
          error instanceof Error
            ? error
            : new Error(getActiveLang() === 'en' ? 'Failed to load audit log' : 'تعذر تحميل سجل التتبع')
        );
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
  const isEn = getActiveLang() === 'en';
  const pwCheck = validateStaffPassword(params.newPassword, params.confirmPassword);
  if (!pwCheck.valid) {
    throw new Error(pwCheck.error || (isEn ? 'Invalid password.' : 'كلمة المرور غير صالحة.'));
  }
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== params.staff.uid) {
    throw new Error(isEn ? 'Session expired. Please sign in again.' : 'انتهت جلسة الدخول. أعد تسجيل الدخول أولاً.');
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
    details: isEn ? 'Password updated' : 'تم تحديث كلمة المرور',
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

  const staffRef = doc(db, 'restaurants', restaurantId, 'staff', staff.uid);
  const accessRef = doc(db, 'staff_access', staff.uid);
  const uLookupRef = doc(db, 'restaurants', restaurantId, 'staff_login_index', uLookupId);
  const pLookupRef = doc(db, 'restaurants', restaurantId, 'staff_login_index', pLookupId);
  const eLookupRef = eLookupId
    ? doc(db, 'restaurants', restaurantId, 'staff_login_index', eLookupId)
    : null;
  const inviteRef = staff.activeInviteHash
    ? doc(db, 'restaurants', restaurantId, 'staff_invites', staff.activeInviteHash)
    : null;

  const [staffSnap, accessSnap, uSnap, pSnap, eSnap, invSnap] = await Promise.all([
    getDoc(staffRef).catch(() => null),
    getDoc(accessRef).catch(() => null),
    getDoc(uLookupRef).catch(() => null),
    getDoc(pLookupRef).catch(() => null),
    eLookupRef ? getDoc(eLookupRef).catch(() => null) : Promise.resolve(null),
    inviteRef ? getDoc(inviteRef).catch(() => null) : Promise.resolve(null),
  ]);

  try {
    // Batch 1: Core identity & invite revocation (<= 3 writes)
    const coreBatch = writeBatch(db);
    let hasCoreOps = false;
    if (staffSnap?.exists()) {
      coreBatch.delete(staffRef);
      hasCoreOps = true;
    }
    if (accessSnap?.exists()) {
      coreBatch.delete(accessRef);
      hasCoreOps = true;
    }
    if (inviteRef && invSnap?.exists()) {
      coreBatch.update(inviteRef, {
        revokedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      hasCoreOps = true;
    }
    if (hasCoreOps) {
      await coreBatch.commit();
    }

    // Batch 2: Delete existing login lookup entries (<= 3 writes)
    const indexBatch = writeBatch(db);
    let hasIndexOps = false;
    if (uSnap?.exists()) {
      indexBatch.delete(uLookupRef);
      hasIndexOps = true;
    }
    if (pSnap?.exists()) {
      indexBatch.delete(pLookupRef);
      hasIndexOps = true;
    }
    if (eLookupRef && eSnap?.exists()) {
      indexBatch.delete(eLookupRef);
      hasIndexOps = true;
    }
    if (hasIndexOps) {
      await indexBatch.commit();
    }

    // Batch 3: Non-fatal audit log
    try {
      const auditBatch = writeBatch(db);
      const logId = makeStaffDocId('slog');
      auditBatch.set(doc(db, 'restaurants', restaurantId, 'staff_audit_logs', logId), {
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
        details:
          getActiveLang() === 'en'
            ? `Deleted staff account: ${staff.name} (${staff.username})`
            : `تم حذف حساب الموظف: ${staff.name} (${staff.username})`,
        createdAt: serverTimestamp(),
      });
      await auditBatch.commit();
    } catch {
      // Non-fatal audit logging
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `restaurants/${restaurantId}/staff/${staff.uid}`);
  }
}
