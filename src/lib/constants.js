// One-hour tutorial sessions start from 10 AM; the last session starts at 5 PM and ends at 6 PM.
export const HOURS = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
export const TUTOR_SHIFT_STARTS = ["09:00", "10:00"];
export const SUBJECTS = ["English", "Filipino", "Araling Panlipunan", "Science", "Math"];
export const READING_SKILLS = [
    "Phonemic Awareness",
    "Sight Words",
    "Fluency",
    "Comprehension",
    "Advanced Reading",
];
export const GRADE_LEVELS = [
    "Nursery",
    "Kinder",
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7",
    "Grade 8",
    "Grade 9",
    "Grade 10",
    "Grade 11",
    "Grade 12",
];
export const GRADE_BANDS = ["Preschool", "Elementary", "Junior High", "Senior High"];
export function bandOf(grade) {
    if (grade === "Nursery" || grade === "Kinder")
        return "Preschool";
    const n = Number(grade.replace("Grade ", ""));
    if (n <= 6)
        return "Elementary";
    if (n <= 10)
        return "Junior High";
    return "Senior High";
}
// ---- Rates (per hour, PHP) — calculated while the tutee fills the form ----
export const BASE_RATES = {
    Preschool: 300,
    Elementary: 350,
    "Junior High": 450,
    "Senior High": 550,
};
export const READING_PREMIUM = 50;
export const FACE_TO_FACE_PREMIUM = 50;
export const PLAYGROUP_MONTHLY_FEE = 3200;
export const ASSESSMENT_FEE = 500;
export const PROGRAMS = {
    reading: {
        name: "Reading Programs",
        blurb: "Phonemic awareness, sight words, fluency, comprehension and advanced reading. Starts with an initial assessment.",
        ages: "Ages 3–15",
        emoji: "📚",
        color: "bg-sunny-100 text-sunny-500",
    },
    academic: {
        name: "Academic Tutorials",
        blurb: "Reteaching lessons in English, Filipino, Araling Panlipunan, Science and Math.",
        ages: "Nursery to High School",
        emoji: "✏️",
        color: "bg-brand-100 text-brand-700",
    },
    playgroup: {
        name: "Playgroup Class",
        blurb: "Fun, structured activities for little ones — 1 month, 3x a week.",
        ages: "Ages 2.8–4",
        emoji: "🧸",
        color: "bg-coral-100 text-coral-600",
    },
};
export const SHOP_ITEMS = [
    { sku: "shirt", name: "Whizzkids Shirt (additional)", price: 350 },
    { sku: "workbook", name: "Workbook", price: 450 },
    { sku: "free-shirt", name: "Welcome Shirt (free for new enrollees)", price: 0 },
    { sku: "reader", name: "Phonics Reader Set", price: 600 },
];
export const CENTER = {
    name: "Whizzkids Academic Center",
    address: "Dasmariñas, Cavite, Philippines",
    phone: "+63 917 000 0000",
    email: "hello@whizzkids.ph",
    hours: "Mon–Sat, 9:00 AM – 6:00 PM",
};
export const FAQS = [
    {
        q: "How do I enroll my child?",
        a: "Create a parent account, complete your child's profile, then pick a program. Reading Programs begin with an initial assessment; Academic Tutorials go straight to booking and matching; Playgroup is booked directly from the class calendar.",
    },
    {
        q: "Are lessons online or face-to-face?",
        a: "Both. All of our tutors handle online and face-to-face sessions; you pick the modality when you book.",
    },
    {
        q: "How are tutors matched to my child?",
        a: "The system checks subject expertise, grade level, learning needs, modality and each tutor's admin-approved availability. Our admin then reviews the recommendations and confirms the assignment.",
    },
    {
        q: "Can I book a recurring schedule?",
        a: "Yes. Choose one-time or recurring (e.g. every Monday and Wednesday for a date range). We try to keep the same tutor throughout a recurring booking.",
    },
    {
        q: "How much does it cost?",
        a: "The hourly rate is computed while you fill out the booking form, based on grade level, program and modality. Playgroup is a flat monthly fee.",
    },
];
