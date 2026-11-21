import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default [
  ...nextCoreWebVitals,
  {
    ignores: [".next/**", ".next-*/**", "out/**", "build/**", "coverage/**"],
  },
  {
    files: [
      "app/(platform)/admin/security/page.js",
      "components/account-forms.js",
      "components/billing.js",
      "components/feed-client.js",
      "components/language-provider.js",
      "components/people-client.js",
      "components/question-composer.js",
      "components/question-detail-client.js",
      "components/questions-client.js",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["components/billing.js"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
];
