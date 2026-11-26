/** Shared response mappers used by clients-list / clientsCore (and main where shapes match). */

export function toPackageInstance(row: any) {
  return {
    id: row.id,
    clientId: row.client_id,
    bundleTypeId: row.bundle_type_id,
    coachId: row.coach_id,
    purchaseDate: String(row.purchased_at).slice(0, 10),
    expiryDate: String(row.expires_at).slice(0, 10),
    sessionsIncluded: row.sessions_included,
    sessionsRemaining: row.sessions_remaining,
    priceAtSale: Number(row.price_at_sale),
    coachCutAtSale: Number(row.coach_cut_at_sale),
    status: row.status,
    createdBy: row.created_by,
    locationId: row.location_id ?? null,
  };
}

export function toMembershipInstance(row: any) {
  return {
    id: row.id,
    clientId: row.client_id,
    membershipTypeId: row.membership_type_id,
    startDate: String(row.starts_at).slice(0, 10),
    expiryDate: String(row.expires_at).slice(0, 10),
    status: row.status,
    invitationsRemaining: row.invitations_remaining,
  };
}

/** List/summary shape for group plans (clients-list). Main context keeps a richer toGroupPlan with freeze fields. */
export function toGroupPlan(row: any) {
  return {
    id: row.id,
    clientId: row.client_id,
    kind: row.kind,
    planTypeId: row.plan_type_id ?? null,
    seriesId: row.series_id ?? null,
    name: row.name,
    priceAtSale: Number(row.price_at_sale),
    payMethod: row.pay_method,
    creditsTotal: row.credits_total ?? null,
    creditsRemaining: row.credits_remaining ?? null,
    invitationsRemaining: row.invitations_remaining,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    status: row.status,
    createdAt: row.created_at,
    locationId: row.location_id ?? null,
  };
}

export function toClient(row: any, conditions: string | null, currentPackage: any, currentMembership: any = null) {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    phone: row.phone ?? null,
    email: row.email ?? null,
    conditions,
    assignedCoachId: row.assigned_coach_id,
    currentPackage,
    currentMembership,
    homeLocationId: row.home_location_id ?? null,
  };
}
