import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const eslintConfig = [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];

export default eslintConfig;
