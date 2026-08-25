// Holds the logged-in user's id so the API fetch helpers can attach it as a "UserID" request
// header on every mutating call — the backend writes it to the audit columns (CreatedBy /
// ModifiedBy / DeletedBy). Set once from the next-auth session in the app Shell.
let _userId: number | null = null;

export const setCurrentUserId = (id: number | null | undefined) => {
  _userId = typeof id === "number" && id > 0 ? id : null;
};

export const getCurrentUserId = () => _userId;

/** Spread into fetch headers so the backend can populate audit columns. Empty if unknown. */
export const userIdHeader = (): Record<string, string> => (_userId ? { UserID: String(_userId) } : {});
