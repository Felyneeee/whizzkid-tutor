export const ADMIN_ID = "u_admin";
/** Initial local-only database state. */
export function buildSeed() {
    return {
        users: [{
                id: ADMIN_ID,
                role: "admin",
                email: "admin@whizzkids.ph",
                username: "admin",
                createdAt: "2026-10-26T00:00:00.000Z",
            }],
        tutees: [],
        tutors: [],
        availability: [],
        tutorSchedules: {},
        leaves: [],
        bookings: [],
        sessions: [],
        progressReports: [],
        assessments: [],
        cohorts: [],
        messages: [],
        notifications: [],
        purchases: [],
        materials: [],
        materialLogs: [],
        activities: [],
        hirings: [],
    };
}
