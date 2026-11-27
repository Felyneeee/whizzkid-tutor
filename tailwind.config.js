const config = {
    content: ["./src/**/*.{js,jsx}"],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: "#f1f6f9",
                    100: "#dce8f0",
                    200: "#bfd3e1",
                    300: "#91b3ca",
                    400: "#5f8eab",
                    500: "#326b8d",
                    600: "#103E64",
                    700: "#0d3454",
                    800: "#0a2943",
                    900: "#071e32",
                },
                sunny: { 50: "#fffbea", 100: "#fff3c4", 200: "#ffe58a", 300: "#ffd34d", 400: "#FFE794", 500: "#f5a00a" },
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
