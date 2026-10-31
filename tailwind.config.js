const config = {
    content: ["./src/**/*.{js,jsx}"],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: "#eef6ff",
                    100: "#d9eaff",
                    200: "#bcdbff",
                    300: "#8ec3ff",
                    400: "#59a2ff",
                    500: "#337fff",
                    600: "#1d5ff5",
                    700: "#154ae1",
                    800: "#183db6",
                    900: "#193890",
                },
                sunny: { 50: "#fffbea", 100: "#fff3c4", 200: "#ffe58a", 300: "#ffd34d", 400: "#ffc01f", 500: "#f5a00a" },
                coral: { 50: "#fff1f0", 100: "#ffe0dd", 400: "#ff7a6b", 500: "#f95a49", 600: "#e03e2d" },
                mint: { 50: "#ecfdf5", 100: "#d1fae5", 500: "#10b981", 600: "#059669" },
            },
            borderRadius: { xl2: "1.25rem" },
            fontFamily: { sans: ["Nunito", "Quicksand", "ui-rounded", "system-ui", "Segoe UI", "sans-serif"] },
        },
    },
    plugins: [],
};

module.exports = config;
