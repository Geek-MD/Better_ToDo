import { configs as litConfigs } from "eslint-plugin-lit";
import { configs as wcConfigs } from "eslint-plugin-wc";
import globals from "globals";

const panelFiles = ["custom_components/better_todo/frontend/**/*.js"];

export default [
  {
    files: panelFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: globals.browser,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "constructor-super": "error",
      eqeqeq: ["error", "always"],
      "no-constant-condition": "error",
      "no-dupe-class-members": "error",
      "no-duplicate-case": "error",
      "no-fallthrough": "error",
      "no-new-native-nonconstructor": "error",
      "no-promise-executor-return": "error",
      "no-self-assign": "error",
      "no-unreachable": "error",
      "no-unused-vars": ["error", { args: "after-used" }],
      "no-undef": "error",
      "no-useless-assignment": "error",
      "no-useless-catch": "error",
      "no-useless-escape": "error",
      "no-with": "error",
      "prefer-const": "error",
      "require-yield": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
    },
  },
  {
    ...wcConfigs["flat/recommended"],
    files: panelFiles,
  },
  {
    ...litConfigs["flat/recommended"],
    files: panelFiles,
    settings: {
      lit: {
        elementBaseClasses: ["LitElement"],
      },
    },
  },
];
