const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: [
            '.yarn/**',
            'coverage/**',
            'data/**/*.db',
            'node_modules/**',
        ],
    },
    {
        files: ['server.js', 'backend/**/*.js', 'scripts/**/*.js'],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-console': 'off',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        },
    },
    {
        files: ['public/js/**/*.js'],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-console': 'off',
            'no-misleading-character-class': 'off',
            'no-undef': 'off',
            'no-unused-vars': 'off',
        },
    },
];
